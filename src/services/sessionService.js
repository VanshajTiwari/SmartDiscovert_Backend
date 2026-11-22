const Session = require('../models/Session');
const Device = require('../models/Device');
const EventLog = require('../models/EventLog');
const { v4: uuidv4 } = require('uuid');

class SessionService {
  /**
   * Starts a new session or updates an existing one
   */
  async startSession({ sessionId, deviceId }) {
    const finalSessionId = sessionId || `sess_${uuidv4()}`;

    const session = await Session.findOneAndUpdate(
      { sessionId: finalSessionId },
      {
        deviceId,
        state: 'RUNNING',
        startedAt: new Date(),
        endedAt: null,
        stopReason: null
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Update Device status
    await Device.findOneAndUpdate(
      { deviceId },
      { status: 'ACTIVE_SESSION', lastSeenAt: new Date() }
    );

    // Log start event
    await EventLog.create({
      sessionId: finalSessionId,
      deviceId,
      eventType: 'SESSION_STARTED',
      detail: 'Session initiated via API/Client'
    });

    return session;
  }

  /**
   * Process periodic heartbeat from Android client
   */
  async processHeartbeat({ sessionId, deviceId, state = 'RUNNING', rightCount = 0, leftCount = 0, totalCount, durationSeconds = 0 }) {
    const calculatedTotal = totalCount !== undefined ? totalCount : (rightCount + leftCount);

    const session = await Session.findOneAndUpdate(
      { sessionId },
      {
        deviceId,
        state,
        rightCount,
        leftCount,
        totalCount: calculatedTotal,
        durationSeconds
      },
      { upsert: true, new: true }
    );

    const deviceStatus = state === 'RUNNING' ? 'ACTIVE_SESSION' : 'ONLINE';
    await Device.findOneAndUpdate(
      { deviceId },
      { status: deviceStatus, lastSeenAt: new Date() }
    );

    return session;
  }

  /**
   * Stops and finalizes a session
   */
  async stopSession({ sessionId, deviceId, stopReason = 'COMPLETED', durationSeconds }) {
    const update = {
      state: 'STOPPED',
      endedAt: new Date(),
      stopReason
    };

    if (durationSeconds !== undefined) {
      update.durationSeconds = durationSeconds;
    }

    const session = await Session.findOneAndUpdate(
      { sessionId },
      update,
      { new: true }
    );

    // Mark device back to ONLINE
    if (deviceId) {
      await Device.findOneAndUpdate(
        { deviceId },
        { status: 'ONLINE', lastSeenAt: new Date() }
      );
    }

    // Log stop event
    if (session) {
      await EventLog.create({
        sessionId,
        deviceId: session.deviceId,
        eventType: 'SESSION_STOPPED',
        detail: `Session stopped with reason: ${stopReason}`
      });
    }

    return session;
  }

  /**
   * Batch insert events uploaded by Android SessionRepository
   */
  async recordBatchEvents({ sessionId, deviceId, events = [] }) {
    if (!Array.isArray(events) || events.length === 0) {
      return { insertedCount: 0 };
    }

    let rightInc = 0;
    let leftInc = 0;

    const formattedEvents = events.map(evt => {
      if (evt.eventType === 'STEP_RIGHT') rightInc++;
      if (evt.eventType === 'STEP_LEFT') leftInc++;

      return {
        sessionId: evt.sessionId || sessionId,
        deviceId: evt.deviceId || deviceId,
        eventType: evt.eventType,
        detail: evt.detail || '',
        metadata: evt.metadata || {},
        timestamp: evt.timestamp ? new Date(evt.timestamp) : new Date()
      };
    });

    const result = await EventLog.insertMany(formattedEvents, { ordered: false });

    // Update Session aggregates if any swipe steps were logged
    if (rightInc > 0 || leftInc > 0) {
      await Session.findOneAndUpdate(
        { sessionId },
        {
          $inc: {
            rightCount: rightInc,
            leftCount: leftInc,
            totalCount: rightInc + leftInc
          }
        }
      );
    }

    return { insertedCount: result.length };
  }

  /**
   * Fetch session with its event logs
   */
  async getSessionWithEvents(sessionId) {
    const session = await Session.findOne({ sessionId }).lean();
    if (!session) return null;

    const events = await EventLog.find({ sessionId })
      .sort({ timestamp: 1 })
      .limit(500)
      .lean();

    return {
      ...session,
      events
    };
  }

  /**
   * List sessions with filtering and pagination
   */
  async listSessions({ deviceId, state, page = 1, limit = 20 }) {
    const query = {};
    if (deviceId) query.deviceId = deviceId;
    if (state) query.state = state;

    const skip = (Math.max(1, page) - 1) * limit;

    const [sessions, total] = await Promise.all([
      Session.find(query).sort({ startedAt: -1 }).skip(skip).limit(limit).lean(),
      Session.countDocuments(query)
    ]);

    return {
      sessions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}

module.exports = new SessionService();
