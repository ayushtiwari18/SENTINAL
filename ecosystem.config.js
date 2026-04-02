/**
 * ecosystem.config.js — PM2 Process Manager Configuration
 * =========================================================
 * Manages all 4 SENTINAL services as a single process group.
 *
 * USAGE:
 *   pm2 start ecosystem.config.js          # start all services
 *   pm2 stop ecosystem.config.js           # stop all services
 *   pm2 restart ecosystem.config.js        # restart all services
 *   pm2 reload ecosystem.config.js         # zero-downtime reload
 *   pm2 delete ecosystem.config.js         # stop + remove from PM2
 *   pm2 logs                               # tail all logs
 *   pm2 monit                              # live CPU/memory dashboard
 *   pm2 save                               # save process list
 *   pm2 startup                            # auto-start on server reboot
 */

'use strict';

const path = require('path');
const root  = __dirname;

module.exports = {
  apps: [

    // ── 1. Gateway (Node.js / Express) ─────────────────────────────────────
    {
      name:         'sentinal-gateway',
      script:       path.join(root, 'backend', 'server.js'),
      cwd:          path.join(root, 'backend'),
      instances:    1,
      exec_mode:    'fork',
      watch:        false,
      autorestart:  true,
      max_restarts: 10,
      restart_delay: 3000,
      env: { NODE_ENV: 'production' },
      env_development: { NODE_ENV: 'development' },
      out_file:  path.join(root, 'logs', 'gateway.out.log'),
      error_file: path.join(root, 'logs', 'gateway.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ── 2. Detection Engine (Python / FastAPI / Uvicorn) ───────────────────
    {
      name:         'sentinal-detection',
      script:       'python3',
      args:         '-m uvicorn app.main:app --host 0.0.0.0 --port ${DETECTION_PORT:-8002} --no-access-log',
      cwd:          path.join(root, 'services', 'detection-engine'),
      interpreter:  'none',
      instances:    1,
      exec_mode:    'fork',
      watch:        false,
      autorestart:  true,
      max_restarts: 10,
      restart_delay: 3000,
      env: { NODE_ENV: 'production', PYTHONUNBUFFERED: '1' },
      env_development: { NODE_ENV: 'development', PYTHONUNBUFFERED: '1' },
      out_file:   path.join(root, 'logs', 'detection.out.log'),
      error_file: path.join(root, 'logs', 'detection.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ── 3. PCAP Processor (Python / FastAPI / Uvicorn) ────────────────────
    {
      name:         'sentinal-pcap',
      script:       'python3',
      args:         '-m uvicorn main:app --host 0.0.0.0 --port ${PCAP_PORT:-8003} --no-access-log',
      cwd:          path.join(root, 'services', 'pcap-processor'),
      interpreter:  'none',
      instances:    1,
      exec_mode:    'fork',
      watch:        false,
      autorestart:  true,
      max_restarts: 10,
      restart_delay: 3000,
      env: { NODE_ENV: 'production', PYTHONUNBUFFERED: '1' },
      env_development: { NODE_ENV: 'development', PYTHONUNBUFFERED: '1' },
      out_file:   path.join(root, 'logs', 'pcap.out.log'),
      error_file: path.join(root, 'logs', 'pcap.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ── 4. Nexus Agent (Python / FastAPI / Uvicorn) ───────────────────────
    {
      name:         'sentinal-nexus',
      script:       'python3',
      args:         '-m uvicorn main:app --host 0.0.0.0 --port ${NEXUS_PORT:-8004} --no-access-log',
      cwd:          path.join(root, 'services', 'nexus-agent'),
      interpreter:  'none',
      instances:    1,
      exec_mode:    'fork',
      watch:        false,
      autorestart:  true,
      max_restarts: 10,
      restart_delay: 3000,
      env: { NODE_ENV: 'production', PYTHONUNBUFFERED: '1' },
      env_development: { NODE_ENV: 'development', PYTHONUNBUFFERED: '1' },
      out_file:   path.join(root, 'logs', 'nexus.out.log'),
      error_file: path.join(root, 'logs', 'nexus.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

  ],
};
