# SENTINAL — Naming and Component Boundaries

This document exists so contributors never confuse the custom-built
SENTINAL services with commercial/vendor product names.

---

## Commercial ArmorIQ

**ArmorIQ** is the name of a commercial cybersecurity product by ArmorIQ Inc.
This repository does NOT contain the commercial ArmorIQ product.
References to "ArmorIQ" in older code or comments refer to the concept
that inspired the design, not the vendor product.

See: https://armoriq.ai

---

## What we built inside this repo

### sentinal-response-engine  (`services/sentinal-response-engine/`)

This is our **custom-built** backend service. It was previously named
`armoriq-agent` — that name has been retired to avoid confusion.

**What it does:**
- Receives threat context from the Detection Engine
- Calls the OpenClaw AI reasoning layer (via the SENTINAL skill)
- Validates proposed actions against `policy.yaml`
- Executes low-risk actions automatically (send_alert, log_attack, rate_limit_ip)
- Queues high-risk actions for human review via the dashboard

**What it is NOT:**
- It is not the commercial ArmorIQ product
- It is not OpenClaw itself
- It is not ArmorClaw itself

---

### OpenClaw  (`openclaw-armoriq-skill/`)

OpenClaw is the AI reasoning agent layer. It reads the SENTINAL skill
definition (SKILL.md) and proposes a JSON action array in response to
each threat context. It does not execute actions — it only reasons and
proposes.

---

### ArmorClaw  (concept, not a separate service)

ArmorClaw refers to the **guarded policy boundary** between proposed
actions and actual execution. It is implemented inside
`sentinal-response-engine/` via `policy.yaml` and `openclaw_runtime.py`.

- Actions with `risk_level: low` are executed automatically
- Actions with `risk_level: high` are blocked and queued for human approval

ArmorClaw is the concept/logic layer. It is not a separate standalone service.

---

### SENTINAL Dashboard  (`dashboard/`)

The React frontend. The `ActionQueuePage` is the **only place** where a
human approves or rejects high-risk queued actions. No other component
(Telegram, OpenClaw, or any bot) has authorization authority.

---

## Summary table

| Name | Type | Lives in |
|---|---|---|
| Commercial ArmorIQ | External vendor product | Not in this repo |
| sentinal-response-engine | Our custom backend service | `services/sentinal-response-engine/` |
| OpenClaw | AI reasoning agent | `openclaw-armoriq-skill/` |
| ArmorClaw | Policy enforcement concept/logic | Inside sentinal-response-engine |
| SENTINAL Dashboard | React frontend + human approval UI | `dashboard/` |