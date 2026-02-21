# Repository Guidelines

## Project Structure

- `apps/server` contains the backend API, auth, persistence, realtime gateway, and run orchestration.
- `apps/web` contains the React client, auth UX, session flows, and realtime cache updates.
- `docs` stores architecture and dependency decision notes.

## Engineering Rules

- Keep modules focused and composable.
- Prefer files under ~250 lines when practical.
- Extract shared logic rather than duplicating route or UI behavior.
- Preserve provider abstraction in `apps/server/src/agent`.
- Do not hardcode environment-specific paths outside `.env` defaults.
- Keep cancellation and queue logic centralized in orchestration layer, not route handlers.
- Keep shared-password auth checks centralized in auth routes/middleware.
- Keep audit logging centralized in `audit` service and avoid ad-hoc DB writes from route handlers.
- Keep command placeholder interpolation shell-safe by passing runtime values through environment indirection (avoid direct prompt injection into shell command strings).
- In app-server mode, handle stale local sessions gracefully (thread missing/not loaded/not materialized) so they can still be inspected and deleted.
- In app-server mode, preserve first-class lifecycle semantics: initialize handshake, thread start/resume/fork, turn start/steer/interrupt, and realtime item/turn events.
- In app-server mode, always send sandbox policy on `turn/start` (not only `thread/start`) so resumed threads keep the configured access level after server/app-server restarts.
- Graceful shutdown must aggressively close HTTP, websocket, and child app-server resources so dev restarts do not leave `:4000` occupied.

## Security and Access

- Authentication is cookie-based with `HttpOnly` session cookie.
- Shared password is configured via `BOB_SHARED_PASSWORD`; do not add account-creation flows.
- When `BOB_SESSIONS_BACKEND=app-server`, Codex account auth must go through the in-app ChatGPT connect flow (`/api/auth/codex/*`) and no separate user-account system should be introduced.
- CORS policy may be exact-origin or hostname-prefix based (`BOB_WEB_ORIGIN_HOST_PREFIXES`); preserve fail-closed behavior.
- Agent model controls are runtime-configurable via `/api/agent/settings`; keep validation strict and fail-closed.
- All protected API routes must use `requireAuth`.
- Workspace execution must remain restricted to configured `BOB_WORKSPACES`.

## Testing Requirements

Run all of the following before finishing substantial changes:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Manual checks are required for:

- login/logout flow
- Codex account connect/cancel/refresh/disconnect flow in app-server mode
- session create/select flow
- run lifecycle (`queued` -> `running` -> terminal state)
- run lifecycle refresh semantics (`running` must survive page refresh until `turn/completed` arrives)
- run cancellation (active and queued)
- run steering (`/runs/:runId/steer`) and session forking (`/sessions/:sessionId/fork`) in app-server mode
- session deletion (including active-run sessions)
- realtime event updates in the active session
- rate-limit behavior for both general API and auth endpoints
- shared-password auth behavior: valid password accepted, invalid password denied, no bootstrap/admin endpoints exposed
- audit trails: verify key auth/session/run events are recorded

## Backend Conventions

- Keep route handlers thin; place stateful logic in orchestrator/repositories.
- Validate request payloads with `zod`.
- Persist all run outputs and status transitions.

## Frontend Conventions

- Keep API requests in feature-level `*Api.ts` modules.
- Keep query keys centralized under each feature.
- Realtime event handling should update query cache via pure helpers.
- Maintain mobile-safe layouts and avoid fixed-width overflow.
- Keep the mobile session header as two rows: row 1 for title/actions, row 2 for workspace path with horizontal scrolling for long paths.
- Represent run status in the header with compact dot indicators (no text pills): pulsing green for running, solid green for done, with distinct colors for queued/failed.
- Keep assistant responses expanded by default. System/reasoning entries may be toggleable, but should render as flat gray rows with button-only toggles (no collapsed preview cards).
- Keep PWA assets coherent (`manifest`, icons, SW registration) and validate iOS install behavior after changes.
- Remember service workers require secure context; do not assume full offline behavior on plain LAN HTTP origins.
- Render assistant/system rich text via markdown-safe components instead of raw HTML injection.

## Dependency Policy

- Favor mature, widely adopted packages.
- Record major dependency decisions and adoption evidence in `docs/research.md`.

## Change Documentation

When behavior changes:

- update `README.md` setup or usage notes
- update this `AGENTS.md` if workflow expectations changed
- update `docs/research.md` if dependency choices changed
