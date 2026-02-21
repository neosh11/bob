# Dependency Research (Snapshot)

Date: February 21, 2026
Source: npm registry + npm downloads API

## Selection Goals

- strong ecosystem adoption
- stable long-term maintenance
- fit for local network service with shared-password access
- extensible architecture for agent provider swaps

## Snapshot Data

| Package | Version | Last-week downloads |
|---|---:|---:|
| react | 19.2.4 | 73,485,836 |
| express | 5.2.1 | 67,367,773 |
| vite | 5.4.21 (selected), 7.3.1 latest | 53,460,104 |
| socket.io | 4.8.3 | 10,228,232 |
| socket.io-client | 4.8.3 | 7,512,312 |
| ws | 8.18.3 | 32,105,904 |
| @tanstack/react-query | 5.90.21 | 16,693,836 |
| zod | 4.3.6 | 85,283,370 |
| jsonwebtoken | 9.0.3 | 31,415,970 |
| better-sqlite3 | 12.6.2 | 3,172,912 |
| express-rate-limit | 8.2.1 | 18,384,430 |
| p-queue | 8.1.1 selected, 9.1.0 latest | 16,784,024 |
| pino | 10.3.1 | 21,266,580 |
| pino-http | 11.0.0 | 2,285,155 |
| typescript | 5.9.3 | 116,834,367 |

## Notes

- `vite` latest major requires newer Node (`^20.19`), so project pins Vite 5 for Node `20.8.0` compatibility.
- `express` 5 is now stable and aligns with the backend module architecture.
- `socket.io` chosen over ad-hoc SSE because bidirectional event support simplifies authenticated realtime updates.
- `ws` added as the mature, heavily adopted WebSocket client for the backend JSON-RPC bridge to `codex app-server`.
- `jsonwebtoken` retained for signed cookie sessions even with shared-password login, so route protection stays stateless and fast.
- `better-sqlite3` chosen for reliable local persistence and synchronous transaction behavior.
- `zod` used for request validation boundaries in both client and server layers.
- `express-rate-limit` added for baseline API and auth endpoint abuse protection with minimal operational overhead.
- `p-queue` added to enforce bounded run concurrency and prevent unbounded agent process fan-out.
- `pino` + `pino-http` added for structured request logging with low-overhead JSON logs and built-in serializer support.

## Security Design References

- OWASP Logging Cheat Sheet informed event content boundaries (record security-relevant context without sensitive secrets): [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- OWASP REST Security Cheat Sheet informed route protection expectations (strict authorization, fail-closed behavior): [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)

## Commands Used

```bash
curl -s "https://api.npmjs.org/downloads/point/last-week/<package>"
curl -s "https://registry.npmjs.org/<package>/latest"
```

## Package Links

- [react](https://www.npmjs.com/package/react)
- [express](https://www.npmjs.com/package/express)
- [vite](https://www.npmjs.com/package/vite)
- [socket.io](https://www.npmjs.com/package/socket.io)
- [socket.io-client](https://www.npmjs.com/package/socket.io-client)
- [ws](https://www.npmjs.com/package/ws)
- [@tanstack/react-query](https://www.npmjs.com/package/@tanstack/react-query)
- [zod](https://www.npmjs.com/package/zod)
- [jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken)
- [better-sqlite3](https://www.npmjs.com/package/better-sqlite3)
- [express-rate-limit](https://www.npmjs.com/package/express-rate-limit)
- [p-queue](https://www.npmjs.com/package/p-queue)
- [pino](https://www.npmjs.com/package/pino)
- [pino-http](https://www.npmjs.com/package/pino-http)
- [typescript](https://www.npmjs.com/package/typescript)
