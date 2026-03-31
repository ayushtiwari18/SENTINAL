# 01 — System Architecture

> Source: `MASTER_REFERENCE.md` §1, §4 · Last verified: 2026-03-28

---

## System Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│            DEVELOPER APP  (demo-target :4000 or any Express app)     │
│   uses sentinel-middleware → POST /api/logs/ingest (async)           │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│             SERVICE 1 — GATEWAY API  (Node/Express :3000)            │
│                                                                      │
│  POST /api/logs/ingest  →  SystemLog saved to MongoDB                │
│                         →  detectionConnector → POST :8002/analyze   │
│                                                                      │
│  IF threat_detected:                                                 │
│    AttackEvent.create()     → MongoDB                                │
│    Alert.create()           → MongoDB  (high/critical only)          │
│    emit(attack:new)         → Socket.io                              │
│    emit(alert:new)          → Socket.io                              │
│    callArmorIQ() [async]    → POST :8004/respond                     │
│                                                                      │
│  POST /api/pcap/upload   →  POST :8003/process → merge results       │
│  POST /api/armoriq/trigger → direct ArmorIQ call (demo/test)        │
│  POST /api/actions/:id/approve|reject → human enforcement           │
│  POST /api/audit/ingest  ← called by ArmorIQ audit_logger           │
└──────┬────────────────────────┬──────────────────────┬──────────────┘
       │                        │                      │
       ▼                        ▼                      ▼
┌────────────────┐  ┌───────────────────────┐  ┌──────────────────────────┐
│  SERVICE 2     │  │  SERVICE 3            │  │  SERVICE 4               │
│  PCAP          │  │  DETECTION ENGINE     │  │  ARMORIQ AGENT           │
│  PROCESSOR     │  │  (Python :8002)       │  │  (Python :8004)          │
│  (Python :8003)│  │                       │  │                          │
│  POST /process │  │  POST /analyze        │  │  POST /respond           │
│  8 detectors   │  │  45-rule engine       │  │  intent_builder.py       │
│  full pipeline │  │  adversarial decoder  │  │  openclaw_runtime.py     │
│  10/10 tests ✅│  │  ML optional          │  │  policy_engine.py (fbck) │
└────────────────┘  └───────────────────────┘  │  executor.py             │
                                               │  audit_logger.py         │
                                               │  policy.yaml             │
                                               └──────────────────────────┘
                                                          │
                               ┌──────────────────────────┴─────────────┐
                               │  ALLOWED → auto-executed                │
                               │  send_alert / log_attack                │
                               │  rate_limit_ip / flag_for_review        │
                               │  generate_report                        │
                               │                                         │
                               │  BLOCKED → action_queue (human review)  │
                               │  permanent_ban_ip                       │
                               │  shutdown_endpoint                      │
                               │  purge_all_sessions                     │
                               │  modify_firewall_rules                  │
                               └──────────────────┬──────────────────────┘
                                                  │
                                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│              SERVICE 5 — REACT DASHBOARD  (Vite :5173)               │
│  /dashboard /attacks /alerts /action-queue /audit /pcap /logs        │
│  /services /simulate → all 14 pages, Socket.io live updates          │
└──────────────────────────────────────────────────────────────────────┘
```

---

## OpenClaw Decision Flow

```
POST :8004/respond
         │
  intent_builder.py  →  builds 5–6 ProposedAction intents per attack
         │
  openclaw_runtime.py  ← PRIMARY (reads policy.yaml)
    RULE_001: action in blocked_actions  → BLOCK
    RULE_002: risk_level == 'critical'   → BLOCK
    RULE_003: risk_level == 'high'       → BLOCK
    RULE_004: action in allowed_actions  → ALLOW
    RULE_DEFAULT: no match              → BLOCK (fail-safe)
    on crash → policy_engine.py fallback
         │
  ┌──────┴──────────────────────┐
  │ ALLOW                       │ BLOCK
  │ executor.py fires           │ ActionQueue.create() → MongoDB
  │ emit(audit:new)             │ emit(action:pending) + emit(audit:new)
  └─────────────────────────────┘
         │
  audit_logger.py → POST /api/audit/ingest → AuditLog saved
```

---

## Complete Request Lifecycle

### Flow A — Live Request via Middleware

```
1.  User hits app → sentinel-middleware captures res.on('finish') async
2.  POST /api/logs/ingest → SystemLog saved to MongoDB
3.  setImmediate() → detectionConnector → POST :8002/analyze
4.  threat_detected = false → stop.
    threat_detected = true:
      AttackEvent.create() → emit(attack:new)
      IF high/critical: Alert.create() → emit(alert:new)
      callArmorIQ() [async] → POST :8004/respond
5.  ArmorIQ: openclaw_runtime evaluates each intent
      ALLOW → executor.py fires → audit entry
      BLOCK → ActionQueue.create() → emit(action:pending) → audit entry
6.  Human: /action-queue → APPROVE/REJECT → AuditLog(HUMAN_OVERRIDE)
```

### Flow B — PCAP Upload
```
POST /api/pcap/upload → POST :8003/process
→ pcap_loader → packet_parser → flow_builder → attack_detector
→ AttackEvent.create() per attack → emit(attack:new)
```

### Flow C — Direct ArmorIQ Trigger (Demo / Simulate Page)
```
POST /api/armoriq/trigger → reportAttack() → full pipeline (Flow A steps 4–6)
```

### Flow D — SimulateAttack Dashboard Page
```
Browser: /simulate page → click attack button
→ fetch POST /api/logs/ingest  (SQLi / XSS / Traversal / Command Injection)
  OR fetch POST /api/armoriq/trigger  (Brute Force Critical)
→ Dashboard Socket.io: attack:new / action:pending events received live
→ /simulate right panel updates with real detections in real time
```
