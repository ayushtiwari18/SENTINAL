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
 *   pm2 logs sentinal-gateway              # tail one service
 *   pm2 monit                              # live CPU/memory dashboard
 *   pm2 save                               # save process list
 *   pm2 startup                            # auto-start on server reboot
 *
 * FIRST TIME SETUP:
 *   npm install -g pm2
 *   cp .env.example .env    # then fill in your values
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup             # follow the printed command
 *
 * ENV VARS: all services read from root /.env automatically.
 * See config/envValidator.js for required variables.
 */

'use strict';

const path = require('path');
const root  = __dirname;   // SENTINAL/ project root

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
      restart_delay: 3000,      // ms between restarts
      env: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
      // Log files (relative to root)
      out_file:  path.join(root, 'logs', 'gateway.out.log'),
      error_file: path.join(root, 'logs', 'gateway.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // Health check — PM2 will restart if endpoint stops responding
      // (requires pm2-health or manual check in stop.sh)
    },

    // ── 2. Detection Engine (Python / FastAPI / Uvicorn) ───────────────────
    {
      name:         'sentinal-detection',
      script:       'python3',
      args:         '-m uvicorn app.main:app --host 0.0.0.0 --port ${DETECTION_PORT:-8002} --no-access-log',
      cwd:          path.join(root, 'services', 'detection-engine'),
      interpreter:  'none',     // tell PM2 not to wrap in node
      instances:    1,
      exec_mode:    'fork',
      watch:        false,
      autorestart:  true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PYTHONUNBUFFERED: '1',   // force Python stdout to flush immediately
      },
      env_development: {
        NODE_ENV: 'development',
        PYTHONUNBUFFERED: '1',
      },
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
      env: {
        NODE_ENV: 'production',
        PYTHONUNBUFFERED: '1',
      },
      env_development: {
        NODE_ENV: 'development',
        PYTHONUNBUFFERED: '1',
      },
      out_file:   path.join(root, 'logs', 'pcap.out.log'),
      error_file: path.join(root, 'logs', 'pcap.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ── 4. ArmorIQ Agent (Python / FastAPI / Uvicorn) ─────────────────────
    {
      name:         'sentinal-armoriq',
      script:       'python3',
      args:         '-m uvicorn main:app --host 0.0.0.0 --port ${ARMORIQ_PORT:-8004} --no-access-log',
      cwd:          path.join(root, 'services', 'armoriq-agent'),
      interpreter:  'none',
      instances:    1,
      exec_mode:    'fork',
      watch:        false,
      autorestart:  true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PYTHONUNBUFFERED: '1',
      },
      env_development: {
        NODE_ENV: 'development',
        PYTHONUNBUFFERED: '1',
      },
      out_file:   path.join(root, 'logs', 'armoriq.out.log'),
      error_file: path.join(root, 'logs', 'armoriq.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

  ],
};
