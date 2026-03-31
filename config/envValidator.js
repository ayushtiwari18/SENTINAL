/**
 * config/envValidator.js — SENTINAL Environment Validator
 * =========================================================
 * Validates ALL required environment variables at startup.
 *
 * Called ONCE at the very beginning of server.js, before any
 * service connection or route registration.
 *
 * Behaviour:
 *   ✓ All required vars present  → logs summary and continues
 *   ✗ Any required var missing   → logs EVERY missing var, then exits
 *
 * This prevents confusing runtime errors deep in the stack
 * (e.g. "MongooseError: option uri is not supported") and instead
 * gives a clear, actionable message at startup.
 *
 * HOW TO USE:
 *   const { validateEnv } = require('../config/envValidator');
 *   validateEnv(); // call this before everything else
 */

'use strict';

// ── Required variables ───────────────────────────────────────────────────────
// These MUST be set or the system cannot function.
// Each entry: { name, description, example }
const REQUIRED_VARS = [
  {
    name: 'MONGO_URI',
    description: 'MongoDB connection string',
    example: 'mongodb+srv://user:pass@cluster.mongodb.net/sentinel'
  },
  {
    name: 'GATEWAY_PORT',
    description: 'Port for the Express Gateway to listen on',
    example: '3000'
  },
  {
    name: 'DETECTION_PORT',
    description: 'Port for the Detection Engine (Python FastAPI)',
    example: '8002'
  },
  {
    name: 'PCAP_PORT',
    description: 'Port for the PCAP Processor (Python FastAPI)',
    example: '8003'
  },
  {
    name: 'Nexus_PORT',
    description: 'Port for the SENTINAL Response Engine (Python FastAPI)',
    example: '8004'
  },
  {
    name: 'JWT_SECRET',
    description: 'Secret key for JWT token signing',
    example: 'a_long_random_string_min_32_chars'
  }
];

// ── Insecure default detection ──────────────────────────────────────────────
// These vars are required in production but allowed in development.
// System will WARN (not exit) if they are set to placeholder values.
const INSECURE_DEFAULTS = [
  { name: 'JWT_SECRET',  insecureValues: ['change_me', 'secret', 'changeme', 'change_me_to_a_long_random_secret_string'] },
  { name: 'API_SECRET',  insecureValues: ['change_me', 'secret', 'changeme', 'change_me_to_another_long_random_secret_string'] }
];

// ── Optional but recommended ──────────────────────────────────────────────
const RECOMMENDED_VARS = [
  { name: 'GEMINI_API_KEY',  description: 'Google Gemini key for Nexus AI decisions' },
  { name: 'NODE_ENV',        description: 'Runtime mode (development|production|test)' },
  { name: 'LOG_LEVEL',       description: 'Log verbosity (error|warn|info|debug)' }
];


/**
 * Validate all environment variables.
 *
 * @param {object} opts
 * @param {boolean} opts.exitOnFailure  - Default true. Set false in tests.
 * @returns {{ valid: boolean, missing: string[], warnings: string[] }}
 */
function validateEnv({ exitOnFailure = true } = {}) {
  const missing  = [];
  const warnings = [];
  const env      = process.env;

  // ── 1. Check required variables ───────────────────────────────────────────────
  for (const v of REQUIRED_VARS) {
    const value = env[v.name];
    if (!value || value.trim() === '') {
      missing.push(v.name);
    }
  }

  // ── 2. Check for insecure placeholder values (production only) ──────────────
  if (env.NODE_ENV === 'production') {
    for (const v of INSECURE_DEFAULTS) {
      const value = (env[v.name] || '').toLowerCase().trim();
      if (v.insecureValues.includes(value)) {
        warnings.push(
          `${v.name} is set to a known insecure placeholder value. ` +
          `Change it before going live.`
        );
      }
    }
  }

  // ── 3. Check recommended variables (warn only, never exit) ───────────────
  for (const v of RECOMMENDED_VARS) {
    if (!env[v.name] || env[v.name].trim() === '') {
      warnings.push(`${v.name} is not set (${v.description}) — using default`);
    }
  }

  // ── 4. Report ────────────────────────────────────────────────────────────────
  if (missing.length > 0) {
    console.error('\n');
    console.error('  ╭────────────────────────────────────────────────────────────────────────────────╮');
    console.error('  │  SENTINAL — STARTUP FAILED: Missing Environment Variables          │');
    console.error('  ╰────────────────────────────────────────────────────────────────────────────────╯');
    console.error('');
    console.error('  The following required environment variables are NOT set:\n');

    for (const name of missing) {
      const meta = REQUIRED_VARS.find(v => v.name === name);
      console.error(`  ✖  ${name}`);
      console.error(`       What it does: ${meta.description}`);
      console.error(`       Example:      ${name}=${meta.example}`);
      console.error('');
    }

    console.error('  HOW TO FIX:');
    console.error('  ─────────────────────────────────────────────────────────────────────────────');
    console.error('  1. Check that a .env file exists at the project root (SENTINAL/.env)');
    console.error('  2. Copy the template:  cp .env.example .env');
    console.error('  3. Fill in your values in .env');
    console.error('  4. Restart the server\n');

    if (exitOnFailure) {
      process.exit(1);
    }

    return { valid: false, missing, warnings };
  }

  // ── 5. All required vars present — print summary + warnings ─────────────────
  console.log('\n  [ENV] ✓ Environment validation passed');
  console.log(`  [ENV]   NODE_ENV       : ${env.NODE_ENV       || 'development (default)'}`);
  console.log(`  [ENV]   LOG_LEVEL      : ${env.LOG_LEVEL      || 'info (default)'}`);
  console.log(`  [ENV]   GATEWAY_PORT   : ${env.GATEWAY_PORT}`);
  console.log(`  [ENV]   DETECTION_PORT : ${env.DETECTION_PORT}`);
  console.log(`  [ENV]   PCAP_PORT      : ${env.PCAP_PORT}`);
  console.log(`  [ENV]   Nexus_PORT   : ${env.Nexus_PORT}`);
  console.log(`  [ENV]   MONGO_URI      : ${env.MONGO_URI ? env.MONGO_URI.replace(/:([^:@]+)@/, ':****@') : 'NOT SET'}`);
  console.log(`  [ENV]   DETECTION_URL  : ${env.DETECTION_URL  || env.DETECTION_ENGINE_URL || 'http://localhost:8002 (default)'}`);
  console.log(`  [ENV]   Nexus_URL    : ${env.Nexus_URL    || 'http://localhost:8004 (default)'}`);
  console.log(`  [ENV]   GEMINI_API_KEY : ${env.GEMINI_API_KEY ? '✓ set (hidden)' : '⚠ not set — Nexus AI features may be limited'}`);
  console.log('');

  if (warnings.length > 0) {
    console.warn('  [ENV] ⚠  Warnings:');
    for (const w of warnings) {
      console.warn(`  [ENV]    ⚠  ${w}`);
    }
    console.warn('');
  }

  return { valid: true, missing: [], warnings };
}


/**
 * Quick check: is a single variable set and non-empty?
 * Useful for feature flags inside routes.
 *
 * @example
 *   if (!isEnvSet('GEMINI_API_KEY')) {
 *     return res.status(503).json({ message: 'AI features not configured' });
 *   }
 */
function isEnvSet(name) {
  const value = process.env[name];
  return value !== undefined && value.trim() !== '';
}


module.exports = { validateEnv, isEnvSet };
