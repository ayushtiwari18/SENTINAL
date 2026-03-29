#!/bin/bash
# SENTINEL + ArmorIQ — Complete Test Suite
# Usage: bash scripts/simulate_attack.sh
#
# Uses /api/armoriq/trigger — creates a REAL AttackEvent and fires ArmorIQ.
# Does NOT require Detection Engine to be running.

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
echo -e "${CYAN}  SENTINEL + ArmorIQ — Full Pipeline Test${NC}"
echo -e "${BOLD}══════════════════════════════════════════════════════════${NC}"

# ── Health Checks ─────────────────────────────────────────────────────────
echo
echo -e "${YELLOW}[TEST 1]${NC} Health checks"

GW_HEALTH=$(curl -s "${GATEWAY}/api/health" 2>/dev/null)
if echo "$GW_HEALTH" | grep -q 'healthy\|ok\|true'; then
  echo -e "  ${GREEN}✓${NC} Gateway is online"
else
  echo -e "  ${RED}✗${NC} Gateway is OFFLINE — start with: cd backend && npm start"
  exit 1
fi

AQ_HEALTH=$(curl -s "${ARMORIQ}/health" 2>/dev/null)
if echo "$AQ_HEALTH" | grep -q '"status":"ok"'; then
  echo -e "  ${GREEN}✓${NC} ArmorIQ is online"
else
  echo -e "  ${RED}✗${NC} ArmorIQ OFFLINE — start: cd services/sentinal-response-engine && uvicorn main:app --port 8004 --reload"
  exit 1
fi

# ── TEST 2: Trigger critical SQLi via Gateway (full pipeline) ─────────────
echo
echo -e "${YELLOW}[TEST 2]${NC} Critical SQLi via Gateway trigger (creates real AttackEvent + fires ArmorIQ)"
T2=$(curl -s -X POST "${GATEWAY}/api/armoriq/trigger" \
  -H "Content-Type: application/json" \
  -d '{"ip":"192.168.5.22","attackType":"sqli","severity":"critical","confidence":0.97,"status":"successful"}')
echo "$T2" | python3 -m json.tool 2>/dev/null || echo "$T2"
ATTACK_ID=$(echo "$T2" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('attackId',''))" 2>/dev/null)
if [ -n "$ATTACK_ID" ]; then
  echo -e "  ${GREEN}✓ AttackEvent created: $ATTACK_ID${NC}"
else
  echo -e "  ${RED}✗ Trigger failed — check Gateway is restarted after latest pull${NC}"
  exit 1
fi

# ── TEST 3: Trigger high XSS via Gateway ───────────────────────────────────
echo
echo -e "${YELLOW}[TEST 3]${NC} High XSS via Gateway trigger"
curl -s -X POST "${GATEWAY}/api/armoriq/trigger" \
  -H "Content-Type: application/json" \
  -d '{"ip":"10.0.0.55","attackType":"xss","severity":"high","confidence":0.85,"status":"attempt"}' \
  | python3 -m json.tool 2>/dev/null

# ── Wait for ArmorIQ to process (it’s async) ─────────────────────────────
echo
echo -e "  ${CYAN}Waiting 3s for ArmorIQ to process and write to MongoDB...${NC}"
sleep 3

# ── TEST 4: Check action_queue ─────────────────────────────────────────────
echo
echo -e "${YELLOW}[TEST 4]${NC} Checking action_queue (should have pending BLOCKED actions)"
PENDING=$(curl -s "${GATEWAY}/api/actions/pending")
COUNT=$(echo "$PENDING" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null)
echo "$PENDING" | python3 -m json.tool 2>/dev/null || echo "$PENDING"

if [ "$COUNT" -gt "0" ] 2>/dev/null; then
  echo -e "  ${GREEN}✓ $COUNT pending action(s) in action_queue — Dashboard /action-queue will show cards${NC}"

  # Extract first ID for approve test
  FIRST_ID=$(echo "$PENDING" | python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('data',[]); print(items[0]['_id'] if items else '')" 2>/dev/null)

  # ── TEST 5: Human approve ────────────────────────────────────────────────
  if [ -n "$FIRST_ID" ]; then
    echo
    echo -e "${YELLOW}[TEST 5]${NC} Human APPROVE first pending action (id=$FIRST_ID)"
    APPROVE=$(curl -s -X POST "${GATEWAY}/api/actions/${FIRST_ID}/approve" \
      -H "Content-Type: application/json" \
      -d '{"approvedBy": "judge"}')
    echo "$APPROVE" | python3 -m json.tool 2>/dev/null || echo "$APPROVE"
    if echo "$APPROVE" | grep -q '"success":true'; then
      echo -e "  ${GREEN}✓ Action approved — APPROVED entry will appear in /audit${NC}"
    fi
  fi
else
  echo -e "  ${RED}✗ action_queue is still empty${NC}"
  echo -e "  This means ArmorIQ could not reach Gateway to write audit entries."
  echo -e "  Check ArmorIQ terminal for [AUDIT] log lines."
fi

# ── TEST 6: Audit log ──────────────────────────────────────────────────────────
echo
echo -e "${YELLOW}[TEST 6]${NC} Audit log (should show ALLOWED + BLOCKED + APPROVED entries)"
AUDIT=$(curl -s "${GATEWAY}/api/audit")
AUDIT_COUNT=$(echo "$AUDIT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null)
echo -e "  ${CYAN}→ $AUDIT_COUNT total audit entries${NC}"

# Show just status summary instead of full JSON dump
echo "$AUDIT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
entries = d.get('data', [])
allowed = [e for e in entries if e['status'] == 'ALLOWED']
blocked = [e for e in entries if e['status'] == 'BLOCKED']
approved = [e for e in entries if e['status'] == 'APPROVED']
rejected = [e for e in entries if e['status'] == 'REJECTED']
print(f'  ALLOWED:  {len(allowed)}')
print(f'  BLOCKED:  {len(blocked)}')
print(f'  APPROVED: {len(approved)}')
print(f'  REJECTED: {len(rejected)}')
if entries:
    print()
    print('  Latest 3 entries:')
    for e in entries[:3]:
        print(f'    [{e[\"status\"]}] {e[\"action\"]} — rule={e[\"policy_rule_id\"]} ip={e.get(\"ip\",\"\")}')
" 2>/dev/null

if [ "$AUDIT_COUNT" -gt "0" ] 2>/dev/null; then
  echo -e "  ${GREEN}✓ Audit log has entries — Dashboard /audit will show the table${NC}"
fi

# ── Summary ────────────────────────────────────────────────────────────
echo
echo -e "${BOLD}══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Now check the Dashboard:${NC}"
echo -e "${BOLD}══════════════════════════════════════════════════════════${NC}"
echo
echo -e "  ${CYAN}① Action Queue${NC}  → http://localhost:5173/action-queue"
echo -e "     Cards for: permanent_ban_ip, shutdown_endpoint"
echo -e "     Click APPROVE or REJECT on each card"
echo
echo -e "  ${CYAN}② Audit Log${NC}     → http://localhost:5173/audit"
echo -e "     ALLOWED rows (green): send_alert, log_attack, rate_limit_ip, flag_for_review"
echo -e "     BLOCKED rows (red):   permanent_ban_ip, shutdown_endpoint"
echo -e "     APPROVED row (blue):  after human clicks Approve"
echo
echo -e "  ${CYAN}③ Alerts${NC}        → http://localhost:5173/alerts"
echo -e "     New ArmorIQ alert (type: armoriq_action) should be visible"
echo
echo -e "  ${CYAN}④ Live Attacks${NC}  → http://localhost:5173/dashboard"
echo -e "     New SQLI + XSS attack events in the live feed"
echo
