# Route: `/attacks/:id` — Forensics Report

## Purpose
Full forensic investigation page for a single attack event.
Shows everything: raw request, AI explanation, IP history, attack chain timeline.

---

## Layout

```
[← Back to Attacks]

[Attack header: type badge | severity badge | status | timestamp]

Row 1 (2 columns):
  [Attack Details]           [IP Intelligence]
  type, severity,            IP, requests 24h,
  status, confidence,        total attacks ever,
  detected by,               first/last seen,
  response code              attack types seen

Row 2 (full width):
  [Raw Request]
  method | url | headers | body | query params

Row 3 (full width):
  [AI Explanation]
  parsed JSON: summary, what_happened, potential_impact, recommended_action

Row 4 (full width):
  [Attack Chain Timeline]
  pattern label
  timeline table: time | method | url | response code
```

---

## Data Source

- **API**: `GET /api/attacks/:id/forensics`
- **URL param**: `:id` is the MongoDB `_id` of the AttackEvent
- **Full response shape**:
  ```json
  {
    "success": true,
    "message": "Operation successful",
    "data": {
      "attack": {
        "id":          "ObjectId string",
        "attackType":  "sqli",
        "severity":    "high",
        "confidence":  0.92,
        "status":      "attempt",
        "detectedBy":  "rule",
        "payload":     "' OR 1=1 --",
        "explanation": "{\"summary\":\"...\",\"what_happened\":\"...\",\"potential_impact\":\"...\",\"recommended_action\":\"...\"}",
        "timestamp":   "2026-03-25T10:00:00.000Z"
      },
      "raw_request": {
        "method":      "POST",
        "url":         "/api/login?input=%27+OR+1%3D1+--",
        "ip":          "192.168.1.101",
        "headers":     { "userAgent": "...", "contentType": "...", "referer": "" },
        "body":        {},
        "queryParams": { "input": "' OR 1=1 --" },
        "responseCode": 200
      },
      "ip_intel": {
        "ip":                  "192.168.1.101",
        "total_requests_24h": 14,
        "total_attacks_ever": 6,
        "first_attack":       "2026-03-24T08:00:00.000Z",
        "last_attack":        "2026-03-25T10:00:00.000Z",
        "attack_types_seen":  ["sqli", "xss", "traversal"]
      },
      "attack_chain": {
        "timeline": [
          { "time": "2026-03-25T09:55:00.000Z", "method": "GET", "url": "/login", "code": 200 },
          { "time": "2026-03-25T10:00:00.000Z", "method": "POST", "url": "/api/login", "code": 200 }
        ],
        "pattern_label": "Focused single-vector attack",
        "all_attacks": [ ...AttackEvent objects... ]
      }
    }
  }
  ```

---

## Explanation Field Parsing

The `attack.explanation` field is a **JSON string** serialized from the LLM response.
Always parse it:

```js
let explanation = {};
try {
  explanation = JSON.parse(data.attack.explanation);
} catch {
  explanation = { summary: data.attack.explanation };
}
```

Expected keys after parse:
- `explanation.summary`
- `explanation.what_happened`
- `explanation.potential_impact`
- `explanation.recommended_action`
- `explanation.rule_triggered` (may be absent)

**PITFALL**: Do not render `attack.explanation` as raw string. Always try to parse first.

---

## Files
```
src/pages/ForensicsPage.jsx
src/components/forensics/RawRequestBlock.jsx
src/components/forensics/IpIntelBlock.jsx
src/components/forensics/AttackChainTimeline.jsx
```

---

## AI Build Instructions

```
You are building the Forensics page for SENTINAL.
Route: /attacks/:id
Data: GET /api/attacks/:id/forensics via getForensics(id) from src/services/api.js

Steps:
1. Extract id from URL using useParams()
2. Call getForensics(id) on mount via useApi hook
3. Parse attack.explanation with JSON.parse, fallback to { summary: raw string }
4. Render 4 sections: Attack Details, Raw Request, AI Explanation, Attack Chain

Key field names (exact):
- data.attack.id              (NOT _id on this endpoint)
- data.attack.attackType
- data.attack.severity
- data.attack.confidence
- data.attack.status
- data.attack.detectedBy
- data.attack.payload
- data.attack.explanation     (JSON string — must parse)
- data.attack.timestamp
- data.raw_request.method
- data.raw_request.url
- data.raw_request.ip
- data.raw_request.headers    (object: userAgent, contentType, referer)
- data.raw_request.body       (object)
- data.raw_request.queryParams (object)
- data.raw_request.responseCode
- data.ip_intel.ip
- data.ip_intel.total_requests_24h
- data.ip_intel.total_attacks_ever
- data.ip_intel.first_attack
- data.ip_intel.last_attack
- data.ip_intel.attack_types_seen  (array of strings)
- data.attack_chain.timeline   (array of { time, method, url, code })
- data.attack_chain.pattern_label

Pitfalls:
- raw_request can be null if the SystemLog was deleted — always null-check
- headers is { userAgent, contentType, referer } NOT a Headers object
- timeline is capped at 20 in display, but may have more entries
- id in URL param matches data.attack.id (ObjectId string)
- No socket on this page
- Back button: useNavigate(-1) or Link to /attacks
```
