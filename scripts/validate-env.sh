#!/usr/bin/env bash
# =============================================================================
# validate-env.sh — SENTINAL Pre-Deploy Environment Validator
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

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
      echo "    --env-only       Only check env vars"
      echo "    --health-only    Only check service health"
      echo "    --env <file>     Use a specific .env file"
      echo ""
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

echo ""
echo -e "${BOLD}  ╔══════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}  ║   SENTINAL — Pre-Deploy Validation                  ║${RESET}"
echo -e "${BOLD}  ╚══════════════════════════════════════════════════════╝${RESET}"
echo -e "  $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "  .env file: ${CYAN}${ENV_FILE}${RESET}"
echo ""

if $CHECK_ENV; then

  section "■ Section 1 — Environment File"
  if [ ! -f "${ENV_FILE}" ]; then
    fail ".env not found at: ${ENV_FILE}"
    echo "  Fix:  cp ${ROOT_DIR}/.env.example ${ROOT_DIR}/.env"
    exit 1
  fi
  ok ".env file exists"

  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a

  section "■ Section 2 — Required Variables"
  REQUIRED_VARS=(
    "MONGO_URI|MongoDB connection string"
    "GATEWAY_PORT|Express Gateway port"
    "DETECTION_PORT|Detection Engine port"
    "PCAP_PORT|PCAP Processor port"
    "Nexus_PORT|SENTINAL Response Engine port"
    "DETECTION_URL|Detection Engine internal URL"
    "PCAP_URL|PCAP Processor internal URL"
    "Nexus_URL|SENTINAL Response Engine internal URL"
    "GATEWAY_URL|Gateway URL (used by SENTINAL Response Engine)"
    "JWT_SECRET|JWT signing secret"
  )

  for entry in "${REQUIRED_VARS[@]}"; do
    var_name="${entry%%|*}"
    var_desc="${entry##*|}"
    var_value="${!var_name:-}"
    if [ -z "${var_value}" ]; then
      fail "${var_name} is not set  (${var_desc})"
    else
      case "${var_name}" in
        MONGO_URI)  display=$(echo "${var_value}" | sed 's|:[^:@]*@|:****@|') ;;
        JWT_SECRET) display="[set — ${#var_value} chars]" ;;
        API_SECRET) display="[set — ${#var_value} chars]" ;;
        *)          display="${var_value}" ;;
      esac
      ok "${var_name}  =  ${display}"
    fi
  done

  section "■ Section 3 — Security Checks"
  INSECURE_PATTERNS=(
    "JWT_SECRET|change_me_to_a_long_random_secret_string"
    "API_SECRET|change_me_to_another_long_random_secret_string"
    "MONGO_URI|username:password"
    "GEMINI_API_KEY|your_gemini_api_key_here"
  )
  for entry in "${INSECURE_PATTERNS[@]}"; do
    var_name="${entry%%|*}"
    bad_value="${entry##*|}"
    var_value="${!var_name:-}"
    if [[ "${var_value,,}" == *"${bad_value,,}"* ]]; then
      if [[ "${NODE_ENV:-development}" == "production" ]]; then
        fail "${var_name} still has placeholder value — MUST change for production"
      else
        warn "${var_name} has placeholder value — OK for dev, change for production"
      fi
    fi
  done

  JWT_LEN=${#JWT_SECRET}
  if [ "${JWT_LEN}" -lt 32 ]; then
    warn "JWT_SECRET is only ${JWT_LEN} chars — recommend at least 32"
  else
    ok "JWT_SECRET length is ${JWT_LEN} chars (good)"
  fi

  section "■ Section 4 — Recommended Variables"
  RECOMMENDED_VARS=(
    "GEMINI_API_KEY|Google Gemini key for Nexus"
    "NODE_ENV|Runtime mode"
    "LOG_LEVEL|Log verbosity"
    "PUBLIC_URL|Public-facing deployment URL"
  )
  for entry in "${RECOMMENDED_VARS[@]}"; do
    var_name="${entry%%|*}"
    var_desc="${entry##*|}"
    var_value="${!var_name:-}"
    if [ -z "${var_value}" ]; then
      warn "${var_name} not set  (${var_desc})"
    else
      [[ "${var_name}" == *KEY* ]] && display="[set]" || display="${var_value}"
      ok "${var_name}  =  ${display}"
    fi
  done

fi

if $CHECK_HEALTH; then
  if ! $CHECK_ENV && [ -f "${ENV_FILE}" ]; then
    set -a; source "${ENV_FILE}"; set +a
  fi

  GATEWAY_PORT="${GATEWAY_PORT:-3000}"
  DETECTION_PORT="${DETECTION_PORT:-8002}"
  PCAP_PORT="${PCAP_PORT:-8003}"
  Nexus_PORT="${Nexus_PORT:-8004}"

  section "■ Section 5 — Service Health Checks"
  echo "  (requires services to be running)"
  echo ""

  check_health() {
    local name="$1" url="$2" body http_code uptime_val
    body=$(curl -s --max-time 6 "${url}" 2>/dev/null || echo "{}")
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 6 "${url}" 2>/dev/null || echo "000")
    uptime_val=$(echo "${body}" | grep -o '"uptime":[0-9]*' | head -1 | cut -d: -f2 || echo "?")
    if   [ "${http_code}" = "200" ]; then ok   "${name}  HTTP ${http_code}  uptime=${uptime_val}s  →  ${url}"
    elif [ "${http_code}" = "503" ]; then warn  "${name}  HTTP 503  (dependency unhealthy)  →  ${url}"
    elif [ "${http_code}" = "000" ]; then fail  "${name}  UNREACHABLE  →  ${url}"
    else                                  warn  "${name}  HTTP ${http_code}  →  ${url}"
    fi
  }

  check_health "Gateway          (port ${GATEWAY_PORT})  " "http://localhost:${GATEWAY_PORT}/health"
  check_health "Detection Engine (port ${DETECTION_PORT}) " "http://localhost:${DETECTION_PORT}/health"
  check_health "PCAP Processor   (port ${PCAP_PORT})  " "http://localhost:${PCAP_PORT}/health"
  check_health "Response Engine  (port ${Nexus_PORT})  " "http://localhost:${Nexus_PORT}/health"
fi

echo ""
echo -e "  ─────────────────────────────────────────────────────────"
echo -e "  ${BOLD}Results:${RESET}  ${GREEN}✓ ${passed} passed${RESET}   ${YELLOW}⚠ ${warnings} warnings${RESET}   ${RED}✖ ${failed} failed${RESET}"
echo -e "  ─────────────────────────────────────────────────────────"

if [ "${failed}" -gt 0 ]; then
  echo -e "  ${RED}${BOLD}VALIDATION FAILED${RESET} — fix the errors above."
  echo ""
  exit 1
else
  [ "${warnings}" -gt 0 ] \
    && echo -e "  ${YELLOW}${BOLD}PASSED WITH WARNINGS${RESET} — review warnings above." \
    || echo -e "  ${GREEN}${BOLD}ALL CHECKS PASSED${RESET} — safe to deploy."
  echo ""
  exit 0
fi
