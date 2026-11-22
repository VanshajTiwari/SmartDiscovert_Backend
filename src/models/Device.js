const mongoose = require('mongoose');
const crypto = require('crypto');

const deviceSchema = new mongoose.Schema({
  deviceId: { 
    type: String, 
    required: [true, 'Device ID is required'], 
    unique: true, 
    index: true,
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  ownerUsername: {
    type: String,
    lowercase: true,
    trim: true,
    index: true
  },
  name: { 
    type: String, 
    default: 'Android Device',
    trim: true 
  },
  model: { 
    type: String,
    trim: true 
  },
  androidVersion: { 
    type: String,
    trim: true 
  },
  appVersion: { 
    type: String,
    trim: true 
  },
  apiToken: { 
    type: String, 
    required: true,
    index: true 
  },
  status: { 
    type: String, 
    enum: ['OFFLINE', 'ONLINE', 'ACTIVE_SESSION'], 
    default: 'OFFLINE',
    index: true
  },
  lastSeenAt: { 
    type: Date, 
    default: Date.now 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

/**
 * Generate a secure cryptographically random API token for the device
 */
deviceSchema.statics.generateToken = function () {
  return 'hb_' + crypto.randomBytes(32).toString('hex');
};

module.exports = mongoose.model('Device', deviceSchema);
