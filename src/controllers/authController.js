const Device = require('../models/Device');
const BotConfig = require('../models/BotConfig');

/**
 * Register or update an Android device
 * POST /api/v1/devices/register
 */
const registerDevice = async (req, res, next) => {
  try {
    const { deviceId, name, model, androidVersion, appVersion } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'deviceId is required'
      });
    }

    let device = await Device.findOne({ deviceId });

    if (!device) {
      const apiToken = Device.generateToken();
      device = await Device.create({
        deviceId,
        name: name || 'Android Device',
        model: model || 'Unknown Model',
        androidVersion: androidVersion || 'Unknown',
        appVersion: appVersion || '1.0.0',
        apiToken,
        status: 'ONLINE',
        lastSeenAt: new Date()
      });
    } else {
      // Update existing device attributes
      if (name) device.name = name;
      if (model) device.model = model;
      if (androidVersion) device.androidVersion = androidVersion;
      if (appVersion) device.appVersion = appVersion;
      device.status = 'ONLINE';
      device.lastSeenAt = new Date();
      await device.save();
    }

    // Ensure BotConfig exists for this device
    let config = await BotConfig.findOne({ deviceId: device._id });
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
