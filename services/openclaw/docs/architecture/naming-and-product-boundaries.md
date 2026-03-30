# Naming and Product Boundaries

## ⚠️ Important — Read Before Contributing

This document exists to prevent confusion between the commercial ArmorIQ 
product and the custom SENTINAL services in this repo.

---

## Commercial ArmorIQ
- External/vendor commercial security product
- **NOT in this repository**
- Referenced by name only for conceptual context

---

## SENTINAL Response Engine
**Folder:** `services/sentinal-response-engine/`  
**Port:** 8004  
**What it does:**
- Receives threat context from the Detection Engine
- Calls OpenClaw (via `openclaw_runtime.py`) to get AI-reasoned action proposals
- Validates each proposed action against `policy.yaml` (ArmorClaw policy layer)
- Executes low-risk approved actions via `executor.py`
- Queues high-risk blocked actions for human review in the dashboard

This is a **custom-built integration service** specific to SENTINAL.
It is NOT the commercial ArmorIQ product.

---

## OpenClaw
- The AI reasoning agent layer
- Reads the SENTINAL skill definition (`openclaw-armoriq-skill/SKILL.md`)
- Proposes a JSON action array in response to each threat
- Called by `openclaw_runtime.py` inside the Response Engine

---

## ArmorClaw
- The **guarded policy enforcement concept** inside the Response Engine
- Implemented via `policy_engine.py` + `policy.yaml`
- Decides: which actions run automatically (low risk) vs. which are blocked for human approval (high risk)
- ArmorClaw is NOT a separate running service — it is the policy layer within the Response Engine

---

## Human Authorization Layer
- **UI:** `dashboard/src/pages/ActionQueuePage.jsx`
- High-risk actions blocked by ArmorClaw go here for approve/reject
- This is the ONLY place where human authorization happens
- Telegram bot (`@ayushASentinal_bot`) receives `send_alert` action notifications — it is NOT an authorization channel

---

## Quick Reference

| Name | Type | Location |
|---|---|---|
| Commercial ArmorIQ | External product | Not in this repo |
| SENTINAL Response Engine | Custom service | `services/sentinal-response-engine/` |
| OpenClaw | AI reasoning agent | Called via `openclaw_runtime.py` |
| ArmorClaw | Policy enforcement layer | `policy_engine.py` + `policy.yaml` |
| Detection Engine | Threat detection service | `services/detection-engine/` |
| Middleware/Gateway | Request proxy | `services/middleware/` |
| Dashboard | Frontend UI | `dashboard/` |
