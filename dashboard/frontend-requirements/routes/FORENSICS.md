# Route: `/attacks/:id` — Forensic Investigation

## Purpose
Full forensic investigation page for a single attack event.
The operator lands here from the Attacks table by clicking "Investigate".
Shows the complete evidence record: attack metadata, raw request,
AI explanation, IP intelligence, and attack chain timeline.

## Inspiration
- https://vercel.com/deployments/:id — tabbed detail page, clear sections
- https://grafana.com — evidence block layout, timeline visualization
- Security tool incident report pages — structured evidence sections

---

## Layout

```
[PageWrapper fade-in]

[Back button]  ← Back to Attacks

Page Title: "Forensic Report"
Subtitle: Attack ID: <id> | <attackType> | <SeverityBadge>

[Section 1: Attack Summary]
  Panel — title: "Attack Summary"
  Two-column grid:
    Left:  Type / Severity / Status / Detected By / Confidence / Timestamp
    Right: Payload (code block) + AI Explanation (parsed)

[Section 2: AI Explanation]
  Panel — title: "AI Analysis"
  Fields from parsed explanation JSON:
    Summary      — body text
    What Happened — body text
    Potential Impact — body text
    Recommended Action — highlighted box
    Rule Triggered — mono tag

[Section 3: Raw HTTP Request]
  Panel — title: "Raw Request"
  If null: "Raw request data unavailable."
  Fields: Method | URL | IP | Response Code
  Headers: code block
  Query Params: code block
  Body: code block

[Section 4: IP Intelligence]
  Panel — title: "IP Intelligence"
  Fields: IP | Requests (24h) | Total Attacks | First Attack | Last Attack
  Attack Types Seen: tag list

[Section 5: Attack Chain]
  Panel — title: "Attack Chain"
  Pattern label: highlighted
  Timeline table: Time | Method | URL | Code
  If timeline empty: "Single isolated request."
```

---

## Component Tree

```
ForensicsPage.jsx (page)
├── PageWrapper
├── back button + title header
├── RawRequestBlock.jsx
├── IpIntelBlock.jsx
└── AttackChainTimeline.jsx
```

---

## API Call

- **Endpoint**: `GET /api/attacks/:id/forensics`
- **Function**: `getForensics(id)` from `services/api.js`
- **Trigger**: On mount, using `id` from `useParams()`
- **No polling** — forensics data is static per attack
- **No socket** — this is a read-only investigation page

**Response shape** (`response.data.data`):
```json
{
  "attack": {
    "id":          "ObjectId",
    "attackType":  "sqli",
    "severity":    "high",
    "confidence":  0.92,
    "status":      "attempt",
    "detectedBy":  "rule",
    "payload":     "' OR 1=1 --",
    "explanation": "{\"summary\":\"...\",\"what_happened\":\"...\",\"potential_impact\":\"...\",\"recommended_action\":\"...\",\"rule_triggered\":\"...\"}",
    "timestamp":   "ISO timestamp"
  },
  "raw_request": {
    "method":       "POST",
    "url":          "/api/login",
    "ip":           "192.168.1.101",
    "headers":      { "userAgent": "...", "contentType": "...", "referer": "" },
    "body":         {},
    "queryParams":  {},
    "responseCode": 200
  },
  "ip_intel": {
    "ip":                 "192.168.1.101",
    "total_requests_24h": 14,
    "total_attacks_ever": 6,
    "first_attack":       "ISO timestamp or null",
    "last_attack":        "ISO timestamp or null",
    "attack_types_seen":  ["sqli", "xss"]
  },
  "attack_chain": {
    "timeline": [
      { "time": "ISO", "method": "GET", "url": "/login", "code": 200 }
    ],
    "pattern_label": "Focused single-vector attack",
    "all_attacks":   []
  }
}
```

---

## Field Mapping

| UI Element | Source | Notes |
|-----------|--------|-------|
| Attack type | `data.attack.attackType` | `<AttackTypeTag>` |
| Severity | `data.attack.severity` | `<SeverityBadge>` |
| Status | `data.attack.status` | `STATUS_COLORS[data.attack.status]` |
| Confidence | `data.attack.confidence` | `formatConf()` |
| Detected By | `data.attack.detectedBy` | plain text |
| Timestamp | `data.attack.timestamp` | `formatDate()` |
| Payload | `data.attack.payload` | `<pre>` block, mono font |
| Explanation | `data.attack.explanation` | `parseExplanation()` — JSON string |
| Raw Request | `data.raw_request` | null-check: `data.raw_request ?? null` |
| Response Code | `data.raw_request?.responseCode` | null → `'—'` |
| IP | `data.ip_intel.ip` | mono font |
| Requests 24h | `data.ip_intel.total_requests_24h` | number |
| Total Attacks | `data.ip_intel.total_attacks_ever` | number |
| First Attack | `data.ip_intel.first_attack` | `formatDate()`, null → `'—'` |
| Last Attack | `data.ip_intel.last_attack` | `formatDate()`, null → `'—'` |
| Types Seen | `data.ip_intel.attack_types_seen` | Tag list |
| Pattern | `data.attack_chain.pattern_label` | highlighted text |
| Timeline | `data.attack_chain.timeline[]` | `time/method/url/code` |

---

## States

| State | Display |
|-------|---------|
| Loading | `<LoadingState message="Loading forensic report..." />` |
| Error | `<ErrorState message="Forensic data unavailable" onRetry={refetch} />` |
| 404 | Show: "Attack not found." + back button |
| `raw_request` null | Panel shows: "Raw request data unavailable for this attack." |
| Timeline empty | "Single isolated request — no chain detected." |
| `attack_types_seen` empty | Show `'—'` |

---

## ⚠️ Pitfalls

1. `attack.id` on forensics endpoint — NOT `attack._id`
2. `attack.explanation` is a **JSON string** — ALWAYS use `parseExplanation()` from utils/format.js
3. `raw_request` can be `null` — check before rendering any field
4. `timeline[].code` is key `code` NOT `responseCode`
5. `ip_intel.first_attack` and `last_attack` can be `null`
6. `id` param from `useParams()` is the `_id` from the REST response (not socket `id`)
7. No polling, no socket — load once on mount only

---

## AI Build Instructions

```
You are building the Forensics page for SENTINAL.

Route: /attacks/:id
Get the id with: const { id } = useParams()
Wrap in PageWrapper. AppLayout wraps via router.

Data:
1. Call getForensics(id) on mount ONLY — no polling, no socket
2. API returns { attack, raw_request, ip_intel, attack_chain }
   All inside response.data.data (NOT response.data)

CRITICAL:
- attack.explanation is a JSON string — call parseExplanation(data.attack.explanation)
  parseExplanation is in src/utils/format.js
  Returns: { summary, what_happened, potential_impact, recommended_action, rule_triggered }
- attack.id (NOT attack._id) on this endpoint
- raw_request may be null — null-check everything
- timeline[].code (NOT responseCode)

Back button:
  useNavigate() → navigate('/attacks') or navigate(-1)
  Show: "← Back to Attacks"

Section 1 — Attack Summary (Panel):
  Left column: Type | Severity | Status | Detected By | Confidence | Time
  Right column: Payload in <pre> block

Section 2 — AI Analysis (Panel):
  Render each key from parseExplanation result
  summary: paragraph
  what_happened: paragraph
  potential_impact: paragraph
  recommended_action: highlighted box (--color-accent-dim border)
  rule_triggered: mono tag
  Only render keys that exist (some may be absent)

Section 3 — Raw Request (Panel):
  if (!data.raw_request) show EmptyState message="Raw request data unavailable."
  else: table of method/url/ip/responseCode + code blocks for headers/queryParams/body
  responseCode null → '—'
  Use fmtJson() for all objects

Section 4 — IP Intelligence (Panel):
  Table: ip | requests_24h | total_attacks | first_attack | last_attack
  attack_types_seen: render each as a tag (span with sev-style)
  All nulls → '—'

Section 5 — Attack Chain (Panel):
  Pattern label: styled text, --color-accent
  if timeline.length === 0: EmptyState "Single isolated request — no chain detected."
  else: table with columns Time | Method | URL | Code
  Show max 20 rows

Loading: <LoadingState message="Loading forensic report..." />
Error: <ErrorState message="Forensic data unavailable" onRetry={refetch} />
404 case: if error includes 'not found', show special message + back button
```
