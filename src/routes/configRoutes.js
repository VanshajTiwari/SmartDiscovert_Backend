const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');
const { requireDeviceOrAdminAuth, requireAdminAuth } = require('../middlewares/authMiddleware');

// Get device config (accessible by device or admin)
router.get('/:deviceId', requireDeviceOrAdminAuth, configController.getConfig);

// Update device config (typically initiated by admin/dashboard)
router.put('/:deviceId', requireAdminAuth, configController.updateConfig);

module.exports = router;
