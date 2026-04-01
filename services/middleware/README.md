# sentinel-middleware

Drop-in Express / Fastify middleware that silently forwards every HTTP request to the **SENTINAL Gateway** for real-time attack detection.

- ✅ Zero latency impact — fires **after** response is sent
- ✅ Automatic IP extraction (supports proxies via `X-Forwarded-For`)
- ✅ Scrubs sensitive headers (Authorization, Cookie, passwords in body)
- ✅ Retry queue — if Gateway is down, logs are queued and retried
- ✅ Works with Express 4/5 and Fastify 3/4

---

## Install

```bash
npm install sentinel-middleware
```

---

## Express Usage

```js
const express    = require('express');
const { sentinel } = require('sentinel-middleware');

const app = express();

app.use(sentinel({
  projectId:  'my-app',                          // required — identifies your app
  gatewayUrl: 'http://your-sentinal-host:3000',  // required — SENTINAL Gateway URL
  // optional:
  apiKey:     'your-api-key',                    // added as X-Sentinel-Key header
  sampleRate: 1.0,                               // 0.0–1.0, default 1.0 (100% of requests)
  ignoreRoutes: ['/health', '/metrics'],         // paths to never forward
  ignoreIPs:    ['127.0.0.1'],                   // IPs to never forward
  maxBodySize:  4096,                            // max bytes of body captured, default 4096
  timeout:      3000,                            // Gateway request timeout ms, default 3000
  onError:      (err) => console.error(err),     // custom error handler
  debug:        false,                           // log every forwarded request
}));

app.get('/', (req, res) => res.send('Hello World'));
app.listen(8080);
```

---

## Fastify Usage

```js
const fastify  = require('fastify')();
const { sentinelFastify } = require('sentinel-middleware/fastify');

fastify.register(sentinelFastify, {
  projectId:  'my-fastify-app',
  gatewayUrl: 'http://your-sentinal-host:3000',
});

fastify.get('/', async () => ({ hello: 'world' }));
fastify.listen({ port: 8080 });
```

---

## What Gets Captured

| Field | Source | Notes |
|-------|--------|-------|
| `method` | `req.method` | |
| `url` | `req.originalUrl` | Full path + query string |
| `ip` | `req.ip` | Respects `X-Forwarded-For` if `trust proxy` set |
| `queryParams` | `req.query` | |
| `body` | `req.body` | Truncated to `maxBodySize`, passwords scrubbed |
| `headers.userAgent` | `user-agent` header | |
| `headers.contentType` | `content-type` header | |
| `headers.referer` | `referer` header | |
| `responseCode` | `res.statusCode` | Captured after response finishes |
| `processingTimeMs` | `Date.now()` delta | Time from request start to response end |
| `projectId` | config | Your app identifier |

### What is NEVER captured
- `Authorization` header
- `Cookie` / `Set-Cookie` headers
- Fields named `password`, `secret`, `token`, `cvv`, `ssn`, `creditCard` in body

---

## Environment Variable Mode

```bash
SENTINAL_PROJECT_ID=my-app
SENTINAL_GATEWAY_URL=http://localhost:3000
SENTINAL_API_KEY=optional-key
SENTINAL_SAMPLE_RATE=1.0
SENTINAL_DEBUG=false
```

```js
// No config needed — reads from env automatically
app.use(sentinel());
```

---

## Retry Queue

If the Gateway is unreachable, failed logs are held in an in-memory queue (max 500 entries) and retried every 10 seconds. Queue size is logged at warn level.
