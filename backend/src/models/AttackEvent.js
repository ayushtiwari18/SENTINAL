const mongoose = require('mongoose');

// ── NEW: Geo-IP sub-schema ────────────────────────────────────────────────────
const GeoIntelSchema = new mongoose.Schema({
  country:                { type: String,  default: 'Unknown' },
  country_code:           { type: String,  default: 'XX' },
  region:                 { type: String,  default: '' },
  city:                   { type: String,  default: '' },
  latitude:               { type: Number,  default: 0 },
  longitude:              { type: Number,  default: 0 },
  isp:                    { type: String,  default: '' },
  org:                    { type: String,  default: '' },
  asn:                    { type: String,  default: '' },
  is_proxy:               { type: Boolean, default: false },
  is_hosting:             { type: Boolean, default: false },
  is_tor:                 { type: Boolean, default: false },
  is_whitelisted:         { type: Boolean, default: false },
  abuse_confidence_score: { type: Number,  default: 0, min: 0, max: 100 },
  total_reports:          { type: Number,  default: 0 },
  last_reported_at:       { type: Date,    default: null },
}, { _id: false });
// ─────────────────────────────────────────────────────────────────────────────

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
  },
  // ── NEW: embedded Geo-IP intelligence ──────────────────────────────────────
  geoIntel: {
    type: GeoIntelSchema,
    default: null
  }
  // ───────────────────────────────────────────────────────────────────────────
}, {
  timestamps: true,
  collection: 'attackevents'
});

// ── NEW: compound index for country-based queries (heatmap API) ──────────────
AttackEventSchema.index({ 'geoIntel.country_code': 1, createdAt: -1 });
AttackEventSchema.index({ 'geoIntel.abuse_confidence_score': -1 });
// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model('AttackEvent', AttackEventSchema);
