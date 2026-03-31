const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    intent_id:         { type: String, default: null },
    action:            { type: String, required: true },
    status:            {
      type: String,
      enum: ['ALLOWED', 'BLOCKED', 'APPROVED', 'REJECTED'],
      required: true,
      index: true
    },
    reason:            { type: String, default: '' },
    policy_rule_id:    { type: String, default: '' },
    enforcement_level: { type: String, default: 'Nexus-Policy-v1' },
    triggeredBy:       {
      type: String,
      enum: ['agent', 'human'],
      default: 'agent'
    },
    ip:       { type: String, default: '' },
    // Store attackId as plain String — avoids ObjectId cast errors when
    // Nexus sends a test/mock ID that is not a real AttackEvent document
    attackId: { type: String, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: true,
    collection: 'audit_log'
  }
);

module.exports = mongoose.model('AuditLog', AuditLogSchema);
