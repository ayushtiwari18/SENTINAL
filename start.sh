#!/usr/bin/env bash
# =============================================================================
# start.sh — Start all SENTINAL services
# =============================================================================
# Usage:
#   ./start.sh              # production mode
#   ./start.sh --dev        # development mode (nodemon + uvicorn --reload)
#   ./start.sh --help
#
# What this does:
#   1. Checks required tools (node, python3, pm2)
#   2. Checks .env exists
#   3. Creates logs/ directory
#   4. Installs Node dependencies if needed
#   5. Starts all 4 services via PM2
#   6. Waits 5s then runs health checks on each service
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
LOGS_DIR="${ROOT_DIR}/logs"

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m';  YELLOW='\033[1;33m'
RED='\033[0;31m';    CYAN='\033[0;36m'
BOLD='\033[1m';      RESET='\033[0m'

log()  { echo -e "${CYAN}[SENTINAL]${RESET} $*"; }
ok()   { echo -e "${GREEN}  ✓${RESET}  $*"; }
warn() { echo -e "${YELLOW}  ⚠${RESET}  $*"; }
fail() { echo -e "${RED}  ✖${RESET}  $*"; }
die()  { fail "$*"; exit 1; }

# ── Parse args ──────────────────────────────────────────────────────────────────
DEV_MODE=false
for arg in "$@"; do
  case $arg in
    --dev)  DEV_MODE=true ;;
    --help) echo "Usage: ./start.sh [--dev]"; exit 0 ;;
  esac
done

echo ""
echo -e "${BOLD}  ╔══════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}  ║   SENTINAL — Starting All Services                  ║${RESET}"
echo -e "${BOLD}  ╚══════════════════════════════════════════════════════╝${RESET}"
echo ""

# ── 1. Check required tools ───────────────────────────────────────────────────────
log "Checking required tools..."
command -v node    &>/dev/null || die "node is not installed. Install from https://nodejs.org"
command -v python3 &>/dev/null || die "python3 is not installed."
command -v pm2     &>/dev/null || die "pm2 is not installed. Run: npm install -g pm2"
ok "node    $(node --version)"
ok "python3 $(python3 --version 2>&1 | awk '{print $2}')"
ok "pm2     $(pm2 --version)"

# ── 2. Check .env ──────────────────────────────────────────────────────────────────
log "Checking environment file..."
if [ ! -f "${ENV_FILE}" ]; then
  fail ".env file not found at: ${ENV_FILE}"
  echo ""
  echo "  Run this to create it from the template:"
  echo -e "  ${CYAN}  cp .env.example .env${RESET}"
  echo "  Then fill in your values (MONGO_URI, JWT_SECRET, etc.)"
  echo ""
  exit 1
fi
ok ".env found at ${ENV_FILE}"

# Source .env to read PORT values for health checks below
set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

GATEWAY_PORT="${GATEWAY_PORT:-3000}"
DETECTION_PORT="${DETECTION_PORT:-8002}"
PCAP_PORT="${PCAP_PORT:-8003}"
Nexus_PORT="${Nexus_PORT:-8004}"

# ── 3. Create logs directory ───────────────────────────────────────────────────────
log "Ensuring logs/ directory exists..."
mkdir -p "${LOGS_DIR}"
ok "logs/ ready"

# ── 4. Install Node dependencies if needed ─────────────────────────────────────
if [ ! -d "${ROOT_DIR}/backend/node_modules" ]; then
  log "Installing Node.js dependencies (first run)..."
  (cd "${ROOT_DIR}/backend" && npm install --production --silent)
  ok "Node modules installed"
else
  ok "Node modules already installed"
fi

# ── 5. Start all services via PM2 ───────────────────────────────────────────────
log "Starting services via PM2..."
cd "${ROOT_DIR}"

if $DEV_MODE; then
  warn "Starting in DEVELOPMENT mode"
  pm2 start ecosystem.config.js --env development
else
  pm2 start ecosystem.config.js --env production
fi

ok "PM2 started all processes"

# ── 6. Wait then health check ─────────────────────────────────────────────────────
echo ""
log "Waiting 6s for services to initialize..."
sleep 6

echo ""
log "Running health checks..."
echo ""

healthcheck() {
  local name="$1"
  local url="$2"
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${url}" 2>/dev/null || echo "000")
  if [ "${http_code}" = "200" ]; then
    ok "${name}  (HTTP ${http_code})  →  ${url}"
  else
    warn "${name}  (HTTP ${http_code})  →  ${url}  — not ready yet (may still be starting)"
  fi
}

healthcheck "Gateway    " "http://localhost:${GATEWAY_PORT}/health"
healthcheck "Detection  " "http://localhost:${DETECTION_PORT}/health"
healthcheck "PCAP       " "http://localhost:${PCAP_PORT}/health"
healthcheck "Nexus    " "http://localhost:${Nexus_PORT}/health"

echo ""
log "Service log files:"
echo "  Gateway   : ${LOGS_DIR}/gateway.out.log"
echo "  Detection : ${LOGS_DIR}/detection.out.log"
echo "  PCAP      : ${LOGS_DIR}/pcap.out.log"
echo "  Nexus   : ${LOGS_DIR}/Nexus.out.log"
echo ""
log "Useful PM2 commands:"
echo -e "  ${CYAN}pm2 logs${RESET}                   tail all logs"
echo -e "  ${CYAN}pm2 monit${RESET}                  live CPU/memory monitor"
echo -e "  ${CYAN}pm2 list${RESET}                   show process status"
echo -e "  ${CYAN}./stop.sh${RESET}                  stop all services"
echo -e "  ${CYAN}./status.sh${RESET}                check all health endpoints"
echo ""
