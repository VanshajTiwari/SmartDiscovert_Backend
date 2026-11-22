const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireDeviceAuth, requireAdminAuth } = require('../middlewares/authMiddleware');

// Public device registration
router.post('/register', authController.registerDevice);

// Authenticated device status check
router.get('/status', requireDeviceAuth, authController.getDeviceStatus);

// Admin device listing
router.get('/', requireAdminAuth, authController.listDevices);

module.exports = router;
