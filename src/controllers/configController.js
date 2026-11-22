const BotConfig = require('../models/BotConfig');
const Device = require('../models/Device');
const { broadcastConfigUpdate } = require('../websocket/socketHandler');

/**
 * Fetch remote strategy parameters for a device
 * GET /api/v1/config/:deviceId
 */
const getConfig = async (req, res, next) => {
  try {
    const { deviceId } = req.params;

    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        error: `Device not found with id: ${deviceId}`
      });
    }

    let config = await BotConfig.findOne({ deviceHardwareId: deviceId });
    if (!config) {
      config = await BotConfig.create({
        deviceId: device._id,
        deviceHardwareId: device.deviceId
      });
    }

    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update remote bot configuration (delays, cycle ratios, action caps)
 * PUT /api/v1/config/:deviceId
 */
const updateConfig = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const updates = req.body;

    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        error: `Device not found with id: ${deviceId}`
      });
    }

    // Allowed updatable fields
    const allowedFields = [
      'cycleSize',
      'maxRightsPerCycle',
      'maxTotalActions',
      'maxRightActions',
      'minStepDelayMs',
      'maxStepDelayMs',
      'scrollDurationMs',
      'scrollSettleMs',
      'autoRestartOnCap'
    ];

    const cleanUpdate = { updatedAt: new Date() };
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        cleanUpdate[key] = updates[key];
      }
    }

    const config = await BotConfig.findOneAndUpdate(
      { deviceHardwareId: deviceId },
      { $set: cleanUpdate },
      { new: true, upsert: true, runValidators: true }
    );

    // Push updated parameters over WebSocket to the live Android client
    broadcastConfigUpdate(deviceId, config);

    res.status(200).json({
      success: true,
      message: 'Configuration updated and broadcasted to device',
      data: config
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConfig,
  updateConfig
};
