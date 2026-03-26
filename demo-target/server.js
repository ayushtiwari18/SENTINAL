/**
 * SENTINEL Demo Target Server
 * ----------------------------
 * A real Express app protected by sentinel-middleware.
 * Send attack payloads to this server to trigger the full
 * SENTINEL pipeline: Middleware → Gateway → Detection → ArmorIQ → Dashboard
 *
 * Port: 4000
 * Usage: node server.js
 */

const express = require('express');

// Load sentinel middleware directly from the local package
const { sentinel } = require('../services/middleware/src/adapters/express');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Mount sentinel middleware ────────────────────────────────────────────────
app.use(sentinel({
  projectId:  'demo-target',
  gatewayUrl: process.env.GATEWAY_URL || 'http://localhost:3000',
  debug:      true,   // logs every ingested request to console
}));

// ─── Normal routes (what a real app would have) ───────────────────────────────

app.get('/', (req, res) => {
  res.json({ message: 'Demo Target Server — SENTINEL protected', status: 'ok' });
});

app.get('/users', (req, res) => {
  res.json({ users: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  // intentionally vulnerable login — for demo detection purposes only
  res.json({ message: `Login attempted for user: ${username}` });
});

app.get('/search', (req, res) => {
  const q = req.query.q || '';
  res.json({ query: q, results: [] });
});

app.get('/file', (req, res) => {
  const f = req.query.name || 'readme.txt';
  res.json({ file: f, content: 'demo content' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n🎯 Demo Target Server running on http://localhost:${PORT}`);
  console.log(`🛡️  Protected by sentinel-middleware → Gateway: ${process.env.GATEWAY_URL || 'http://localhost:3000'}`);
  console.log(`\nReady to receive attacks. Check the SENTINEL Dashboard.\n`);
});
