const Device = require('../models/Device');

/**
 * Middleware to authenticate requests originating from registered Android devices.
 * Extracts token from 'x-api-token' or 'Authorization: Bearer <token>' header.
 */
const requireDeviceAuth = async (req, res, next) => {
  try {
    let token = req.headers['x-api-token'];

    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Missing API token. Provide via x-api-token header or Bearer token.'
      });
    }

    const device = await Device.findOne({ apiToken: token });

    if (!device) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Invalid API token.'
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
  const adminKey = req.headers['x-admin-key'];
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
 * Flexible middleware that accepts either device token or admin key.
 */
const requireDeviceOrAdminAuth = async (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
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
