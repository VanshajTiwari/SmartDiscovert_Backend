const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

// Overall analytics summary
router.get('/summary', analyticsController.getSummary);

// Devices overview list
router.get('/devices', analyticsController.getDevicesOverview);

// Specific device metrics and history
router.get('/device/:deviceId', analyticsController.getDeviceAnalytics);

module.exports = router;
