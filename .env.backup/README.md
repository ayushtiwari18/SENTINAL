# .env.backup — Service-Level Environment File Backups

This directory stores the **original per-service `.env.example` files** that existed
before the centralized environment system was introduced.

These files are kept for reference only. All environment variables have been
consolidated into the root `/.env.example` file.

## Backed Up Files

| Original Location | Backup File |
|---|---|
| `backend/.env.example` | `backend.env.example` |
| `services/Nexus-agent/.env.example` | `Nexus-agent.env.example` |
| `services/pcap-processor/.env.example` | `pcap-processor.env.example` |

## Status

The original `.env.example` files remain in their service directories for
backward compatibility. This backup is an archive reference.

## Do NOT put real `.env` files here

Real `.env` files with secrets must never be committed to Git.
