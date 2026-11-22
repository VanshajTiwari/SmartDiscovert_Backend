const Device = require('../models/Device');
const BotConfig = require('../models/BotConfig');
const User = require('../models/User');
const crypto = require('crypto');

/**
 * Register or update an Android device
 * POST /api/v1/devices/register
 */
const registerDevice = async (req, res, next) => {
  try {
    const body = req.body || {};

    // Support all client naming conventions (camelCase, snake_case, headers, query)
    const rawDeviceId = body.deviceId 
      || body.device_id 
      || body.id 
      || body.deviceHardwareId 
      || body.androidId 
      || body.hardwareId 
      || req.headers['x-device-id'] 
      || req.headers['device-id'] 
      || req.query?.deviceId 
      || req.query?.device_id;

    // If completely missing, auto-generate a valid unique deviceId so registration never fails
    const deviceId = rawDeviceId 
      ? String(rawDeviceId).trim() 
      : `android_${crypto.randomBytes(8).toString('hex')}`;

    const name = body.name || body.deviceName || body.device_name || 'Android Device';
    const model = body.model || body.deviceModel || body.device_model || 'Unknown Model';
    const androidVersion = body.androidVersion || body.android_version || body.osVersion || 'Unknown';
    const appVersion = body.appVersion || body.app_version || body.version || '1.0.0';
    const username = body.username ? String(body.username).toLowerCase().trim() : null;

    let device = await Device.findOne({ deviceId });

    if (!device) {
      const apiToken = Device.generateToken();
      device = await Device.create({
        deviceId,
        name,
        model,
        androidVersion,
        appVersion,
        apiToken,
        ownerUsername: username,
        status: 'ONLINE',
        lastSeenAt: new Date()
      });
      console.log(`[Device] Registered new device: ${deviceId}${username ? ` (owner: ${username})` : ''}`);
    } else {
      // Update existing device attributes
      if (name && name !== 'Android Device') device.name = name;
      if (model && model !== 'Unknown Model') device.model = model;
      if (androidVersion && androidVersion !== 'Unknown') device.androidVersion = androidVersion;
      if (appVersion) device.appVersion = appVersion;
      if (username) device.ownerUsername = username;
      device.status = 'ONLINE';
      device.lastSeenAt = new Date();
      await device.save();
      console.log(`[Device] Updated existing device: ${deviceId}`);
    }

    // If username was provided, also add device to User's devices array
    if (username) {
      try {
        const user = await User.findOne({ username });
        if (user && !user.devices.includes(device._id)) {
          user.devices.push(device._id);
          device.userId = user._id;
          await Promise.all([user.save(), device.save()]);
        }
      } catch (userErr) {
        console.warn(`[Device] Pairing with user ${username} warning: ${userErr.message}`);
      }
    }

    // Ensure BotConfig exists for this device
    let config = await BotConfig.findOne({ deviceHardwareId: device.deviceId });
    if (!config) {
      config = await BotConfig.create({
        deviceId: device._id,
        deviceHardwareId: device.deviceId
      });
    }

    res.status(200).json({
      success: true,
      message: 'Device registered successfully',
      data: {
        deviceId: device.deviceId,
        ownerUsername: device.ownerUsername,
        name: device.name,
        apiToken: device.apiToken,
        status: device.status,
        config: {
          cycleSize: config.cycleSize,
          maxRightsPerCycle: config.maxRightsPerCycle,
          maxTotalActions: config.maxTotalActions,
          maxRightActions: config.maxRightActions,
          minStepDelayMs: config.minStepDelayMs,
          maxStepDelayMs: config.maxStepDelayMs,
          scrollDurationMs: config.scrollDurationMs,
          scrollSettleMs: config.scrollSettleMs,
          autoRestartOnCap: config.autoRestartOnCap
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get device status and details
 * GET /api/v1/devices/status
 */
const getDeviceStatus = async (req, res, next) => {
  try {
    const device = req.device;
    res.status(200).json({
      success: true,
      data: device
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List all registered devices
 * GET /api/v1/devices
 */
const listDevices = async (req, res, next) => {
  try {
    const devices = await Device.find().sort({ lastSeenAt: -1 }).lean();
    res.status(200).json({
      success: true,
      count: devices.length,
      data: devices
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerDevice,
  getDeviceStatus,
  listDevices
};
