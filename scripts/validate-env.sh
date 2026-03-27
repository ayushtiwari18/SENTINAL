#!/usr/bin/env bash
# =============================================================================
# validate-env.sh — SENTINAL Pre-Deploy Environment Validator
# =============================================================================
#
# PURPOSE:
#   Run this before every deploy to verify:
#     1. All required environment variables are set and non-empty
#     2. No secrets are still set to insecure placeholder values
#     3. All 4 service health endpoints respond HTTP 200
#
# USAGE:
#   ./scripts/validate-env.sh                   # check .env + running services
#   ./scripts/validate-env.sh --env-only        # only check variables, skip health
#   ./scripts/validate-env.sh --health-only     # only check running services
#   ./scripts/validate-env.sh --env /path/.env  # use a specific .env file
#   ./scripts/validate-env.sh --help
#
# EXIT CODES:
#   0  All checks passed
#   1  One or more checks failed
#
# CI/CD USAGE:
#   Add to your pipeline before deploying:
#     - run: chmod +x scripts/validate-env.sh && ./scripts/validate-env.sh --env-only
#
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/..": && pwd)"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m';  YELLOW='\033[1;33m'
RED='\033[0;31m';    CYAN='\033[0;36m'
BOLD='\033[1m';      RESET='\033[0m'

passed=0
warnings=0
failed=0

ok()     { echo -e "  ${GREEN}✓${RESET}  $*";    ((passed++))  || true; }
warn()   { echo -e "  ${YELLOW}⚠${RESET}  $*";  ((warnings++)) || true; }
fail()   { echo -e "  ${RED}✖${RESET}  $*";     ((failed++))   || true; }
section(){ echo -e "\n${BOLD}  $*${RESET}"; }

# ── Parse args ──────────────────────────────────────────────────────────────────
CHECK_ENV=true
CHECK_HEALTH=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-only)    CHECK_HEALTH=false ;;
    --health-only) CHECK_ENV=false    ;;
    --env)         ENV_FILE="$2"; shift ;;
    --help)
      echo ""
      echo "  Usage: ./scripts/validate-env.sh [options]"
      echo ""
      echo "  Options:"
      echo "    --env-only       Only check env vars (skip health checks)"
      echo "    --health-only    Only check service health (skip env vars)"
      echo "    --env <file>     Use a specific .env file"
      echo "    --help           Show this help"
      echo ""
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

# ── Header ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  ╔══════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}  ║   SENTINAL — Pre-Deploy Validation               ║${RESET}"
echo -e "${BOLD}  ╚══════════════════════════════════════════════════════╝${RESET}"
echo -e "  $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "  .env file: ${CYAN}${ENV_FILE}${RESET}"
echo ""

# ============================================================
# SECTION 1 — ENVIRONMENT VARIABLES
# ============================================================
if $CHECK_ENV; then

  section "■ Section 1 — Environment File"

  # Check .env file exists
  if [ ! -f "${ENV_FILE}" ]; then
    fail ".env not found at: ${ENV_FILE}"
    echo ""
    echo "  Fix:  cp ${ROOT_DIR}/.env.example ${ROOT_DIR}/.env"
    echo "        Then fill in your real values."
    echo ""
    exit 1
  fi
  ok ".env file exists"

  # Load it
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a

  # ── 1a. REQUIRED variables ─────────────────────────────────────────────
  section "■ Section 2 — Required Variables"

  # Format: "VAR_NAME|human description"
  REQUIRED_VARS=(
    "MONGO_URI|MongoDB connection string"
    "GATEWAY_PORT|Express Gateway port"
    "DETECTION_PORT|Detection Engine port"
    "PCAP_PORT|PCAP Processor port"
    "ARMORIQ_PORT|ArmorIQ Agent port"
    "DETECTION_URL|Detection Engine internal URL"
    "PCAP_URL|PCAP Processor internal URL"
    "ARMORIQ_URL|ArmorIQ Agent internal URL"
    "GATEWAY_URL|Gateway URL (used by ArmorIQ)"
    "JWT_SECRET|JWT signing secret"
  )

  for entry in "${REQUIRED_VARS[@]}"; do
    var_name="${entry%%|*}"
    var_desc="${entry##*|}"
    var_value="${!var_name:-}"
    if [ -z "${var_value}" ]; then
      fail "${var_name} is not set  (${var_desc})"
    else
      # Mask secrets in output
      case "${var_name}" in
        MONGO_URI)  display=$(echo "${var_value}" | sed 's|:[^:@]*@|:****@|') ;;
        JWT_SECRET) display="[set — ${#var_value} chars]" ;;
        API_SECRET) display="[set — ${#var_value} chars]" ;;
        *)          display="${var_value}" ;;
      esac
      ok "${var_name}  =  ${display}"
    fi
  done

  # ── 1b. INSECURE placeholder detection ────────────────────────────────────
  section "■ Section 3 — Security Checks"

  INSECURE_PATTERNS=(
    "JWT_SECRET|change_me"
    "JWT_SECRET|change_me_to_a_long_random_secret_string"
    "JWT_SECRET|secret"
    "JWT_SECRET|password"
    "API_SECRET|change_me"
    "API_SECRET|change_me_to_another_long_random_secret_string"
    "MONGO_URI|username:password"
    "MONGO_URI|user:pass"
    "GEMINI_API_KEY|your_gemini_api_key_here"
  )

  for entry in "${INSECURE_PATTERNS[@]}"; do
    var_name="${entry%%|*}"
    bad_value="${entry##*|}"
    var_value="${!var_name:-}"
    if [[ "${var_value,,}" == *"${bad_value,,}"* ]]; then
      # Only hard-fail in production
      if [[ "${NODE_ENV:-development}" == "production" ]]; then
        fail "${var_name} contains insecure placeholder '${bad_value}' — MUST change before production"
      else
        warn "${var_name} contains placeholder '${bad_value}' — OK for dev, MUST change for production"
      fi
    fi
  done

  # Check JWT_SECRET length (should be at least 32 chars)
  JWT_LEN=${#JWT_SECRET:-0}
  if [ "${JWT_LEN}" -lt 32 ] 2>/dev/null; then
    warn "JWT_SECRET is only ${JWT_LEN} chars — recommend at least 32 chars for security"
  else
    ok "JWT_SECRET length is ${JWT_LEN} chars (good)"
  fi

  # ── 1c. RECOMMENDED variables (warn only) ─────────────────────────────────
  section "■ Section 4 — Recommended Variables"

  RECOMMENDED_VARS=(
    "GEMINI_API_KEY|Google Gemini key for ArmorIQ AI decisions"
    "NODE_ENV|Runtime mode (development|production)"
    "LOG_LEVEL|Log verbosity (error|warn|info|debug)"
    "PUBLIC_URL|Public-facing URL of your deployment"
  )

  for entry in "${RECOMMENDED_VARS[@]}"; do
    var_name="${entry%%|*}"
    var_desc="${entry##*|}"
    var_value="${!var_name:-}"
    if [ -z "${var_value}" ]; then
      warn "${var_name} is not set  (${var_desc}) — using default"
    else
      # Hide actual key value for GEMINI_API_KEY
      [[ "${var_name}" == *KEY* ]] && display="[set]" || display="${var_value}"
      ok "${var_name}  =  ${display}"
    fi
  done

fi  # end CHECK_ENV


# ============================================================
# SECTION 2 — SERVICE HEALTH CHECKS
# ============================================================
if $CHECK_HEALTH; then

  # If we didn’t load .env above, source it now for port numbers
  if ! $CHECK_ENV && [ -f "${ENV_FILE}" ]; then
    set -a
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
    set +a
  fi

  GATEWAY_PORT="${GATEWAY_PORT:-3000}"
  DETECTION_PORT="${DETECTION_PORT:-8002}"
  PCAP_PORT="${PCAP_PORT:-8003}"
  ARMORIQ_PORT="${ARMORIQ_PORT:-8004}"

  section "■ Section 5 — Service Health Checks"
  echo "  (requires services to be running)"
  echo ""

  check_health() {
    local name="$1"
    local url="$2"
    local body http_code uptime_val

    body=$(curl -s --max-time 6 "${url}" 2>/dev/null || echo "{}")
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 6 "${url}" 2>/dev/null || echo "000")
    uptime_val=$(echo "${body}" | grep -o '"uptime":[0-9]*' | head -1 | cut -d: -f2 || echo "?")

    if [ "${http_code}" = "200" ]; then
      ok "${name}  HTTP ${http_code}  uptime=${uptime_val}s  →  ${url}"
    elif [ "${http_code}" = "503" ]; then
      warn "${name}  HTTP 503  (running but dependency unhealthy)  →  ${url}"
    elif [ "${http_code}" = "000" ]; then
      fail "${name}  UNREACHABLE  →  ${url}  (service not running?)"
    else
      warn "${name}  HTTP ${http_code}  →  ${url}"
    fi
  }

  check_health "Gateway         (port ${GATEWAY_PORT}) " "http://localhost:${GATEWAY_PORT}/health"
  check_health "Detection Engine (port ${DETECTION_PORT})" "http://localhost:${DETECTION_PORT}/health"
  check_health "PCAP Processor   (port ${PCAP_PORT}) " "http://localhost:${PCAP_PORT}/health"
  check_health "ArmorIQ Agent    (port ${ARMORIQ_PORT}) " "http://localhost:${ARMORIQ_PORT}/health"

fi  # end CHECK_HEALTH


# ============================================================
# SUMMARY
# ============================================================
echo ""
echo -e "  ─────────────────────────────────────────────────────────"
echo -e "  ${BOLD}Results:${RESET}  ${GREEN}✓ ${passed} passed${RESET}   ${YELLOW}⚠ ${warnings} warnings${RESET}   ${RED}✖ ${failed} failed${RESET}"
echo -e "  ─────────────────────────────────────────────────────────"

if [ "${failed}" -gt 0 ]; then
  echo ""
  echo -e "  ${RED}${BOLD}VALIDATION FAILED${RESET} — fix the errors above before deploying."
  echo ""
  exit 1
else
  echo ""
  if [ "${warnings}" -gt 0 ]; then
    echo -e "  ${YELLOW}${BOLD}PASSED WITH WARNINGS${RESET} — review warnings above."
  else
    echo -e "  ${GREEN}${BOLD}ALL CHECKS PASSED${RESET} — safe to deploy."
  fi
  echo ""
  exit 0
fi
