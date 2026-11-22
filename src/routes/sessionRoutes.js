const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const { requireDeviceOrAdminAuth } = require('../middlewares/authMiddleware');

// Session lifecycle & synchronization
router.post('/start', requireDeviceOrAdminAuth, sessionController.startSession);
router.post('/heartbeat', requireDeviceOrAdminAuth, sessionController.heartbeat);
router.post('/stop', requireDeviceOrAdminAuth, sessionController.stopSession);
router.post('/events/batch', requireDeviceOrAdminAuth, sessionController.recordBatchEvents);

// Session queries
router.get('/:sessionId', sessionController.getSession);
router.get('/', sessionController.listSessions);

module.exports = router;
