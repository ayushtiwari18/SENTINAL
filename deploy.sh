#!/bin/bash
# =============================================================================
# SENTINAL — deploy.sh
# One-command full deployment for AWS Academy (fresh Ubuntu instance)
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${BLUE}[→]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }

echo -e "\n${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     SENTINAL — Auto Deploy Script v1.0       ║${NC}"
echo -e "${BOLD}║     AWS Academy Edition                      ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}\n"

info "Detecting public IP..."
PUBLIC_IP=$(curl -s --max-time 5 http://checkip.amazonaws.com || curl -s --max-time 5 https://api.ipify.org)
if [ -z "$PUBLIC_IP" ]; then
  warn "Could not auto-detect IP."
  read -p "Enter this EC2 instance's public IP: " PUBLIC_IP
fi
log "Public IP: $PUBLIC_IP"

echo -e "\n${BOLD}── STEP 1: Installing system dependencies ──${NC}"
sudo apt-get update -qq
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1
  sudo apt-get install -y nodejs > /dev/null 2>&1
fi
log "Node.js $(node --version)"
sudo apt-get install -y python3 python3-venv python3-pip python3-dev > /dev/null 2>&1
log "Python $(python3 --version)"
sudo apt-get install -y build-essential libssl-dev libffi-dev libpcap-dev > /dev/null 2>&1
if ! command -v pm2 &> /dev/null; then
  sudo npm install -g pm2 > /dev/null 2>&1
fi
log "PM2 $(pm2 --version)"
if ! command -v serve &> /dev/null; then
  sudo npm install -g serve > /dev/null 2>&1
fi
log "serve installed"

echo -e "\n${BOLD}── STEP 2: Cloning repository ──${NC}"
REPO_DIR="$HOME/SENTINAL"
if [ -d "$REPO_DIR/.git" ]; then
  cd "$REPO_DIR" && git pull origin main
else
  git clone https://github.com/ayushtiwari18/SENTINAL.git "$REPO_DIR"
fi
cd "$REPO_DIR"
log "Repo ready"

echo -e "\n${BOLD}── STEP 3: Setting up Python virtual environments ──${NC}"
setup_venv() {
  local SERVICE_DIR=$1
  local SERVICE_NAME=$2
  info "Setting up venv for $SERVICE_NAME..."
  cd "$REPO_DIR/$SERVICE_DIR"
  if [ ! -d ".venv" ]; then python3 -m venv .venv; fi
  source .venv/bin/activate
  pip install --upgrade pip -q
  pip install -r requirements.txt -q
  deactivate
  log "$SERVICE_NAME venv ready"
  cd "$REPO_DIR"
}

setup_venv "services/detection-engine" "Detection Engine"
setup_venv "services/pcap-processor"   "PCAP Processor"
setup_venv "services/nexus-agent"      "Nexus Agent"

echo -e "\n${BOLD}── STEP 4: Installing Node.js dependencies ──${NC}"
cd "$REPO_DIR/backend" && npm install --omit=dev --silent
log "Backend deps installed"
cd "$REPO_DIR/dashboard" && npm install --silent
log "Dashboard deps installed"
cd "$REPO_DIR"

echo -e "\n${BOLD}── STEP 5: Environment configuration ──${NC}"
if [ ! -f "$REPO_DIR/.env" ]; then
  cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
fi

JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
API_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
sed -i "s|PUBLIC_URL=.*|PUBLIC_URL=http://$PUBLIC_IP|g" "$REPO_DIR/.env"
sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|g" "$REPO_DIR/.env"
sed -i "s|API_SECRET=.*|API_SECRET=$API_SECRET|g" "$REPO_DIR/.env"
sed -i "s|NODE_ENV=.*|NODE_ENV=production|g" "$REPO_DIR/.env"

CURRENT_MONGO=$(grep '^MONGO_URI=' "$REPO_DIR/.env" | cut -d'=' -f2-)
if [ -z "$CURRENT_MONGO" ] || [ "$CURRENT_MONGO" = "your_mongo_uri_here" ] || [[ "$CURRENT_MONGO" == *"<"* ]]; then
  echo ""
  warn "MONGO_URI is not set. Enter it now."
  read -p "  Paste your MONGO_URI: " MONGO_URI_INPUT
  sed -i "s|MONGO_URI=.*|MONGO_URI=$MONGO_URI_INPUT|g" "$REPO_DIR/.env"
  log "MONGO_URI saved"
fi
log ".env configured"

echo -e "\n${BOLD}── STEP 6: Configuring dashboard for production ──${NC}"
cat > "$REPO_DIR/dashboard/.env.production" << EOF
VITE_API_URL=http://$PUBLIC_IP:3000
VITE_SOCKET_URL=http://$PUBLIC_IP:3000
EOF
log "dashboard/.env.production → http://$PUBLIC_IP:3000"

echo -e "\n${BOLD}── STEP 7: Building dashboard ──${NC}"
cd "$REPO_DIR/dashboard" && npm run build > /dev/null 2>&1
log "Dashboard built → dashboard/dist/"
cd "$REPO_DIR"

echo -e "\n${BOLD}── STEP 8: Writing PM2 ecosystem with venv paths ──${NC}"
cat > "$REPO_DIR/ecosystem.config.js" << 'ECOSYSTEM'
'use strict';
const path = require('path');
const root  = __dirname;

module.exports = {
  apps: [
    {
      name:         'sentinal-gateway',
      script:       path.join(root, 'backend', 'server.js'),
      cwd:          path.join(root, 'backend'),
      instances:    1, exec_mode: 'fork', watch: false, autorestart: true,
      max_restarts: 10, restart_delay: 3000,
      env: { NODE_ENV: 'production' },
      out_file:   path.join(root, 'logs', 'gateway.out.log'),
      error_file: path.join(root, 'logs', 'gateway.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name:         'sentinal-detection',
      script:       path.join(root, 'services', 'detection-engine', '.venv', 'bin', 'python3'),
      args:         '-m uvicorn app.main:app --host 0.0.0.0 --port 8002 --no-access-log',
      cwd:          path.join(root, 'services', 'detection-engine'),
      interpreter:  'none', instances: 1, exec_mode: 'fork', watch: false,
      autorestart: true, max_restarts: 10, restart_delay: 3000,
      env: { PYTHONUNBUFFERED: '1' },
      out_file:   path.join(root, 'logs', 'detection.out.log'),
      error_file: path.join(root, 'logs', 'detection.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name:         'sentinal-pcap',
      script:       path.join(root, 'services', 'pcap-processor', '.venv', 'bin', 'python3'),
      args:         '-m uvicorn main:app --host 0.0.0.0 --port 8003 --no-access-log',
      cwd:          path.join(root, 'services', 'pcap-processor'),
      interpreter:  'none', instances: 1, exec_mode: 'fork', watch: false,
      autorestart: true, max_restarts: 10, restart_delay: 3000,
      env: { PYTHONUNBUFFERED: '1' },
      out_file:   path.join(root, 'logs', 'pcap.out.log'),
      error_file: path.join(root, 'logs', 'pcap.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name:         'sentinal-nexus',
      script:       path.join(root, 'services', 'nexus-agent', '.venv', 'bin', 'python3'),
      args:         '-m uvicorn main:app --host 0.0.0.0 --port 8004 --no-access-log',
      cwd:          path.join(root, 'services', 'nexus-agent'),
      interpreter:  'none', instances: 1, exec_mode: 'fork', watch: false,
      autorestart: true, max_restarts: 10, restart_delay: 3000,
      env: { PYTHONUNBUFFERED: '1' },
      out_file:   path.join(root, 'logs', 'nexus.out.log'),
      error_file: path.join(root, 'logs', 'nexus.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
ECOSYSTEM
log "ecosystem.config.js written"

echo -e "\n${BOLD}── STEP 9: Starting all services with PM2 ──${NC}"
mkdir -p "$REPO_DIR/logs"
pm2 delete all > /dev/null 2>&1 || true
cd "$REPO_DIR"
pm2 start ecosystem.config.js
pm2 start "serve -s dist -l 5173" --name sentinal-dashboard --cwd "$REPO_DIR/dashboard"
pm2 save > /dev/null 2>&1
log "All services started"

echo -e "\n${BOLD}── STEP 10: Running health checks (waiting 8s) ──${NC}"
sleep 8

check_health() {
  local NAME=$1 URL=$2
  local STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$URL")
  [ "$STATUS" = "200" ] && log "$NAME → HTTP 200 ✓" || err "$NAME → HTTP $STATUS ✗  (pm2 logs $NAME)"
}

check_health "sentinal-gateway"   "http://localhost:3000/health"
check_health "sentinal-detection" "http://localhost:8002/health"
check_health "sentinal-pcap"      "http://localhost:8003/health"
check_health "sentinal-nexus"     "http://localhost:8004/health"

warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
warn " IMPORTANT: Update MongoDB Atlas IP Allowlist!"
warn " Network Access → Add IP Address → enter: $PUBLIC_IP"
warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -e "\n${BOLD}${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║         SENTINAL DEPLOY COMPLETE ✓           ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Dashboard:${NC}        http://$PUBLIC_IP:5173"
echo -e "  ${BOLD}Gateway API:${NC}      http://$PUBLIC_IP:3000"
echo -e "  ${BOLD}Detection Engine:${NC} http://$PUBLIC_IP:8002"
echo -e "  ${BOLD}PCAP Processor:${NC}   http://$PUBLIC_IP:8003"
echo -e "  ${BOLD}Nexus Agent:${NC}      http://$PUBLIC_IP:8004"
echo ""
echo -e "  ${BOLD}PM2 status:${NC}  pm2 list"
echo -e "  ${BOLD}View logs:${NC}   pm2 logs sentinal-nexus"
echo -e "  ${BOLD}Restart all:${NC} pm2 restart all"
echo ""
