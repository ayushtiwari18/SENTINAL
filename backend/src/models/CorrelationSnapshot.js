/**
 * CorrelationSnapshot — persists each /api/gemini/correlate result
 * so we can trend riskScore over time on the dashboard.
 */
const mongoose = require('mongoose');

const CorrelationSnapshotSchema = new mongoose.Schema({
  riskScore:    { type: Number, required: true, min: 0, max: 100 },
  summary:      { type: String, default: '' },
  attackCount:  { type: Number, default: 0 },
  campaignCount:{ type: Number, default: 0 },
  generated:    { type: Boolean, default: false },
  createdAt:    { type: Date, default: Date.now, index: true },
}, { versionKey: false });

// Keep at most 100 snapshots to avoid unbounded growth
CorrelationSnapshotSchema.post('save', async function () {
  const count = await this.constructor.countDocuments();
  if (count > 100) {
    const oldest = await this.constructor.find().sort({ createdAt: 1 }).limit(count - 100);
    const ids = oldest.map(d => d._id);
    await this.constructor.deleteMany({ _id: { $in: ids } });
  }
});

module.exports = mongoose.model('CorrelationSnapshot', CorrelationSnapshotSchema);
