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
      // Full set of actions that intent_builder.py can propose
      // High-risk actions go through policy BLOCK -> ActionQueue for human review
      // Low-risk actions are ALLOW -> executed directly, but included here for completeness
      enum: [
        'send_alert',
        'log_attack',
        'rate_limit_ip',
        'flag_for_review',
        'generate_report',
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
