const mongoose = require('mongoose');

const ActionQueueSchema = new mongoose.Schema(
  {
    attackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttackEvent',
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
