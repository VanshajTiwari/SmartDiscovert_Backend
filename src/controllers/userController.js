const User = require('../models/User');
const Device = require('../models/Device');

/**
 * Register a new User account
 * POST /api/v1/users/register
 */
const registerUser = async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'A user with this email already exists'
      });
    }

    const apiKey = User.generateApiKey();
    const user = new User({
      email: email.toLowerCase(),
      name: name || 'Bot Operator',
      role: role === 'admin' ? 'admin' : 'user',
      apiKey
    });

    user.setPassword(password);
    await user.save();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        userId: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        apiKey: user.apiKey
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Log in with email and password
 * POST /api/v1/users/login
 */
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.validatePassword(password)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        userId: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        apiKey: user.apiKey
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user profile and linked devices
 * GET /api/v1/users/me
 */
const getProfile = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] 
      || req.headers['x-user-key'] 
      || req.headers['x-admin-key'] 
      || (req.headers.authorization ? req.headers.authorization.replace(/^Bearer /i, '') : null);

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Missing user API key'
      });
    }

    const user = await User.findOne({ apiKey }).populate('devices');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const devices = await Device.find({ userId: user._id });

    res.status(200).json({
      success: true,
      data: {
        userId: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        apiKey: user.apiKey,
        devices
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Link a device to the user account
 * POST /api/v1/users/claim-device
 */
const claimDevice = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.headers['x-user-key'];
    const { deviceId } = req.body;

    if (!apiKey) {
      return res.status(401).json({ success: false, error: 'User API key required in x-api-key header' });
    }
    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'deviceId is required' });
    }

    const user = await User.findOne({ apiKey });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const device = await Device.findOneAndUpdate(
      { deviceId },
      { userId: user._id },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found with that deviceId' });
    }

    if (!user.devices.includes(device._id)) {
      user.devices.push(device._id);
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: `Device ${deviceId} linked to account ${user.email}`,
      data: { user: user.email, device }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  getProfile,
  claimDevice
};
