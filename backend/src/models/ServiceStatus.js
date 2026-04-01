const mongoose = require('mongoose');

const ServiceStatusSchema = new mongoose.Schema({
  serviceName: {
    type: String,
    required: [true, 'Service name is required'],
    enum: ['gateway', 'detection-engine', 'pcap-processor', 'sentinal-response-engine'],
    unique: true
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: ['online', 'offline', 'degraded', 'unknown'],
    default: 'unknown'
  },
  lastChecked: {
    type: Date,
    default: Date.now
  },
  responseTimeMs: {
    type: Number,
    default: 0
  },
  errorMessage: {
    type: String,
    default: ''
  },
  meta: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true,
  collection: 'servicestatuses'
});

module.exports = mongoose.model('ServiceStatus', ServiceStatusSchema);
