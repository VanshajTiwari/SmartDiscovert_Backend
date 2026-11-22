const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// User Registration & Authentication
router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);
router.get('/me', userController.getProfile);
router.post('/claim-device', userController.claimDevice);

module.exports = router;
