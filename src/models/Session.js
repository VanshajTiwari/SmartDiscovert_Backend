const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  deviceId: { 
    type: String, 
    required: true, 
    index: true 
  },
  state: { 
    type: String, 
    enum: ['IDLE', 'RUNNING', 'PAUSED', 'STOPPED', 'ERROR'], 
    default: 'IDLE',
    index: true
  },
  rightCount: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  leftCount: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  totalCount: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  durationSeconds: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  startedAt: { 
    type: Date, 
    default: Date.now,
    index: true 
  },
  endedAt: { 
    type: Date 
  },
  stopReason: { 
    type: String 
  }
}, { 
  timestamps: true 
});

// Auto calculate totalCount if rightCount or leftCount change
sessionSchema.pre('save', function (next) {
  if (this.isModified('rightCount') || this.isModified('leftCount')) {
    this.totalCount = (this.rightCount || 0) + (this.leftCount || 0);
  }
  next();
});

module.exports = mongoose.model('Session', sessionSchema);
