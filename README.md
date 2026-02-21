# Bob

## Security First: Network Exposure

Bob can execute coding tasks on the host machine. Only expose it to trusted users and networks.

Default ports Bob uses:

- `5173/tcp` - web UI dev server (`apps/web`, Vite dev).
- `4000/tcp` - Bob API + Socket.IO realtime (`apps/server`).
- `4173/tcp` - optional web preview server (`npm run preview`).
- `8787/tcp` - Codex app-server websocket in `app-server` mode (`BOB_CODEX_APP_SERVER_LISTEN`, default `ws://127.0.0.1:8787`).

Recommended firewall posture:

- Allow inbound `5173/tcp` only from trusted client networks that should access the UI.
- Allow inbound `4000/tcp` only from those same trusted client networks (the browser calls API/realtime here).
- Block inbound `4173/tcp` unless you are actively using preview mode.
- Keep `8787/tcp` loopback-only (`127.0.0.1`) and block inbound access from non-local hosts.
- Default-deny all other inbound ports on the Bob host.

Notes:

- Bob does not open a separate inbound database port (SQLite is file-based).
- `BOB_HOST` controls API bind address (default `0.0.0.0`), so set it deliberately for your network model.

Bob is a local-first agentic coding service with a React frontend and TypeScript API backend.

The app is network-accessible (`0.0.0.0`) and protected by one shared password from environment configuration.

## What It Includes

- Cookie-based auth (`HttpOnly` JWT cookie)
- Shared-password sign-in (`BOB_SHARED_PASSWORD`)
- Persistent audit trail for auth/session/run actions
- SQLite persistence for sessions, messages, and runs
- Session-centric coding workflow
- Codex `app-server` backend for persistent threads/runs
- In-app Codex account auth (ChatGPT connect/cancel/refresh/disconnect)
- Legacy pluggable provider path (`mock` or `command`) retained behind `BOB_SESSIONS_BACKEND=legacy`
- Realtime run events over Socket.IO
- API and auth endpoint rate limiting
- Structured JSON request logging (`pino-http`)
- Modular frontend with React Router + TanStack Query

## Architecture

- `apps/server`
  - Express 5 API + Socket.IO server
  - SQLite (`better-sqlite3`)
  - `CodexService` bridges JSON-RPC to `codex app-server`
  - `RunOrchestrator` coordinates legacy provider run lifecycle and event streaming
- `apps/web`
  - React + Vite app (React Compiler enabled via `babel-plugin-react-compiler`)
  - protected routes, auth context, session UI, realtime updates

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env
```

3. Start backend + frontend:

```bash
npm run dev
```

- Web UI: `http://localhost:5173`
- API: `http://localhost:4000`

## PWA + iPhone Install

The web app now ships with:

- Web App Manifest (`manifest.webmanifest`)
- Service Worker (`sw.js`) via `vite-plugin-pwa`
- iOS install metadata (`apple-touch-icon`, standalone meta tags)

### Install on iPhone

1. Open Safari and navigate to Bob (for example `http://100.x.x.x:5173`).
2. Tap the Share button.
3. Tap `Add to Home Screen`.
4. Confirm the name and tap `Add`.

### Important secure-context note

- Service workers require a secure context (`https://`), except `localhost`.
- On plain `http://` LAN IPs, the app can still be added to home screen, but offline caching/background SW behavior is limited.
- For full PWA behavior on iPhone over network, serve the frontend over HTTPS (local cert reverse proxy/tunnel).

## Session Backend Setup

By default, Bob runs with `codex app-server` session backend.

Recommended `.env` defaults:

```bash
BOB_SESSIONS_BACKEND=app-server
BOB_CODEX_BIN=codex
BOB_CODEX_APP_SERVER_LISTEN=ws://127.0.0.1:8787
BOB_CODEX_APPROVAL_POLICY=never
BOB_CODEX_SANDBOX_MODE=danger-full-access
BOB_CODEX_MODEL=gpt-5-codex
BOB_CODEX_REASONING_EFFORT=medium
```

In this mode, sign in to Bob with the shared password first, then use the Codex account panel to connect ChatGPT before creating sessions or running tasks.

For legacy command-provider mode:

```bash
BOB_SESSIONS_BACKEND=legacy
BOB_AGENT_MODE=command
BOB_AGENT_HISTORY_WINDOW=12
BOB_AGENT_COMMAND=codex exec -m "{{model}}" -c model_reasoning_effort="{{reasoningEffort}}" --output-last-message "/tmp/bob-last-{{runId}}.txt" -C "{{workspace}}" "{{prompt}}" >/dev/null && cat "/tmp/bob-last-{{runId}}.txt"
```

Legacy command placeholders:

- `{{prompt}}`
- `{{latestPrompt}}`
- `{{history}}`
- `{{workspace}}`
- `{{sessionId}}`
- `{{runId}}`
- `{{model}}`
- `{{reasoningEffort}}`

`{{prompt}}` now includes a compacted history window and latest user turn, while `{{latestPrompt}}` is only the latest user text.

Use the `Agent` button in the top-right app header to update model and reasoning effort at runtime. New runs pick up the changes immediately.

## Queue + Cancellation

- `BOB_MAX_CONCURRENT_RUNS` controls concurrent provider executions.
- Runs beyond that limit remain queued.
- Active and queued runs can be canceled via:

```bash
POST /api/sessions/:sessionId/runs/:runId/cancel
```

Canceled runs are marked as failed with a cancellation reason for full audit visibility.

## Rate Limiting

- `BOB_RATE_LIMIT_WINDOW_MS`: limiter window duration.
- `BOB_RATE_LIMIT_MAX_REQUESTS`: max requests per IP for general API calls.
- `BOB_AUTH_RATE_LIMIT_MAX_REQUESTS`: tighter cap for auth endpoints.

## CORS Origin Policy

- `BOB_WEB_ORIGIN` sets the default exact allowed frontend origin.
- `BOB_WEB_ORIGIN_HOST_PREFIXES` optionally enables hostname-prefix matching.
- When `BOB_WEB_ORIGIN_HOST_PREFIXES` is set, only origins whose host starts with one of the prefixes are allowed.
  - Example: `BOB_WEB_ORIGIN_HOST_PREFIXES=100*` allows `http://100.x.x.x:5173` and blocks `http://192.168.x.x:5173`.

## Auth Model

- No account creation endpoints are exposed.
- `POST /api/auth/login` validates only the shared password (optional display name allowed).
- `POST /api/auth/logout` clears the auth cookie.
- `GET /api/auth/me` returns the authenticated identity from JWT claims.
- `GET /api/auth/codex/account` reports Codex account auth status.
- `POST /api/auth/codex/login/start` starts ChatGPT auth and returns `authUrl`.
- `POST /api/auth/codex/login/cancel` cancels a pending login.
- `POST /api/auth/codex/logout` disconnects the Codex account.
- `DELETE /api/sessions/:sessionId` deletes the session and cascades messages/runs.
- `GET /api/sessions?workspace=<absolute-path>` scopes session list to one configured workspace.

Audit events include actor, event type, target, outcome, timestamp, and optional metadata.

## Agent Settings API

- `GET /api/agent/settings`: read the active model + reasoning effort.
- `PUT /api/agent/settings`: update model + reasoning effort for new runs at runtime.
- The React app exposes this via the `Agent` button in the top bar.

## Verification Commands

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Manual Smoke Test (API)

```bash
# sign in with shared password
curl -X POST http://127.0.0.1:4000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"operator","password":"replace-with-shared-password"}'
```

Then open the web UI, connect Codex from the account panel, create a session, post a message, and verify run completion via `/api/sessions/:id`.

## Package Research

Package selection notes and npm adoption snapshots are documented in [`docs/research.md`](docs/research.md).
