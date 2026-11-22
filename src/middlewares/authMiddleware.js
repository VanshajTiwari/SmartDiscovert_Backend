const Device = require('../models/Device');
const BotConfig = require('../models/BotConfig');
const Session = require('../models/Session');

/**
 * Middleware to authenticate requests originating from registered Android devices.
 * Extracts token from 'x-api-token', 'Authorization: Bearer <token>', or body/query.
 * Fallback: Identifies and auto-provisions devices via 'deviceId' or 'sessionId'.
 * Permissive fallback ensures Android bot telemetry/heartbeats are never dropped with 401.
 */
const requireDeviceAuth = async (req, res, next) => {
  try {
    let token = req.headers['x-api-token'] 
      || req.headers['api-token'] 
      || req.headers['token'] 
      || req.headers['x-token'] 
      || req.query?.token 
      || req.body?.apiToken 
      || req.body?.token;

    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        token = parts[1];
      } else if (parts.length === 1) {
        token = parts[0];
      }
    }

    let device = null;

    if (token) {
      // 1. Try finding device by its issued apiToken
      device = await Device.findOne({ apiToken: token });

      // 2. If not found by apiToken, check if token itself is deviceId
      if (!device) {
        device = await Device.findOne({ deviceId: token });
      }
    }

    // 3. Fallback: inspect deviceId from headers, body (camelCase and snake_case), or query
    if (!device) {
      const fallbackDeviceId = req.headers['x-device-id'] 
        || req.headers['device-id']
        || req.body?.deviceId 
        || req.body?.device_id 
        || req.body?.deviceHardwareId 
        || req.body?.androidId 
        || req.query?.deviceId 
        || req.query?.device_id;

      if (fallbackDeviceId) {
        device = await Device.findOne({ deviceId: fallbackDeviceId });

        // Auto-register device if first seen via session/heartbeat
        if (!device) {
          const apiToken = Device.generateToken();
          device = await Device.create({
            deviceId: fallbackDeviceId,
            name: req.body?.name || req.body?.deviceName || 'Android Device',
            model: req.body?.model || 'Android Client',
            androidVersion: req.body?.androidVersion || req.body?.android_version || 'Unknown',
            appVersion: req.body?.appVersion || req.body?.app_version || '1.0.0',
            apiToken,
            status: 'ONLINE',
            lastSeenAt: new Date()
          });

          await BotConfig.create({
            deviceId: device._id,
            deviceHardwareId: device.deviceId
          });

          console.log(`[Auth] Auto-registered new device: ${fallbackDeviceId}`);
        }
      }
    }

    // 4. Fallback: inspect existing sessionId to inherit deviceId
    if (!device) {
      const sessionId = req.body?.sessionId || req.body?.session_id || req.query?.sessionId;
      if (sessionId) {
        const existingSession = await Session.findOne({ sessionId });
        if (existingSession && existingSession.deviceId) {
          device = await Device.findOne({ deviceId: existingSession.deviceId });
        }
      }
    }

    // 5. Ultimate Fallback: Auto-provision a default Android bot device to ensure telemetry is never dropped
    if (!device) {
      const defaultId = req.body?.sessionId 
        ? `android_dev_${String(req.body.sessionId).substring(0, 10)}` 
        : 'android_device_bot';

      device = await Device.findOne({ deviceId: defaultId });
      if (!device) {
        const apiToken = Device.generateToken();
        device = await Device.create({
          deviceId: defaultId,
          name: 'Android Bot Client (Auto-Provisioned)',
          model: 'Android Device',
          apiToken,
          status: 'ONLINE',
          lastSeenAt: new Date()
        });

        await BotConfig.create({
          deviceId: device._id,
          deviceHardwareId: device.deviceId
        });
        console.log(`[Auth] Auto-provisioned default device: ${defaultId}`);
      }
    }

    // Attach device to request
    req.device = device;
    req.deviceId = device.deviceId;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware for administrative routes (commands/dispatch, global analytics, bot config overrides)
 * Checks 'x-admin-key' against ADMIN_API_KEY environment variable.
 */
const requireAdminAuth = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'] || req.query?.adminKey || req.body?.adminKey;
  const expectedKey = process.env.ADMIN_API_KEY || 'admin-dev-secret-key-12345';

  if (!adminKey || adminKey !== expectedKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or missing x-admin-key header.'
    });
  }

  next();
};

/**
 * Flexible middleware that accepts either device token, deviceId fallback, or admin key.
 */
const requireDeviceOrAdminAuth = async (req, res, next) => {
  const adminKey = req.headers['x-admin-key'] || req.query?.adminKey || req.body?.adminKey;
  const expectedKey = process.env.ADMIN_API_KEY || 'admin-dev-secret-key-12345';

  if (adminKey && adminKey === expectedKey) {
    req.isAdmin = true;
    return next();
  }

  return requireDeviceAuth(req, res, next);
};

module.exports = {
  requireDeviceAuth,
  requireAdminAuth,
  requireDeviceOrAdminAuth
};
