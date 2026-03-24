const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  attackId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AttackEvent',
    required: [true, 'attackId reference is required'],
    index: true
  },
  title: {
    type: String,
    required: [true, 'Alert title is required'],
    trim: true
  },
  message: {
    type: String,
    required: [true, 'Alert message is required'],
    trim: true
  },
  severity: {
    type: String,
    required: [true, 'Severity is required'],
    enum: ['low', 'medium', 'high', 'critical']
  },
  type: {
    type: String,
    required: [true, 'Alert type is required'],
    enum: ['attack_detected', 'service_down', 'rate_limit', 'anomaly']
  },
  isRead: {
    type: Boolean,
    default: false
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  meta: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true,
  collection: 'alerts'
});

module.exports = mongoose.model('Alert', AlertSchema);
