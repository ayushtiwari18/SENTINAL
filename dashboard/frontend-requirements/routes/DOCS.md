# Route: `/docs` — Integration & API Reference

## Purpose
Developer guide. Explains how to install the middleware, what data it sends,
and documents every API endpoint with request/response examples.

This page is STATIC — no API calls.

---

## Layout

```
[Page title: Documentation]

[Sidebar / Tab bar]:
  Getting Started
  Middleware Config
  API Reference
  Socket Events
  Data Models

[Content area]
```

---

## Sections

### Getting Started
```
1. npm install @sentinal/middleware
2. const sentinal = require('@sentinal/middleware');
   app.use(sentinal({ projectId: 'my-app', gatewayUrl: 'http://localhost:3000' }));
3. Open http://localhost:5173 to see attacks in real time
```

### Middleware Config Options
```
projectId     string   required  Unique identifier for your app
gatewayUrl    string   required  URL of the SENTINAL gateway
timeout       number   optional  Request timeout ms (default: 5000)
exclude       string[] optional  URL paths to skip monitoring
```

### API Reference
Document every working endpoint with:
- Method + path
- Description
- Request example
- Response example (exact JSON shape)

Endpoints to document:
1. POST /api/logs/ingest
2. GET /api/logs/recent
3. GET /api/attacks/recent
4. GET /api/attacks/:id/forensics
5. GET /api/stats
6. GET /api/service-status
7. GET /api/alerts
8. PATCH /api/alerts/:id/read
9. GET /api/health

### Socket Events
Document:
- attack:new
- alert:new
- service:status
- stats:update

For each: event name, when it fires, full payload shape.

### Data Models
Document:
- AttackEvent (all fields, types, enum values)
- SystemLog (all fields)
- Alert (all fields)

---

## Files
```
src/pages/Docs.jsx
```

---

## AI Build Instructions

```
You are building the Docs page for SENTINAL.
Route: /docs

This page is fully static — no API calls, no socket.

Structure:
- Left sidebar (fixed): links to sections on same page (anchor scroll)
- Right content: sections with prose, code blocks, tables

Code blocks:
- Use <pre><code> tags
- Mono font (JetBrains Mono)
- Background #1a1a1a, border 1px solid #2a2a2a
- Manual syntax highlighting with <span> color tags

Content:
- Copy exact API response shapes from this file
- Enum values must match exactly: sqli|xss|traversal|command_injection|ssrf|lfi_rfi|brute_force|hpp|xxe|webshell|unknown

Pitfalls:
- Do not use any markdown rendering library
- Render all content as plain JSX
- Anchor links: use id attributes on section headers + href="#section-id"
```
