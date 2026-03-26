#!/usr/bin/env bash
# SENTINEL Demo Attack Script
# Run each test manually — watch the Dashboard update in real time.

BASE="http://localhost:4000"
GATEWAY="http://localhost:3000"

echo ""
echo "══════════════════════════════════════════════════"
echo " SENTINEL FULL PIPELINE TESTS"
echo "══════════════════════════════════════════════════"

# ── TEST 1: SQL Injection (medium severity → ALLOW actions) ──────────────────
echo ""
echo "▶ TEST 1 — SQL Injection (medium severity)"
echo "  Expected: send_alert + log_attack + rate_limit_ip executed"
echo "  Expected: audit:new socket event fired"
echo ""
curl -s -X GET "$BASE/search?q=1'+OR+'1'='1" \
  -H "User-Agent: Mozilla/5.0 SQLMap/1.0" | jq .

sleep 2
echo ""
echo "  → Check: GET $GATEWAY/api/audit?limit=5"
curl -s "$GATEWAY/api/audit?limit=5" | jq '.data[0]'


# ── TEST 2: XSS Attack (medium severity) ─────────────────────────────────────
echo ""
echo "▶ TEST 2 — XSS Attack"
echo "  Expected: same as TEST 1 — allowed actions auto-executed"
echo ""
curl -s -X POST "$BASE/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"<script>alert(1)</script>","password":"test"}' | jq .

sleep 2


# ── TEST 3: Path Traversal (high severity → flag_for_review BLOCKED) ─────────
echo ""
echo "▶ TEST 3 — Path Traversal"
echo "  Expected: flag_for_review BLOCKED → ActionQueue"
echo "  Expected: action:pending socket event"
echo ""
curl -s -X GET "$BASE/file?name=../../../../etc/passwd" \
  -H "User-Agent: Scanner/1.0" | jq .

sleep 2
echo ""
echo "  → Check: GET $GATEWAY/api/actions/pending"
curl -s "$GATEWAY/api/actions/pending" | jq '.data[0]'


# ── TEST 4: Brute Force (critical severity → shutdown_endpoint BLOCKED) ───────
echo ""
echo "▶ TEST 4 — Brute Force / Critical Trigger"
echo "  Expected: permanent_ban_ip + shutdown_endpoint BLOCKED"
echo "  Expected: multiple items in ActionQueue"
echo ""
for i in 1 2 3 4 5; do
  curl -s -X POST "$BASE/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"admin\",\"password\":\"wrong$i\"}" > /dev/null
done
echo "  Sent 5 rapid login attempts from same IP"

sleep 2
echo ""
echo "  → Check ActionQueue:"
curl -s "$GATEWAY/api/actions/pending" | jq '[.data[] | {action: .action, status: .status}]'


# ── TEST 5: Command Injection (critical + direct ArmorIQ trigger) ─────────────
echo ""
echo "▶ TEST 5 — Direct ArmorIQ Trigger (critical + successful)"
echo "  Expected: shutdown_endpoint + permanent_ban_ip BLOCKED"
echo "  Expected: send_alert + log_attack + rate_limit_ip + flag_for_review EXECUTED"
echo ""
curl -s -X POST "$GATEWAY/api/armoriq/trigger" \
  -H "Content-Type: application/json" \
  -d '{
    "ip":         "192.168.1.100",
    "attackType": "command_injection",
    "severity":   "critical",
    "confidence": 0.99,
    "status":     "successful"
  }' | jq .

sleep 2
echo ""
echo "  → Full audit log (last 5):"
curl -s "$GATEWAY/api/audit?limit=5" | jq '[.data[] | {action, status, policy_rule_id}]'


# ── TEST 6: ArmorIQ Failure Resilience ────────────────────────────────────────
echo ""
echo "▶ TEST 6 — ArmorIQ Failure Resilience"
echo "  ⚠ Stop ArmorIQ service before running this test"
echo "  Expected: attack still saved, gateway continues"
echo ""
read -p "  Press ENTER when ArmorIQ is stopped..."
curl -s -X POST "$BASE/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}' > /dev/null
echo "  Request sent."
sleep 2
echo ""
echo "  → AttackEvents still saved:"
curl -s "$GATEWAY/api/attacks/recent" | jq '.[0] | {id: ._id, attackType, severity}'


# ── TEST 7: Human Override — Approve a Blocked Action ────────────────────────
echo ""
echo "▶ TEST 7 — Human Override (Approve)"
PENDING_ID=$(curl -s "$GATEWAY/api/actions/pending" | jq -r '.data[0]._id')
if [ "$PENDING_ID" != "null" ] && [ -n "$PENDING_ID" ]; then
  echo "  Approving action: $PENDING_ID"
  curl -s -X POST "$GATEWAY/api/actions/$PENDING_ID/approve" \
    -H "Content-Type: application/json" \
    -d '{"approvedBy":"demo-analyst"}' | jq '{success, message}'
  echo ""
  echo "  → Audit log shows APPROVED:"
  curl -s "$GATEWAY/api/audit?limit=3" | jq '[.data[] | select(.status == "APPROVED") | {action, status, triggeredBy}]'
else
  echo "  No pending actions found — run TEST 4/5 first"
fi

echo ""
echo "══════════════════════════════════════════════════"
echo " ALL TESTS COMPLETE"
echo " Open Dashboard: http://localhost:5173"
echo " Check: Audit Log | Action Queue | Attack Feed"
echo "══════════════════════════════════════════════════"
echo ""
