const mongoose = require('mongoose');

const eventLogSchema = new mongoose.Schema({
  sessionId: { 
    type: String, 
    required: true, 
    index: true 
  },
  deviceId: { 
    type: String, 
    required: true, 
    index: true 
  },
  eventType: { 
    type: String, 
    enum: [
      'SESSION_STARTED', 
      'STEP_RIGHT', 
      'STEP_LEFT', 
      'STEP_SKIPPED', 
      'SESSION_STOPPED', 
      'SESSION_ERROR', 
      'CAP_REACHED'
    ],
    required: true,
    index: true
  },
  detail: { 
    type: String 
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true 
  }
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: false }
});

// Composite index for fast querying by session and timestamp
eventLogSchema.index({ sessionId: 1, timestamp: -1 });
eventLogSchema.index({ deviceId: 1, timestamp: -1 });

module.exports = mongoose.model('EventLog', eventLogSchema);
