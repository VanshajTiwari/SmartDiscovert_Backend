const analyticsService = require('../services/analyticsService');
const Device = require('../models/Device');

/**
 * System-wide analytics overview
 * GET /api/v1/analytics/summary
 */
const getSummary = async (req, res, next) => {
  try {
    const summary = await analyticsService.getSummary();
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Per-device analytics and history
 * GET /api/v1/analytics/device/:deviceId
 */
const getDeviceAnalytics = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const result = await analyticsService.getDeviceAnalytics(deviceId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: `Device not found with id: ${deviceId}`
      });
    }

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Status overview of all registered devices
 * GET /api/v1/analytics/devices
 */
const getDevicesOverview = async (req, res, next) => {
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
  getSummary,
  getDeviceAnalytics,
  getDevicesOverview
};
