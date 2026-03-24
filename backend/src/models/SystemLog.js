const mongoose = require('mongoose');

const SystemLogSchema = new mongoose.Schema({
  projectId: {
    type: String,
    required: [true, 'projectId is required'],
    trim: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  method: {
    type: String,
    required: [true, 'HTTP method is required'],
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']
  },
  url: {
    type: String,
    required: [true, 'URL is required'],
    trim: true
  },
  queryParams: {
    type: Object,
    default: {}
  },
  body: {
    type: Object,
    default: {}
  },
  headers: {
    userAgent: { type: String, default: '' },
    contentType: { type: String, default: '' },
    referer: { type: String, default: '' }
  },
  ip: {
    type: String,
    required: [true, 'IP address is required'],
    index: true
  },
  responseCode: {
    type: Number,
    default: null
  },
  processingTimeMs: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  collection: 'systemlogs'
});

module.exports = mongoose.model('SystemLog', SystemLogSchema);
