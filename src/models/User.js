const mongoose = require('mongoose');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    lowercase: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    index: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  salt: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
    index: true
  },
  apiKey: {
    type: String,
    unique: true,
    index: true
  },
  devices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device'
  }]
}, {
  timestamps: true
});

/**
 * Hash and salt password using Node's native crypto scrypt
 */
userSchema.methods.setPassword = function (password) {
  this.salt = crypto.randomBytes(16).toString('hex');
  this.passwordHash = crypto.scryptSync(password, this.salt, 64).toString('hex');
};

/**
 * Validate password with constant-time equality check
 */
userSchema.methods.validatePassword = function (password) {
  const hashToVerify = crypto.scryptSync(password, this.salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(this.passwordHash, 'hex'), Buffer.from(hashToVerify, 'hex'));
};

/**
 * Generate a user-level API key
 */
userSchema.statics.generateApiKey = function () {
  return 'usr_' + crypto.randomBytes(32).toString('hex');
};

module.exports = mongoose.model('User', userSchema);
