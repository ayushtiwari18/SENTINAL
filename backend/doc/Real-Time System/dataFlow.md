Attack reported
      │
      ▼
attackService.reportAttack()
      │
      └──► eventEmitter.emit('attack:new', attackData)
                  │
                  ▼
          broadcastService (listener)
                  │
                  └──► io.emit('attack:new', attackData)
                              │
                        ┌─────┴──────┐
                   Dashboard A   Dashboard B
                  (React client) (React client)
