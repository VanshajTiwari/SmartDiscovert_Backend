const User = require('../models/User');
const Device = require('../models/Device');

/**
 * Seed or ensure default Super Admin exists in database
 */
const seedAdminUser = async () => {
  try {
    const adminUsername = (process.env.ADMIN_USERNAME || 'admin').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'HingeBotAdmin_Secret2026!';
    const adminKey = process.env.ADMIN_API_KEY || 'hb_admin_secret_99f2b8a071c3';

    let admin = await User.findOne({ username: adminUsername });

    if (!admin) {
      admin = new User({
        username: adminUsername,
        role: 'admin',
        apiKey: adminKey
      });
      admin.setPassword(adminPassword);
      await admin.save();
      console.log(`[Admin] Initialized Super Admin user: '${adminUsername}'`);
    } else if (admin.role !== 'admin') {
      admin.role = 'admin';
      await admin.save();
    }
    return admin;
  } catch (err) {
    console.warn(`[Admin] Seed admin warning: ${err.message}`);
    return null;
  }
};

/**
 * Register a new User account with username and password
 * POST /api/v1/users/register
 */
const registerUser = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Both username and password are required'
      });
    }

    const cleanUsername = String(username).toLowerCase().trim();

    if (cleanUsername.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Username must be at least 3 characters long'
      });
    }

    if (String(password).length < 4) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 4 characters long'
      });
    }

    const existingUser = await User.findOne({ username: cleanUsername });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: `Username '${cleanUsername}' is already taken`
      });
    }

    const apiKey = User.generateApiKey();
    const user = new User({
      username: cleanUsername,
      role: 'user',
      apiKey
    });

    user.setPassword(password);
    await user.save();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        userId: user._id,
        username: user.username,
        role: user.role,
        apiKey: user.apiKey
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Log in with username and password
 * POST /api/v1/users/login
 */
const loginUser = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Both username and password are required'
      });
    }

    const cleanUsername = String(username).toLowerCase().trim();
    const user = await User.findOne({ username: cleanUsername });

    if (!user || !user.validatePassword(password)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        userId: user._id,
        username: user.username,
        role: user.role,
        apiKey: user.apiKey,
        token: user.apiKey
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

    const user = await User.findOne({ apiKey });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const devices = await Device.find({ 
      $or: [{ userId: user._id }, { ownerUsername: user.username }] 
    });

    res.status(200).json({
      success: true,
      data: {
        userId: user._id,
        username: user.username,
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
 * Claim/link a device to the user account
 * POST /api/v1/users/claim-device
 */
const claimDevice = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.headers['x-user-key'];
    const { deviceId, username } = req.body;

    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'deviceId is required' });
    }

    let user = null;
    if (apiKey) {
      user = await User.findOne({ apiKey });
    } else if (username) {
      user = await User.findOne({ username: String(username).toLowerCase().trim() });
    }

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found. Provide valid x-api-key or username.' });
    }

    const device = await Device.findOneAndUpdate(
      { deviceId },
      { userId: user._id, ownerUsername: user.username },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({ success: false, error: `Device not found with deviceId: ${deviceId}` });
    }

    if (!user.devices.includes(device._id)) {
      user.devices.push(device._id);
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: `Device ${deviceId} linked to user ${user.username}`,
      data: { username: user.username, device }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  seedAdminUser,
  registerUser,
  loginUser,
  getProfile,
  claimDevice
};
