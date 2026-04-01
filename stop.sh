#!/usr/bin/env bash
# =============================================================================
# stop.sh — Stop all SENTINAL services
# =============================================================================
# Usage:
#   ./stop.sh              # stop but keep in PM2 list (can restart later)
#   ./stop.sh --delete     # stop + remove from PM2 entirely
#   ./stop.sh --help
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN='\033[0;32m';  YELLOW='\033[1;33m'
RED='\033[0;31m';    CYAN='\033[0;36m'
BOLD='\033[1m';      RESET='\033[0m'

log()  { echo -e "${CYAN}[SENTINAL]${RESET} $*"; }
ok()   { echo -e "${GREEN}  ✓${RESET}  $*"; }
warn() { echo -e "${YELLOW}  ⚠${RESET}  $*"; }
die()  { echo -e "${RED}  ✖${RESET}  $*"; exit 1; }

DELETE_MODE=false
for arg in "$@"; do
  case $arg in
    --delete) DELETE_MODE=true ;;
    --help)   echo "Usage: ./stop.sh [--delete]"; exit 0 ;;
  esac
done

echo ""
echo -e "${BOLD}  ╔══════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}  ║   SENTINAL — Stopping All Services                  ║${RESET}"
echo -e "${BOLD}  ╚══════════════════════════════════════════════════════╝${RESET}"
echo ""

command -v pm2 &>/dev/null || die "pm2 is not installed."

cd "${ROOT_DIR}"

if $DELETE_MODE; then
  log "Deleting all SENTINAL processes from PM2..."
  pm2 delete ecosystem.config.js 2>/dev/null || warn "Some processes were already stopped"
  ok "All processes deleted from PM2 list"
else
  log "Stopping all SENTINAL processes (keeping in PM2 list)..."
  pm2 stop ecosystem.config.js 2>/dev/null || warn "Some processes were already stopped"
  ok "All processes stopped"
  echo ""
  log "To restart:  ${CYAN}pm2 restart ecosystem.config.js${RESET}"
  log "To remove:   ${CYAN}./stop.sh --delete${RESET}"
fi

echo ""
