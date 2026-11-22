const mongoose = require('mongoose');

const commandQueueSchema = new mongoose.Schema({
  deviceId: { 
    type: String, 
    required: true, 
    index: true 
  },
  command: { 
    type: String, 
    enum: ['START', 'PAUSE', 'RESUME', 'STOP', 'RESET'], 
    required: true,
    index: true 
  },
  payload: { 
    type: Object, 
    default: {} 
  },
  status: { 
    type: String, 
    enum: ['PENDING', 'SENT', 'EXECUTED', 'FAILED'], 
    default: 'PENDING',
    index: true 
  },
  resultMessage: {
    type: String
  },
  executedAt: {
    type: Date
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true 
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CommandQueue', commandQueueSchema);
