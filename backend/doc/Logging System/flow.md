Incoming Request
      │
      ▼
[Morgan middleware]  →  logs to Winston HTTP stream
      │
      ▼
[Route Handler]
      │
      ├── success  →  winston.info()
      └── error    →  winston.error()
                          │
                    ┌─────┴──────┐
               Console         logs/
               (dev)        ├── combined.log
                            └── error.log
