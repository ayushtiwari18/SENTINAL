const mongoose = require('mongoose');

const ActionQueueSchema = new mongoose.Schema(
  {
    // Store as plain String so test/mock IDs (non-ObjectId) don't cause cast errors
    attackId: {
      type: String,
      required: true,
      index: true
    },
    action: {
      type: String,
      required: true,
      enum: [
        'permanent_ban_ip',
        'shutdown_endpoint',
        'purge_all_sessions',
        'modify_firewall_rules'
      ]
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'executed'],
      default: 'pending',
      index: true
    },
    agentReason:   { type: String, default: '' },
    blockedReason: { type: String, default: '' },
    ip:            { type: String, default: '' },
    // FIX: attackType and severity were missing — frontend ActionQueue.jsx renders these fields.
    // Without them the schema strips them on save and they come back undefined,
    // causing SeverityBadge to receive undefined and potentially throw a silent render error.
    attackType:    { type: String, default: null },
    severity:      { type: String, default: null },
    approvedBy:    { type: String, default: null },
    approvedAt:    { type: Date,   default: null },
    executedAt:    { type: Date,   default: null }
  },
  {
    timestamps: true,
    collection: 'action_queue'
  }
);

module.exports = mongoose.model('ActionQueue', ActionQueueSchema);
