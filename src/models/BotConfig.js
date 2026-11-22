const mongoose = require('mongoose');

const botConfigSchema = new mongoose.Schema({
  deviceId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Device', 
    required: true, 
    unique: true,
    index: true 
  },
  deviceHardwareId: {
    type: String,
    required: true,
    index: true
  },
  cycleSize: { 
    type: Number, 
    default: 10,
    min: [2, 'Cycle size must be at least 2'],
    max: [50, 'Cycle size cannot exceed 50']
  },
  maxRightsPerCycle: { 
    type: Number, 
    default: 4,
    min: [0, 'Rights per cycle cannot be negative'],
    max: [50, 'Rights cannot exceed cycle size']
  },
  maxTotalActions: { 
    type: Number, 
    default: 9999,
    min: 1 
  },
  maxRightActions: { 
    type: Number, 
    default: 9999,
    min: 0 
  },
  minStepDelayMs: { 
    type: Number, 
    default: 800,
    min: 100 
  },
  maxStepDelayMs: { 
    type: Number, 
    default: 1500,
    min: 200 
  },
  scrollDurationMs: { 
    type: Number, 
    default: 400,
    min: 100 
  },
  scrollSettleMs: { 
    type: Number, 
    default: 750,
    min: 100 
  },
  autoRestartOnCap: { 
    type: Boolean, 
    default: false 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BotConfig', botConfigSchema);
