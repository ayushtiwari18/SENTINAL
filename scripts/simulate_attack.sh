#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# SENTINEL + ArmorIQ — Quick curl test
# Usage: bash scripts/simulate_attack.sh
#
# Runs 3 tests:
#   1. ArmorIQ health check
#   2. Direct ArmorIQ /respond call (critical SQLi) → shows BLOCK
#   3. Direct ArmorIQ /respond call (medium brute force) → shows ALLOW only
# Then shows how to check action_queue and audit_log
# ─────────────────────────────────────────────────────────────────────────────

GATEWAY="http://localhost:3000"
ARMORIQ="http://localhost:8004"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo
echo -e "${BOLD}══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  SENTINEL + ArmorIQ Quick Test${NC}"
echo -e "${BOLD}══════════════════════════════════════════════════════════${NC}"

# ── Test 1: ArmorIQ Health ────────────────────────────────────────────────────
echo
echo -e "${YELLOW}[TEST 1]${NC} ArmorIQ health check"
RESPONSE=$(curl -s "${ARMORIQ}/health")
if echo "$RESPONSE" | grep -q '"status":"ok"'; then
  echo -e "  ${GREEN}✓${NC} ArmorIQ is online"
  echo -e "  ${CYAN}→${NC} $RESPONSE"
else
  echo -e "  ${RED}✗${NC} ArmorIQ is OFFLINE"
  echo -e "  ${YELLOW}Start it:${NC} cd services/armoriq-agent && uvicorn main:app --port 8004 --reload"
  exit 1
fi

# ── Test 2: Critical SQLi → expect BLOCK on shutdown_endpoint ────────────────
echo
echo -e "${YELLOW}[TEST 2]${NC} Critical SQLi attack → ArmorIQ should BLOCK shutdown_endpoint"
RESPONSE=$(curl -s -X POST "${ARMORIQ}/respond" \
  -H "Content-Type: application/json" \
  -d '{
    "attackId":   "507f1f77bcf86cd799439011",
    "ip":         "192.168.5.22",
    "attackType": "sqli",
    "severity":   "critical",
    "status":     "successful",
    "confidence": 0.97
  }')
echo -e "  ${CYAN}Response:${NC}"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

ACTIONS_EXECUTED=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('actionsExecuted', []))" 2>/dev/null)
ACTIONS_QUEUED=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print([a['action'] for a in d.get('actionsQueued', [])])" 2>/dev/null)

echo -e "  ${GREEN}✓ ALLOWED (auto-executed):${NC} $ACTIONS_EXECUTED"
echo -e "  ${RED}✗ BLOCKED (queued for review):${NC} $ACTIONS_QUEUED"

# ── Test 3: Medium brute force → only safe actions ────────────────────────────
echo
echo -e "${YELLOW}[TEST 3]${NC} Medium brute force → ArmorIQ should ALLOW all actions (no block)"
RESPONSE=$(curl -s -X POST "${ARMORIQ}/respond" \
  -H "Content-Type: application/json" \
  -d '{
    "attackId":   "507f1f77bcf86cd799439022",
    "ip":         "172.16.0.100",
    "attackType": "brute_force",
    "severity":   "medium",
    "status":     "blocked",
    "confidence": 0.80
  }')
echo -e "  ${CYAN}Response:${NC}"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

# ── Test 4: Log ingest via Gateway ────────────────────────────────────────────
echo
echo -e "${YELLOW}[TEST 4]${NC} Full pipeline — ingest malicious log via Gateway"
RESPONSE=$(curl -s -X POST "${GATEWAY}/api/logs/ingest" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test-demo",
    "method": "GET",
    "url": "/search?q=<script>alert(1)</script>",
    "ip": "10.10.10.99",
    "queryParams": {"q": "<script>alert(1)</script>"},
    "body": {},
    "headers": {
      "userAgent": "Mozilla/5.0",
      "contentType": "application/json",
      "referer": ""
    },
    "responseCode": 200
  }')
echo -e "  ${CYAN}Gateway response:${NC}"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

# ── What to check ────────────────────────────────────────────────────────────
echo
echo -e "${BOLD}══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  What to check now:${NC}"
echo -e "${BOLD}══════════════════════════════════════════════════════════${NC}"
echo
echo -e "  ${CYAN}1. Action Queue (Dashboard)${NC}"
echo -e "     http://localhost:5173/action-queue"
echo
echo -e "  ${CYAN}2. Audit Log (Dashboard)${NC}"
echo -e "     http://localhost:5173/audit"
echo
echo -e "  ${CYAN}3. API — Pending actions${NC}"
echo -e "     curl ${GATEWAY}/api/actions/pending | python3 -m json.tool"
echo
echo -e "  ${CYAN}4. API — Audit log${NC}"
echo -e "     curl ${GATEWAY}/api/audit | python3 -m json.tool"
echo
echo -e "  ${CYAN}5. API — Recent attacks${NC}"
echo -e "     curl ${GATEWAY}/api/attacks/recent | python3 -m json.tool"
echo
