const Device = require('../models/Device');
const Session = require('../models/Session');
const EventLog = require('../models/EventLog');
const CommandQueue = require('../models/CommandQueue');

let ioInstance = null;

// Track active socket connections: deviceId -> Set of socketIds
const connectedDevices = new Map();

/**
 * Initializes Socket.io event listeners
 * @param {import('socket.io').Server} io
 */
const initSocketHandler = (io) => {
  ioInstance = io;

  // Authentication Middleware for incoming Socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      const deviceId = socket.handshake.auth?.deviceId || socket.handshake.query?.deviceId;
      const isAdmin = socket.handshake.auth?.adminKey === (process.env.ADMIN_API_KEY || 'admin-dev-secret-key-12345');

      if (isAdmin) {
        socket.isAdmin = true;
        return next();
      }

      if (!deviceId && !token) {
        return next(new Error('Authentication error: Missing deviceId or token'));
      }

      let device = null;
      if (token) {
        device = await Device.findOne({ apiToken: token });
      } else if (deviceId) {
        device = await Device.findOne({ deviceId });
      }

      if (!device) {
        return next(new Error('Authentication error: Device not found'));
      }

      socket.deviceId = device.deviceId;
      socket.deviceDbId = device._id;
      next();
    } catch (err) {
      next(new Error(`Socket authentication failed: ${err.message}`));
    }
  });

  io.on('connection', async (socket) => {
    // If Admin/Dashboard client connected
    if (socket.isAdmin) {
      socket.join('dashboard');
      console.log(`[Socket] Dashboard client connected: ${socket.id}`);

      socket.on('disconnect', () => {
        console.log(`[Socket] Dashboard client disconnected: ${socket.id}`);
      });
      return;
    }

    const { deviceId } = socket;
    console.log(`[Socket] Device connected: ${deviceId} (Socket: ${socket.id})`);

    // Add device to room and connection tracker
    socket.join(`device:${deviceId}`);
    if (!connectedDevices.has(deviceId)) {
      connectedDevices.set(deviceId, new Set());
    }
    connectedDevices.get(deviceId).add(socket.id);

    // Update Device status in DB to ONLINE
    try {
      await Device.findOneAndUpdate(
        { deviceId },
        { status: 'ONLINE', lastSeenAt: new Date() }
      );
      io.to('dashboard').emit('device:status_change', {
        deviceId,
        status: 'ONLINE',
        lastSeenAt: new Date()
      });
    } catch (err) {
      console.error(`[Socket] Failed to mark device online: ${err.message}`);
    }

    /**
     * Event: device:heartbeat
     * Payload: { sessionId, state, rightCount, leftCount, totalCount, durationSeconds, overlayActive }
     */
    socket.on('device:heartbeat', async (data) => {
      try {
        const {
          sessionId,
          state = 'IDLE',
          rightCount = 0,
          leftCount = 0,
          totalCount,
          durationSeconds = 0
        } = data || {};

        const calculatedTotal = totalCount !== undefined ? totalCount : (rightCount + leftCount);

        // Update Device record
        const deviceStatus = state === 'RUNNING' ? 'ACTIVE_SESSION' : 'ONLINE';
        await Device.findOneAndUpdate(
          { deviceId },
          { status: deviceStatus, lastSeenAt: new Date() }
        );

        // Update active Session if sessionId is provided
        if (sessionId) {
          await Session.findOneAndUpdate(
            { sessionId },
            {
              deviceId,
              state,
              rightCount,
              leftCount,
              totalCount: calculatedTotal,
              durationSeconds
            },
            { upsert: true }
          );
        }

        // Notify Dashboard of live stats
        io.to('dashboard').emit('device:heartbeat_update', {
          deviceId,
          sessionId,
          state,
          rightCount,
          leftCount,
          totalCount: calculatedTotal,
          durationSeconds,
          timestamp: new Date()
        });
      } catch (err) {
        console.error(`[Socket] Error processing device:heartbeat from ${deviceId}:`, err.message);
      }
    });

    /**
     * Event: event:logged
     * Payload: { sessionId, eventType, detail, timestamp, metadata }
     */
    socket.on('event:logged', async (data) => {
      try {
        const {
          sessionId,
          eventType,
          detail,
          timestamp = new Date(),
          metadata
        } = data || {};

        if (!sessionId || !eventType) return;

        // Persist to EventLog
        const eventLog = await EventLog.create({
          sessionId,
          deviceId,
          eventType,
          detail,
          metadata,
          timestamp: new Date(timestamp)
        });

        // Update Session counts incrementally if it's a swipe step
        const incUpdate = {};
        if (eventType === 'STEP_RIGHT') {
          incUpdate.rightCount = 1;
          incUpdate.totalCount = 1;
        } else if (eventType === 'STEP_LEFT') {
          incUpdate.leftCount = 1;
          incUpdate.totalCount = 1;
        }

        if (Object.keys(incUpdate).length > 0) {
          await Session.findOneAndUpdate(
            { sessionId },
            { $inc: incUpdate }
          );
        }

        // Forward to Dashboard live stream
        io.to('dashboard').emit('event:stream', {
          deviceId,
          sessionId,
          eventType,
          detail,
          timestamp: eventLog.timestamp
        });
      } catch (err) {
        console.error(`[Socket] Error processing event:logged from ${deviceId}:`, err.message);
      }
    });

    /**
     * Event: command:ack
     * Payload: { commandId, status, resultMessage }
     */
    socket.on('command:ack', async (data) => {
      try {
        const { commandId, status = 'EXECUTED', resultMessage } = data || {};
        if (commandId) {
          await CommandQueue.findByIdAndUpdate(commandId, {
            status,
            resultMessage,
            executedAt: new Date()
          });
        }
        io.to('dashboard').emit('command:ack_update', { commandId, deviceId, status, resultMessage });
      } catch (err) {
        console.error(`[Socket] Error processing command:ack:`, err.message);
      }
    });

    // Handle Disconnect
    socket.on('disconnect', async () => {
      console.log(`[Socket] Device disconnected: ${deviceId} (${socket.id})`);
      const sockets = connectedDevices.get(deviceId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          connectedDevices.delete(deviceId);

          // Update status to OFFLINE if no other active socket connections for this device
          try {
            await Device.findOneAndUpdate(
              { deviceId },
              { status: 'OFFLINE', lastSeenAt: new Date() }
            );
            io.to('dashboard').emit('device:status_change', {
              deviceId,
              status: 'OFFLINE',
              lastSeenAt: new Date()
            });
          } catch (err) {
            console.error(`[Socket] Error marking device offline: ${err.message}`);
          }
        }
      }
    });
  });
};

/**
 * Pushes a remote command to an Android device over Socket.io
 * @param {string} deviceId
 * @param {string} command - START, PAUSE, RESUME, STOP, RESET
 * @param {object} payload - Optional extra parameters
 * @param {string} commandId - Mongo CommandQueue _id for tracking
 */
const sendSocketCommand = (deviceId, command, payload = {}, commandId = null) => {
  if (!ioInstance) {
    console.warn('[Socket] Cannot send command: Socket.io not initialized.');
    return false;
  }

  const room = `device:${deviceId}`;
  const isConnected = connectedDevices.has(deviceId) && connectedDevices.get(deviceId).size > 0;

  ioInstance.to(room).emit('command:execute', {
    commandId,
    deviceId,
    command,
    payload,
    timestamp: new Date()
  });

  return isConnected;
};

/**
 * Broadcasts an updated SequenceConfig / BotConfig to the device
 * @param {string} deviceId
 * @param {object} config
 */
const broadcastConfigUpdate = (deviceId, config) => {
  if (!ioInstance) return false;
  ioInstance.to(`device:${deviceId}`).emit('config:update', {
    deviceId,
    config,
    timestamp: new Date()
  });
  return true;
};

const getConnectedDevices = () => Array.from(connectedDevices.keys());

module.exports = {
  initSocketHandler,
  sendSocketCommand,
  broadcastConfigUpdate,
  getConnectedDevices
};
