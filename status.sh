#!/usr/bin/env bash
# =============================================================================
# status.sh — Check health of all SENTINAL services
# =============================================================================
# Usage:
#   ./status.sh
#
# Shows:
#   - PM2 process list
#   - HTTP health check result for each service
#   - Uptime reported by each service
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

GREEN='\033[0;32m';  YELLOW='\033[1;33m'
RED='\033[0;31m';    CYAN='\033[0;36m'
BOLD='\033[1m';      RESET='\033[0m'

ok()   { echo -e "  ${GREEN}✓${RESET}  $*"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $*"; }
fail() { echo -e "  ${RED}✖${RESET}  $*"; }

# Source .env for port numbers
if [ -f "${ENV_FILE}" ]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

GATEWAY_PORT="${GATEWAY_PORT:-3000}"
DETECTION_PORT="${DETECTION_PORT:-8002}"
PCAP_PORT="${PCAP_PORT:-8003}"
ARMORIQ_PORT="${ARMORIQ_PORT:-8004}"

echo ""
echo -e "${BOLD}  SENTINAL — Service Status${RESET}"
echo -e "  $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ── PM2 process table ─────────────────────────────────────────────────────────────────
if command -v pm2 &>/dev/null; then
  echo -e "${BOLD}  PM2 Processes:${RESET}"
  pm2 list 2>/dev/null | grep -E 'sentinal|online|stopped|errored' || echo "  (no PM2 processes found)"
else
  warn "pm2 not installed — skipping process list"
fi

echo ""
echo -e "${BOLD}  HTTP Health Checks:${RESET}"
echo ""

# ── Health check function ──────────────────────────────────────────────────────────
healthcheck() {
  local name="$1"
  local url="$2"
  local body http_code uptime_val service_val

  body=$(curl -s --max-time 5 "${url}" 2>/dev/null || echo "{}")
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${url}" 2>/dev/null || echo "000")

  # Extract uptime from JSON response (portable, no jq required)
  uptime_val=$(echo "${body}" | grep -o '"uptime":[0-9]*' | head -1 | cut -d: -f2 || echo "?")
  service_val=$(echo "${body}" | grep -o '"service":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "?")

  if [ "${http_code}" = "200" ]; then
    ok "${name}  HTTP ${http_code}  uptime=${uptime_val}s  →  ${url}"
  elif [ "${http_code}" = "503" ]; then
    warn "${name}  HTTP ${http_code}  (service up but dependency unhealthy)  →  ${url}"
  elif [ "${http_code}" = "000" ]; then
    fail "${name}  UNREACHABLE  →  ${url}  (is the service running?)"
  else
    warn "${name}  HTTP ${http_code}  →  ${url}"
  fi
}

healthcheck "Gateway   " "http://localhost:${GATEWAY_PORT}/health"
healthcheck "Detection " "http://localhost:${DETECTION_PORT}/health"
healthcheck "PCAP      " "http://localhost:${PCAP_PORT}/health"
healthcheck "ArmorIQ   " "http://localhost:${ARMORIQ_PORT}/health"

echo ""
