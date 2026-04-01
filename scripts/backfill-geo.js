/**
 * SENTINAL — Geo-IP Backfill Script
 * ===================================
 * One-time script to enrich ALL existing AttackEvent documents
 * that have a null/missing geoIntel field.
 *
 * It calls the ip-api.com batch API directly (no Detection Engine needed)
 * so you can run this even while services are stopped.
 *
 * Usage:
 *   cd /path/to/SENTINAL
 *   node scripts/backfill-geo.js
 *
 * Options (env vars):
 *   DRY_RUN=true     — print what would be updated, don't write to DB
 *   BATCH=100        — IPs per ip-api.com batch request (max 100)
 *   ABUSEIPDB_API_KEY=xxx  — optional, adds abuse scores
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose   = require('mongoose');
const axios      = require('axios');
const AttackEvent = require('../backend/src/models/AttackEvent');

const DRY_RUN    = process.env.DRY_RUN === 'true';
const BATCH_SIZE = parseInt(process.env.BATCH || '100', 10);
const ABUSE_KEY  = process.env.ABUSEIPDB_API_KEY || '';

// ── Private IP guard ────────────────────────────────────────────────────────
const PRIVATE_PREFIXES = ['127.', '10.', '192.168.', '172.16.', '172.17.',
  '172.18.', '172.19.', '172.2', '172.3', '::1', 'fc', 'fd', 'fe80', '0.'];

function isPrivate(ip) {
  return !ip || ip === 'unknown' || PRIVATE_PREFIXES.some(p => ip.startsWith(p));
}

function privatePlaceholder(ip) {
  return {
    country: 'Private/Local', country_code: 'LO', region: '', city: '',
    latitude: 0, longitude: 0, isp: 'Local Network', org: '', asn: '',
    is_proxy: false, is_hosting: false, is_tor: false, is_whitelisted: false,
    abuse_confidence_score: 0, total_reports: 0, last_reported_at: null,
  };
}

// ── ip-api.com batch lookup (up to 100 IPs per call) ────────────────────────
async function lookupBatch(ips) {
  try {
    const body = ips.map(ip => ({
      query: ip,
      fields: 'status,message,country,countryCode,regionName,city,lat,lon,isp,org,as,proxy,hosting,query'
    }));
    const { data } = await axios.post('http://ip-api.com/batch?fields=status,message,country,countryCode,regionName,city,lat,lon,isp,org,as,proxy,hosting,query', body, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });
    const map = {};
    for (const r of data) {
      if (r.status === 'success') {
        map[r.query] = {
          country:      r.country      || 'Unknown',
          country_code: r.countryCode  || 'XX',
          region:       r.regionName   || '',
          city:         r.city         || '',
          latitude:     r.lat          || 0,
          longitude:    r.lon          || 0,
          isp:          r.isp          || '',
          org:          r.org          || '',
          asn:          r.as           || '',
          is_proxy:     r.proxy        || false,
          is_hosting:   r.hosting      || false,
          is_tor:       false,
          is_whitelisted: false,
          abuse_confidence_score: 0,
          total_reports: 0,
          last_reported_at: null,
        };
      }
    }
    return map;
  } catch (err) {
    console.error(`  [BATCH] ip-api.com error: ${err.message}`);
    return {};
  }
}

// ── AbuseIPDB single lookup ─────────────────────────────────────────────────
async function lookupAbuse(ip) {
  if (!ABUSE_KEY) return {};
  try {
    const { data } = await axios.get('https://api.abuseipdb.com/api/v2/check', {
      headers: { Key: ABUSE_KEY, Accept: 'application/json' },
      params:  { ipAddress: ip, maxAgeInDays: '90' },
      timeout: 5000,
    });
    const d = data.data || {};
    return {
      abuse_confidence_score: d.abuseConfidenceScore || 0,
      total_reports:          d.totalReports         || 0,
      last_reported_at:       d.lastReportedAt       || null,
      is_tor:                 d.isTor                || false,
      is_whitelisted:         d.isWhitelisted        || false,
    };
  } catch { return {}; }
}

// ── Sleep helper (rate limiting) ─────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🌍 SENTINAL Geo-IP Backfill Script');
  console.log('====================================');
  if (DRY_RUN) console.log('  ⚠️  DRY RUN mode — no writes to DB\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('  ✅ MongoDB connected\n');

  // Find all docs missing geoIntel
  const total = await AttackEvent.countDocuments({ geoIntel: null });
  console.log(`  📊 Found ${total} AttackEvents without geo data\n`);

  if (total === 0) {
    console.log('  ✅ Nothing to backfill — all records already have geo data!');
    await mongoose.disconnect();
    return;
  }

  let processed = 0;
  let updated   = 0;
  let failed    = 0;
  const PAGE    = 500;  // MongoDB fetch page size

  while (processed < total) {
    // Fetch a page of docs missing geoIntel
    const docs = await AttackEvent
      .find({ geoIntel: null })
      .select('_id ip')
      .limit(PAGE)
      .lean();

    if (docs.length === 0) break;

    // Separate private vs public IPs
    const privateDocs = docs.filter(d => isPrivate(d.ip));
    const publicDocs  = docs.filter(d => !isPrivate(d.ip));

    // ── Handle private IPs immediately ─────────────────────────────────────
    for (const doc of privateDocs) {
      if (!DRY_RUN) {
        await AttackEvent.updateOne(
          { _id: doc._id },
          { $set: { geoIntel: privatePlaceholder(doc.ip) } }
        );
      }
      updated++;
    }

    // ── Batch public IPs through ip-api.com ────────────────────────────────
    const uniquePublicIPs = [...new Set(publicDocs.map(d => d.ip))];

    for (let i = 0; i < uniquePublicIPs.length; i += BATCH_SIZE) {
      const chunk = uniquePublicIPs.slice(i, i + BATCH_SIZE);
      console.log(`  🔍 Looking up ${chunk.length} IPs (${processed + updated} / ${total})...`);

      const geoMap = await lookupBatch(chunk);

      // Optionally enrich with AbuseIPDB (1 call per IP — be mindful of rate limit)
      if (ABUSE_KEY) {
        for (const ip of chunk) {
          if (geoMap[ip]) {
            const abuse = await lookupAbuse(ip);
            Object.assign(geoMap[ip], abuse);
            await sleep(100); // ~10 req/s to stay under free tier
          }
        }
      }

      // Write back to all matching docs
      for (const doc of publicDocs.filter(d => chunk.includes(d.ip))) {
        const geo = geoMap[doc.ip];
        if (geo) {
          if (!DRY_RUN) {
            await AttackEvent.updateOne(
              { _id: doc._id },
              { $set: { geoIntel: geo } }
            );
          } else {
            console.log(`    [DRY] ${doc.ip} → ${geo.country} (${geo.country_code})`);
          }
          updated++;
        } else {
          // ip-api.com failed for this IP — store a fallback
          if (!DRY_RUN) {
            await AttackEvent.updateOne(
              { _id: doc._id },
              { $set: { geoIntel: {
                country: 'Unknown', country_code: 'XX',
                region: '', city: '', latitude: 0, longitude: 0,
                isp: '', org: '', asn: '',
                is_proxy: false, is_hosting: false, is_tor: false,
                is_whitelisted: false, abuse_confidence_score: 0,
                total_reports: 0, last_reported_at: null,
              }}}
            );
          }
          failed++;
        }
      }

      // ip-api.com free tier: 45 batch requests/min → ~1.3s between calls
      await sleep(1400);
    }

    processed += docs.length;
    console.log(`  ✅ Progress: ${updated} updated, ${failed} fallbacks\n`);
  }

  console.log('\n====================================');
  console.log(`  🏁 Backfill complete!`);
  console.log(`     Updated : ${updated}`);
  console.log(`     Fallbacks: ${failed}`);
  console.log(`     Total   : ${total}`);
  if (DRY_RUN) console.log('\n  ⚠️  DRY RUN — no data was written. Remove DRY_RUN=true to apply.');

  await mongoose.disconnect();
  console.log('  🔌 MongoDB disconnected\n');
}

main().catch(err => {
  console.error('\n❌ Backfill failed:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
