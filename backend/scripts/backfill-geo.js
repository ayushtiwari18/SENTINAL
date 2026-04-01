/**
 * SENTINAL — Geo-IP Backfill Script
 * ===================================
 * Enriches ALL existing AttackEvent docs that have null geoIntel.
 *
 * Usage (from SENTINAL root):
 *   cd backend && node scripts/backfill-geo.js
 *
 * Options:
 *   DRY_RUN=true node scripts/backfill-geo.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose    = require('mongoose');
const axios       = require('axios');
const AttackEvent = require('../src/models/AttackEvent');

const DRY_RUN = process.env.DRY_RUN === 'true';
const sleep   = ms => new Promise(r => setTimeout(r, ms));

const PRIVATE = ['127.', '10.', '192.168.', '172.16.', '172.17.',
  '172.18.', '172.19.', '172.2', '172.3', '::1', 'fc', 'fd', 'fe80', '0.'];
const isPrivate = ip => !ip || ip === 'unknown' || PRIVATE.some(p => ip.startsWith(p));

async function lookupBatch(ips) {
  try {
    const body = ips.map(ip => ({
      query: ip,
      fields: 'status,country,countryCode,regionName,city,lat,lon,isp,org,as,proxy,hosting,query'
    }));
    const { data } = await axios.post('http://ip-api.com/batch', body, { timeout: 10000 });
    const map = {};
    for (const r of data) {
      if (r.status === 'success') {
        map[r.query] = {
          country:      r.country     || 'Unknown',
          country_code: r.countryCode || 'XX',
          region:       r.regionName  || '',
          city:         r.city        || '',
          latitude:     r.lat         || 0,
          longitude:    r.lon         || 0,
          isp:          r.isp         || '',
          org:          r.org         || '',
          asn:          r.as          || '',
          is_proxy:     r.proxy       || false,
          is_hosting:   r.hosting     || false,
          is_tor:            false,
          is_whitelisted:    false,
          abuse_confidence_score: 0,
          total_reports:     0,
          last_reported_at:  null,
        };
      }
    }
    return map;
  } catch (err) {
    console.error('  [BATCH ERROR]', err.message);
    return {};
  }
}

async function main() {
  console.log('\n🌍 SENTINAL Geo-IP Backfill');
  console.log('===========================');
  if (DRY_RUN) console.log('  ⚠️  DRY RUN — no writes\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('  ✅ MongoDB connected');

  const total = await AttackEvent.countDocuments({ geoIntel: null });
  console.log(`  📊 ${total} AttackEvents missing geo data\n`);

  if (total === 0) {
    console.log('  ✅ All records already have geo data!');
    await mongoose.disconnect();
    return;
  }

  let updated = 0, failed = 0;

  const docs = await AttackEvent.find({ geoIntel: null }).select('_id ip').lean();

  // Private IPs — mark as local immediately
  const privateDocs = docs.filter(d => isPrivate(d.ip));
  for (const d of privateDocs) {
    if (!DRY_RUN) {
      await AttackEvent.updateOne({ _id: d._id }, { $set: { geoIntel: {
        country: 'Private/Local', country_code: 'LO', region: '', city: '',
        latitude: 0, longitude: 0, isp: 'Local Network', org: '', asn: '',
        is_proxy: false, is_hosting: false, is_tor: false, is_whitelisted: false,
        abuse_confidence_score: 0, total_reports: 0, last_reported_at: null,
      }}});
    }
    updated++;
  }
  if (privateDocs.length) console.log(`  ✅ ${privateDocs.length} private/local IPs marked`);

  // Public IPs — batch through ip-api.com
  const publicDocs = docs.filter(d => !isPrivate(d.ip));
  const uniqueIPs  = [...new Set(publicDocs.map(d => d.ip))];

  for (let i = 0; i < uniqueIPs.length; i += 100) {
    const chunk  = uniqueIPs.slice(i, i + 100);
    console.log(`  🔍 Batch ${Math.floor(i / 100) + 1}: ${chunk.length} IPs... (${updated}/${total} done)`);

    const geoMap = await lookupBatch(chunk);

    for (const d of publicDocs.filter(d => chunk.includes(d.ip))) {
      const geo = geoMap[d.ip];
      if (geo) {
        if (!DRY_RUN) await AttackEvent.updateOne({ _id: d._id }, { $set: { geoIntel: geo } });
        else console.log(`    [DRY] ${d.ip} → ${geo.country} (${geo.country_code})`);
        updated++;
      } else {
        if (!DRY_RUN) await AttackEvent.updateOne({ _id: d._id }, { $set: { geoIntel: {
          country: 'Unknown', country_code: 'XX', region: '', city: '',
          latitude: 0, longitude: 0, isp: '', org: '', asn: '',
          is_proxy: false, is_hosting: false, is_tor: false, is_whitelisted: false,
          abuse_confidence_score: 0, total_reports: 0, last_reported_at: null,
        }}});
        failed++;
      }
    }

    // ip-api.com free tier: 45 batch req/min → 1.4s between calls
    if (i + 100 < uniqueIPs.length) await sleep(1400);
  }

  console.log('\n===========================');
  console.log('🏁 Backfill complete!');
  console.log(`   Updated  : ${updated}`);
  console.log(`   Fallbacks: ${failed}`);
  if (DRY_RUN) console.log('\n  ⚠️  DRY RUN — rerun without DRY_RUN=true to apply.');

  await mongoose.disconnect();
  console.log('  🔌 Disconnected\n');
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
