const express = require('express');
const router = express.Router();
const commandController = require('../controllers/commandController');
const { requireAdminAuth, requireDeviceOrAdminAuth } = require('../middlewares/authMiddleware');

// Dispatch remote command (START, PAUSE, RESUME, STOP, RESET)
router.post('/send', requireAdminAuth, commandController.sendCommand);

// Retrieve pending commands for device (HTTP polling fallback)
router.get('/pending/:deviceId', requireDeviceOrAdminAuth, commandController.getPendingCommands);

// Acknowledge command execution from device
router.post('/:commandId/ack', requireDeviceOrAdminAuth, commandController.acknowledgeCommand);

module.exports = router;
