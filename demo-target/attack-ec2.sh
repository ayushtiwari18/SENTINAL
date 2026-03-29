#!/usr/bin/env bash
# =============================================================================
# SENTINAL — EC2 Attack Test Script
# -----------------------------------------------------------------------------
# Run this on your LOCAL machine where demo-target is running.
#
# SETUP (one time):
#   export SENTINAL_GATEWAY_URL=http://54.146.6.197:3000
#   node server.js         ← in demo-target/
#
# THEN RUN:
#   chmod +x attack-ec2.sh && ./attack-ec2.sh
#
# WATCH RESULTS:
#   http://54.146.6.197:5173  →  Attacks page
# =============================================================================

# ── Config — edit these if your IP changes ───────────────────────────────────
TARGET="http://localhost:4000"           # demo-target on your local machine
GATEWAY=$SENTINAL_GATEWAY_URL      # EC2 Gateway API

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
info() { echo -e "  ${CYAN}→${NC} $1"; }
warn() { echo -e "  ${YELLOW}!${NC} $1"; }
sep()  { echo -e "\n${BOLD}──────────────────────────────────────────────────${NC}"; }

echo -e "\n${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║    SENTINAL EC2 — Full Pipeline Attack Tests     ║${NC}"
echo -e "${BOLD}║    Dashboard: $SENTINAL_GATEWAY_URL/dashboard    ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"

# Verify demo-target is alive
echo -e "\n${BOLD}[PRE-CHECK] Verifying demo-target is running...${NC}"
HEALTH=$(curl -s --max-time 3 "$TARGET/" 2>/dev/null)
if echo "$HEALTH" | grep -q "SENTINEL"; then
  ok "demo-target is UP at $TARGET"
else
  echo -e "  ${RED}✗ demo-target not responding at $TARGET${NC}"
  echo -e "  Start it first:  cd demo-target && SENTINAL_GATEWAY_URL=$GATEWAY node server.js"
  exit 1
fi

# Verify Gateway is alive
echo ""
GHEALTH=$(curl -s --max-time 5 "$GATEWAY/health" 2>/dev/null)
if echo "$GHEALTH" | grep -q "ok"; then
  ok "EC2 Gateway is UP at $GATEWAY"
else
  warn "Gateway health check failed — attacks may not reach EC2. Continuing anyway."
fi

# =============================================================================
sep
echo -e "${BOLD}TEST 1 — SQL Injection  (rule: OR '1'='1')${NC}"
echo -e "  Expected: sqli · medium/high · attempt"
echo ""

# Hit the /search endpoint — q param goes into queryParams which detection scans
curl -s -X GET "$TARGET/search?q=1'+OR+'1'%3D'1'--" \
  -H "User-Agent: sqlmap/1.0" \
  -H "X-Forwarded-For: 10.10.0.1" > /dev/null
ok "SQLi via GET /search?q= sent"
sleep 1

# Also hit /login with body — body gets serialized and scanned
curl -s -X POST "$TARGET/login" \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 10.10.0.2" \
  -d '{"username":"admin UNION SELECT * FROM users--","password":"x"}' > /dev/null
ok "SQLi UNION SELECT via POST /login body sent"
sleep 1

# =============================================================================
sep
echo -e "${BOLD}TEST 2 — XSS Attack  (rule: <script> / onerror=)${NC}"
echo -e "  Expected: xss · medium · attempt"
echo ""

curl -s -X GET "$TARGET/search?q=%3Cscript%3Ealert%28document.cookie%29%3C%2Fscript%3E" \
  -H "X-Forwarded-For: 10.10.0.3" > /dev/null
ok "XSS via GET /search?q=<script> sent"
sleep 1

curl -s -X POST "$TARGET/login" \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 10.10.0.4" \
  -d '{"username":"<img src=x onerror=alert(1)>","password":"test"}' > /dev/null
ok "XSS onerror= via POST /login body sent"
sleep 1

# =============================================================================
sep
echo -e "${BOLD}TEST 3 — Path Traversal  (rule: ../../../etc/passwd)${NC}"
echo -e "  Expected: traversal · medium · attempt"
echo ""

curl -s -X GET "$TARGET/file?name=../../../../etc/passwd" \
  -H "X-Forwarded-For: 10.10.0.5" \
  -H "User-Agent: Scanner/1.0" > /dev/null
ok "Path traversal /etc/passwd via GET /file sent"
sleep 1

curl -s -X GET "$TARGET/file?name=..%2F..%2F..%2Fetc%2Fshadow" \
  -H "X-Forwarded-For: 10.10.0.6" > /dev/null
ok "URL-encoded traversal /etc/shadow via GET /file sent"
sleep 1

# =============================================================================
sep
echo -e "${BOLD}TEST 4 — Command Injection  (rule: ; cat / | whoami)${NC}"
echo -e "  Expected: command_injection · high/critical · attempt"
echo ""

# Use the /search endpoint — the q param value gets scanned
curl -s -X GET "$TARGET/search?q=hello%3B+cat+%2Fetc%2Fshadow" \
  -H "X-Forwarded-For: 10.10.1.1" > /dev/null
ok "Command injection '; cat /etc/shadow' via GET /search sent"
sleep 1

curl -s -X GET "$TARGET/search?q=test%3B+whoami+%26%26+id" \
  -H "X-Forwarded-For: 10.10.1.2" > /dev/null
ok "Command injection '; whoami && id' via GET /search sent"
sleep 1

# =============================================================================
sep
echo -e "${BOLD}TEST 5 — SSRF  (rule: 127.0.0.1 / 169.254.x)${NC}"
echo -e "  Expected: ssrf · medium · attempt"
echo ""

curl -s -X GET "$TARGET/search?q=http%3A%2F%2F127.0.0.1%3A8080%2Fadmin" \
  -H "X-Forwarded-For: 10.10.1.3" > /dev/null
ok "SSRF localhost:8080 via GET /search sent"
sleep 1

curl -s -X GET "$TARGET/search?q=http%3A%2F%2F169.254.169.254%2Flatest%2Fmeta-data%2F" \
  -H "X-Forwarded-For: 10.10.1.4" > /dev/null
ok "SSRF AWS metadata 169.254.169.254 via GET /search sent"
sleep 1

# =============================================================================
sep
echo -e "${BOLD}TEST 6 — XXE  (rule: <!ENTITY / SYSTEM)${NC}"
echo -e "  Expected: xxe · high · attempt"
echo ""

curl -s -X POST "$TARGET/login" \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 10.10.1.5" \
  -d '{"username":"<!DOCTYPE foo [<!ENTITY xxe SYSTEM \"file:///etc/passwd\">]>","password":"x"}' > /dev/null
ok "XXE <!ENTITY SYSTEM via POST /login body sent"
sleep 1

# =============================================================================
sep
echo -e "${BOLD}TEST 7 — Brute Force  (5 rapid login attempts)${NC}"
echo -e "  Expected: brute_force · critical · successful"
echo ""

for i in 1 2 3 4 5; do
  curl -s -X POST "$TARGET/login" \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: 10.0.0.5" \
    -d "{\"username\":\"admin\",\"password\":\"wrong$i\"}" > /dev/null
  echo -ne "  Attempt $i/5...\r"
  sleep 0.3
done
ok "5 rapid login attempts from 10.0.0.5 sent"
sleep 1

# =============================================================================
sep
echo -e "${BOLD}TEST 8 — ArmorIQ Direct Triggers (bypasses middleware — guaranteed logged)${NC}"
echo -e "  These hit the EC2 gateway directly, no demo-target needed."
echo ""

for ATTACK_TYPE in "sqli" "xss" "traversal" "command_injection" "ssrf" "brute_force"; do
  SEV="medium"
  CONF="0.82"
  IP="203.0.113.$((RANDOM % 200 + 10))"

  if [ "$ATTACK_TYPE" = "command_injection" ] || [ "$ATTACK_TYPE" = "brute_force" ]; then
    SEV="critical"; CONF="0.98"
  fi

  curl -s -X POST "$GATEWAY/api/armoriq/trigger" \
    -H "Content-Type: application/json" \
    -d "{\"ip\":\"$IP\",\"attackType\":\"$ATTACK_TYPE\",\"severity\":\"$SEV\",\"confidence\":$CONF,\"status\":\"attempt\"}" > /dev/null

  ok "Direct trigger: $ATTACK_TYPE ($SEV) from $IP"
  sleep 0.4
done

# =============================================================================
sep
echo -e "${BOLD}[VERIFY] Checking attack count on EC2...${NC}"
sleep 3
RESPONSE=$(curl -s --max-time 8 "$GATEWAY/api/attacks/recent?limit=5" 2>/dev/null)
if echo "$RESPONSE" | grep -q "attackType"; then
  COUNT=$(echo "$RESPONSE" | grep -o '"attackType"' | wc -l)
  ok "Gateway returned $COUNT recent attacks in last-5 query"
  info "Latest attack types detected:"
  echo "$RESPONSE" | grep -o '"attackType":"[^"]*"' | head -6 | sed 's/"attackType"://g' | sed 's/"//g' | while read -r t; do
    echo -e "    ${CYAN}→${NC} $t"
  done
else
  warn "Could not verify — check manually at: $GATEWAY/api/attacks/recent"
fi

echo -e "\n${BOLD}${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║         ALL TESTS FIRED ✓                        ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Dashboard Attacks page:${NC}  $SENTINAL_GATEWAY_URL/attacks"
echo -e "  ${BOLD}Dashboard Explore page:${NC}   $SENTINAL_GATEWAY_URL/explore"
echo -e "  ${BOLD}Raw API check:${NC}            $GATEWAY/api/attacks/recent?limit=20"
echo ""
echo -e "  ${YELLOW}NOTE:${NC} Tests 1-7 go through demo-target → middleware → EC2 gateway → detection"
echo -e "  ${YELLOW}NOTE:${NC} Test 8 direct triggers are ${GREEN}guaranteed${NC} to appear on dashboard"
echo ""
