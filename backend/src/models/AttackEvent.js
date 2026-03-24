const mongoose = require('mongoose');

const AttackEventSchema = new mongoose.Schema({
  requestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SystemLog',
    required: [true, 'requestId reference is required'],
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  ip: {
    type: String,
    required: [true, 'IP address is required'],
    index: true
  },
  attackType: {
    type: String,
    required: [true, 'Attack type is required'],
    enum: ['sqli', 'xss', 'traversal', 'command_injection',
           'ssrf', 'lfi_rfi', 'brute_force', 'hpp', 'xxe',
           'webshell', 'unknown']
  },
  severity: {
    type: String,
    required: [true, 'Severity is required'],
    enum: ['low', 'medium', 'high', 'critical']
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: ['attempt', 'successful', 'blocked']
  },
  detectedBy: {
    type: String,
    required: [true, 'Detection method is required'],
    enum: ['rule', 'ml', 'both']
  },
  confidence: {
    type: Number,
    min: 0.0,
    max: 1.0,
    default: 1.0
  },
  payload: {
    type: String,
    default: ''
  },
  explanation: {
    type: String,
    default: ''
  },
  mitigationSuggestion: {
    type: String,
    default: ''
  },
  responseCode: {
    type: Number,
    default: null
  }
}, {
  timestamps: true,
  collection: 'attackevents'
});

module.exports = mongoose.model('AttackEvent', AttackEventSchema);
