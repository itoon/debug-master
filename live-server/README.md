# debug-master-live

Cloudflare Worker + Durable Object (`LiveRoom`) for the Debug Master **Live Race Room**.
One Durable Object per room code holds the room state, the round clock (alarms) and every
WebSocket (hibernatable). Room rules are pure functions in `src/room-logic.ts`; the shared
protocol lives in `../app/utils/live/protocol.ts`.

## Endpoints

| Request | Response |
|---|---|
| `GET /health` | `200 ok` |
| `GET /rooms/:code/ws?role=player\|host\|screen[&key=…]` | WebSocket upgrade (`426` without one, `403` for an Origin not in `ALLOWED_ORIGINS`, `400` for a bad room code or role) |

`:code` must match `^[A-Z0-9-]{3,16}$` (lower case is upper-cased). `key` is only forwarded for
`role=host` and only when it matches `^[A-Za-z0-9_-]{16,64}$`. Requests without an `Origin`
header (tools, the smoke script) are allowed.

## Develop

Use Node 22.

```bash
pnpm --dir live-server install
pnpm --dir live-server dev        # wrangler dev on http://127.0.0.1:8787 (local DO + storage in .wrangler/)
pnpm --dir live-server smoke      # in another terminal: end-to-end check, prints "smoke ok"
pnpm --dir live-server typecheck
pnpm --dir live-server test       # vitest for room-logic / validate
```

Point the game at it with `NUXT_PUBLIC_LIVE_URL=http://127.0.0.1:8787` (the smoke script reads
`LIVE_URL` if the server runs elsewhere).

After changing `wrangler.jsonc` regenerate the runtime types:

```bash
pnpm --dir live-server types      # writes src/worker-configuration.d.ts (commit it)
```

## Deploy

```bash
npx wrangler login                # once per machine
pnpm --dir live-server deploy     # wrangler deploy -> https://debug-master-live.<account>.workers.dev
```

The Durable Object needs a plan that supports SQLite-backed Durable Objects (migration `v1`).
Use the deployed `https://…workers.dev` origin as `NUXT_PUBLIC_LIVE_URL` when building the game.

## `ALLOWED_ORIGINS`

Comma-separated list of page origins that may open a room socket, set in `wrangler.jsonc`
under `vars` (default `https://itoon.github.io,http://localhost:3000`). Origins are compared
exactly: scheme + host + port, no trailing slash. To add an origin, edit the list and redeploy,
or override it for one deploy:

```bash
pnpm --dir live-server deploy --var ALLOWED_ORIGINS:https://itoon.github.io,https://booth.example
```

## Runbook

**Host key lost** (the browser that created the room was cleared, or the host link is gone):
the server only stores a SHA-256 of the key, so it cannot be recovered or reset. **Create the
room again with a new room code** on `/live/host` and point the big screen and players at the
new code. The old room is wiped automatically 6 hours after its last activity.

**Room stuck or abandoned:** a running round still finishes at `endAt` by itself; with no
sockets left, the room's storage is deleted 6 hours after the last activity or disconnect.

**Logs:** `observability.redact_query_string` is on, so host keys in `?key=` never reach logs.
