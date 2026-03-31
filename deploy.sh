#!/bin/bash
# =============================================================================
# SENTINAL — deploy.sh
# One-command full deployment for AWS Academy (fresh Ubuntu instance)
# Run this ONCE after SSH into a new lab session.
#
# USAGE:
#   chmod +x deploy.sh && ./deploy.sh
#
# WHAT IT DOES:
#   1. Installs Node.js 20, Python 3, PM2, serve, libpcap
#   2. Clones the repo (or pulls latest if already cloned)
#   3. Creates Python venvs + installs requirements for all 3 services
#   4. Installs Node deps for backend + dashboard
#   5. Prompts you to fill in MONGO_URI, JWT_SECRET, API_SECRET
#   6. Updates dashboard .env.production with current EC2 IP
#   7. Builds dashboard
#   8. Starts all 5 services with PM2
#   9. Runs health checks
# =============================================================================

set -e  # exit on any error

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${BLUE}[→]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }

echo -e "\n${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     SENTINAL — Auto Deploy Script v1.0       ║${NC}"
echo -e "${BOLD}║     AWS Academy Edition                      ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}\n"

# ── Detect current public IP ─────────────────────────────────────────────────
info "Detecting public IP..."
PUBLIC_IP=$(curl -s --max-time 5 http://checkip.amazonaws.com || curl -s --max-time 5 https://api.ipify.org)
if [ -z "$PUBLIC_IP" ]; then
  warn "Could not auto-detect IP. You will need to enter it manually."
  read -p "Enter this EC2 instance's public IP: " PUBLIC_IP
fi
log "Public IP: $PUBLIC_IP"

# ── STEP 1: System dependencies ──────────────────────────────────────────────
echo -e "\n${BOLD}── STEP 1: Installing system dependencies ──${NC}"

info "Updating apt..."
sudo apt-get update -qq

info "Installing Node.js 20..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1
  sudo apt-get install -y nodejs > /dev/null 2>&1
  log "Node.js $(node --version) installed"
else
  log "Node.js $(node --version) already installed"
fi

info "Installing Python 3, venv, pip..."
sudo apt-get install -y python3 python3-venv python3-pip python3-dev > /dev/null 2>&1
log "Python $(python3 --version) installed"

info "Installing build tools + libpcap..."
sudo apt-get install -y build-essential libssl-dev libffi-dev libpcap-dev > /dev/null 2>&1
log "Build tools installed"

info "Installing PM2 globally..."
if ! command -v pm2 &> /dev/null; then
  sudo npm install -g pm2 > /dev/null 2>&1
  log "PM2 $(pm2 --version) installed"
else
  log "PM2 $(pm2 --version) already installed"
fi

info "Installing serve globally..."
if ! command -v serve &> /dev/null; then
  sudo npm install -g serve > /dev/null 2>&1
  log "serve installed"
else
  log "serve already installed"
fi

# ── STEP 2: Clone or update repo ─────────────────────────────────────────────
echo -e "\n${BOLD}── STEP 2: Cloning repository ──${NC}"

REPO_DIR="$HOME/SENTINAL"

if [ -d "$REPO_DIR/.git" ]; then
  info "Repo already exists — pulling latest changes..."
  cd "$REPO_DIR"
  git pull origin main
  log "Repo updated"
else
  info "Cloning SENTINAL repo..."
  git clone https://github.com/ayushtiwari18/SENTINAL.git "$REPO_DIR"
  log "Repo cloned"
fi

cd "$REPO_DIR"

# ── STEP 3: Python virtual environments ──────────────────────────────────────
echo -e "\n${BOLD}── STEP 3: Setting up Python virtual environments ──${NC}"

setup_venv() {
  local SERVICE_DIR=$1
  local SERVICE_NAME=$2
  info "Setting up venv for $SERVICE_NAME..."
  cd "$REPO_DIR/$SERVICE_DIR"
  if [ ! -d ".venv" ]; then
    python3 -m venv .venv
  fi
  source .venv/bin/activate
  pip install --upgrade pip -q
  pip install -r requirements.txt -q
  deactivate
  log "$SERVICE_NAME venv ready"
  cd "$REPO_DIR"
}

setup_venv "services/detection-engine" "Detection Engine"
setup_venv "services/pcap-processor"   "PCAP Processor"
setup_venv "services/sentinal-response-engine" "SENTINAL Response Engine"

# ── STEP 4: Node.js dependencies ─────────────────────────────────────────────
echo -e "\n${BOLD}── STEP 4: Installing Node.js dependencies ──${NC}"

info "Installing backend deps..."
cd "$REPO_DIR/backend"
npm install --omit=dev --silent
log "Backend deps installed"

info "Installing dashboard deps..."
cd "$REPO_DIR/dashboard"
npm install --silent
log "Dashboard deps installed"

cd "$REPO_DIR"

# ── STEP 5: Configure .env ────────────────────────────────────────────────────
echo -e "\n${BOLD}── STEP 5: Environment configuration ──${NC}"

if [ ! -f "$REPO_DIR/.env" ]; then
  cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
  info "Created .env from template"
fi

# Generate secrets
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
API_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Update .env with auto-detected IP and generated secrets
sed -i "s|PUBLIC_URL=.*|PUBLIC_URL=http://$PUBLIC_IP|g" "$REPO_DIR/.env"
sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|g" "$REPO_DIR/.env"
sed -i "s|API_SECRET=.*|API_SECRET=$API_SECRET|g" "$REPO_DIR/.env"
sed -i "s|NODE_ENV=.*|NODE_ENV=production|g" "$REPO_DIR/.env"

# Check if MONGO_URI is already set
CURRENT_MONGO=$(grep '^MONGO_URI=' "$REPO_DIR/.env" | cut -d'=' -f2-)

if [ -z "$CURRENT_MONGO" ] || [ "$CURRENT_MONGO" = "your_mongo_uri_here" ] || [[ "$CURRENT_MONGO" == *"<"* ]]; then
  echo ""
  warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  warn " MONGO_URI is not set. You need to enter it now."
  warn " Get it from: MongoDB Atlas → Connect → Drivers"
  warn " Format: mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/sentinal"
  warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  read -p "  Paste your MONGO_URI: " MONGO_URI_INPUT
  sed -i "s|MONGO_URI=.*|MONGO_URI=$MONGO_URI_INPUT|g" "$REPO_DIR/.env"
  log "MONGO_URI saved"
else
  log "MONGO_URI already set — skipping"
fi

log ".env configured (PUBLIC_URL, JWT_SECRET, API_SECRET auto-set)"

# ── STEP 6: Dashboard .env.production ────────────────────────────────────────
echo -e "\n${BOLD}── STEP 6: Configuring dashboard for production ──${NC}"

cat > "$REPO_DIR/dashboard/.env.production" << EOF
VITE_API_URL=http://$PUBLIC_IP:3000
VITE_SOCKET_URL=http://$PUBLIC_IP:3000
EOF

log "dashboard/.env.production set to http://$PUBLIC_IP:3000"

# ── STEP 7: Build dashboard ───────────────────────────────────────────────────
echo -e "\n${BOLD}── STEP 7: Building dashboard ──${NC}"

info "Running npm run build..."
cd "$REPO_DIR/dashboard"
npm run build > /dev/null 2>&1
log "Dashboard built → dashboard/dist/"

cd "$REPO_DIR"

# ── STEP 8: Update ecosystem.config.js with venv paths ───────────────────────
# ecosystem.config.js uses system python3 — venvs are activated via PATH
# PM2 needs VIRTUAL_ENV + PATH set in env for each Python service

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
      instances:    1,
      exec_mode:    'fork',
      watch:        false,
      autorestart:  true,
      max_restarts: 10,
      restart_delay: 3000,
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
      interpreter:  'none',
      instances:    1,
      exec_mode:    'fork',
      watch:        false,
      autorestart:  true,
      max_restarts: 10,
      restart_delay: 3000,
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
      interpreter:  'none',
      instances:    1,
      exec_mode:    'fork',
      watch:        false,
      autorestart:  true,
      max_restarts: 10,
      restart_delay: 3000,
      env: { PYTHONUNBUFFERED: '1' },
      out_file:   path.join(root, 'logs', 'pcap.out.log'),
      error_file: path.join(root, 'logs', 'pcap.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name:         'sentinal-Nexus',
      script:       path.join(root, 'services', 'sentinal-response-engine', '.venv', 'bin', 'python3'),
      args:         '-m uvicorn main:app --host 0.0.0.0 --port 8004 --no-access-log',
      cwd:          path.join(root, 'services', 'sentinal-response-engine'),
      interpreter:  'none',
      instances:    1,
      exec_mode:    'fork',
      watch:        false,
      autorestart:  true,
      max_restarts: 10,
      restart_delay: 3000,
      env: { PYTHONUNBUFFERED: '1' },
      out_file:   path.join(root, 'logs', 'Nexus.out.log'),
      error_file: path.join(root, 'logs', 'Nexus.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
ECOSYSTEM

log "ecosystem.config.js written with absolute venv Python paths"

# ── STEP 9: Start all services with PM2 ──────────────────────────────────────
echo -e "\n${BOLD}── STEP 9: Starting all services with PM2 ──${NC}"

mkdir -p "$REPO_DIR/logs"

# Stop any existing PM2 processes cleanly
pm2 delete all > /dev/null 2>&1 || true

info "Starting 4 backend services..."
cd "$REPO_DIR"
pm2 start ecosystem.config.js

info "Starting dashboard..."
pm2 start "serve -s dist -l 5173" --name sentinal-dashboard --cwd "$REPO_DIR/dashboard"

pm2 save > /dev/null 2>&1
log "All services started and saved"

# ── STEP 10: Health checks ────────────────────────────────────────────────────
echo -e "\n${BOLD}── STEP 10: Running health checks (waiting 8s for startup) ──${NC}"
sleep 8

check_health() {
  local NAME=$1
  local URL=$2
  local STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$URL")
  if [ "$STATUS" = "200" ]; then
    log "$NAME → HTTP 200 ✓"
  else
    err "$NAME → HTTP $STATUS ✗  (check: pm2 logs $NAME)"
  fi
}

check_health "sentinal-gateway"   "http://localhost:3000/health"
check_health "sentinal-detection" "http://localhost:8002/health"
check_health "sentinal-pcap"      "http://localhost:8003/health"
check_health "sentinal-Nexus"   "http://localhost:8004/health"

# ── STEP 11: Update MongoDB Atlas IP allowlist reminder ──────────────────────
echo ""
warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
warn " IMPORTANT: Update MongoDB Atlas IP Allowlist!"
warn " Go to: https://cloud.mongodb.com"
warn " Network Access → Add IP Address → enter: $PUBLIC_IP"
warn " Delete any old IP entries."
warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Done ─────────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║         SENTINAL DEPLOY COMPLETE ✓           ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Dashboard:${NC}        http://$PUBLIC_IP:5173"
echo -e "  ${BOLD}Gateway API:${NC}      http://$PUBLIC_IP:3000"
echo -e "  ${BOLD}Detection Engine:${NC} http://$PUBLIC_IP:8002"
echo -e "  ${BOLD}PCAP Processor:${NC}   http://$PUBLIC_IP:8003"
echo -e "  ${BOLD}Response Engine:${NC}  http://$PUBLIC_IP:8004"
echo ""
echo -e "  ${BOLD}PM2 status:${NC}  pm2 list"
echo -e "  ${BOLD}View logs:${NC}   pm2 logs sentinal-gateway"
echo -e "  ${BOLD}Restart all:${NC} pm2 restart all"
echo ""
