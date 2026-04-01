POST /api/logs/ingest
        │
        ▼
  logController.ingest()
        │
        ├──► logService.ingestLog()  ──► MongoDB (immediate)
        │          │
        │          └──► detectionConnector.analyze(log)  ←── NEW
        │                     │
        │               [async, non-blocking]
        │                     │
        │                     ▼
        │            POST http://localhost:8002/analyze
        │                  (with retry + timeout)
        │                     │
        │              ┌──────┴──────┐
        │           success        failure
        │              │              │
        │    attackService       log error,
        │    .reportAttack()     continue silently
        │
        └──► return 201 to caller immediately (never waits for detection)
