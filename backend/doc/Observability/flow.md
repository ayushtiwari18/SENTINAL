React Dashboard
      │
      ├── GET /api/stats           → counts + breakdowns + recent attacks
      └── GET /api/service-status  → ping each Python service, return status
               │
               ├── ping :8002 (detection-engine)
               ├── ping :8001 (pcap-processor)
               └── ping :8003 (sentinal-response-engine)
                        │
                   save result to ServiceStatus collection
                   return all statuses in one response
