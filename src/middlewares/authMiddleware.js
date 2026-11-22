const Device = require('../models/Device');
const BotConfig = require('../models/BotConfig');

/**
 * Middleware to authenticate requests originating from registered Android devices.
 * Extracts token from 'x-api-token', 'Authorization: Bearer <token>', or body/query.
 * Fallback: Identifies and auto-provisions devices via 'deviceId' if token is missing.
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

    // 3. Fallback: If no valid token found, inspect deviceId from headers, body, or query
    if (!device) {
      const fallbackDeviceId = req.headers['x-device-id'] 
        || req.body?.deviceId 
        || req.query?.deviceId;

      if (fallbackDeviceId) {
        device = await Device.findOne({ deviceId: fallbackDeviceId });

        // Auto-register device if first seen via session/heartbeat
        if (!device) {
          const apiToken = Device.generateToken();
          device = await Device.create({
            deviceId: fallbackDeviceId,
            name: req.body?.name || 'Android Device',
            model: req.body?.model || 'Android Client',
            androidVersion: req.body?.androidVersion || 'Unknown',
            appVersion: req.body?.appVersion || '1.0.0',
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

    if (!device) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Missing or invalid API token. Provide via x-api-token header, Bearer token, or deviceId.'
      });
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
