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
pnpm --dir live-server run deploy     # wrangler deploy -> https://debug-master-live.<account>.workers.dev
```

Use `run deploy`: plain `pnpm deploy` is a pnpm built-in and does not run the package script.

The Durable Object needs a plan that supports SQLite-backed Durable Objects (migration `v1`).
Use the deployed `https://…workers.dev` origin as `NUXT_PUBLIC_LIVE_URL` when building the game.

### Wire the Worker into the GitHub Pages build

`.github/workflows/deploy.yml` passes `NUXT_PUBLIC_LIVE_URL: ${{ vars.LIVE_URL }}` to the
`Build for GitHub Pages` step. Do this once, by hand:

1. Deploy the Worker (above) and copy its origin, e.g. `https://debug-master-live.<account>.workers.dev`
   (no trailing slash, no path).
2. In the GitHub repository go to **Settings → Secrets and variables → Actions → Variables** and
   create a **repository variable** named `LIVE_URL` with that origin. (It is a variable, not a
   secret: the URL ends up in the public bundle.)
3. Re-run the `Deploy to GitHub Pages` workflow (or push to `main`).

If `LIVE_URL` is unset the build gets an empty `NUXT_PUBLIC_LIVE_URL` and the game behaves exactly
as before (no Live mode). `wrangler login` and `wrangler deploy` are run by the repo owner, not CI.

### Lane textures

The big screen's lanes use `public/tiles/*.png`. They must be **committed** before the Pages
build, otherwise the textures 404 in production. (At the time of writing they are untracked local
files; add them in their own commit.)

## `ALLOWED_ORIGINS`

Comma-separated list of page origins that may open a room socket, set in `wrangler.jsonc`
under `vars` (default `https://itoon.github.io,http://localhost:3000`). Origins are compared
exactly: scheme + host + port, no trailing slash. To add an origin, edit the list and redeploy,
or override it for one deploy:

```bash
pnpm --dir live-server run deploy --var ALLOWED_ORIGINS:https://itoon.github.io,https://booth.example
```

## Runbook

**Host key lost** (the browser that created the room was cleared, or the host link is gone):
the server only stores a SHA-256 of the key, so it cannot be recovered or reset. **Create the
room again with a new room code** on `/live/host` and point the big screen and players at the
new code. The old room is wiped automatically 6 hours after its last activity.

**Room stuck or abandoned:** a running round still finishes at `endAt` by itself; with no
sockets left, the room's storage is deleted 6 hours after the last activity or disconnect.

**Logs:** `observability.redact_query_string` is on, so host keys in `?key=` never reach logs.

## Rehearsal

Run before every event. Start `pnpm --dir live-server dev` and
`NUXT_PUBLIC_LIVE_URL=http://127.0.0.1:8787 pnpm dev --port 3000`, create a room on `/live/host`,
open the big screen at `/live/screen?room=CODE`, and join with three more players at `/?room=CODE`
(at least one real phone; a phone on the LAN needs its page origin added to `ALLOWED_ORIGINS`
with `wrangler dev --var`, never by editing `wrangler.jsonc`). Each player needs its own browser
profile or device, because the player id is stored in localStorage.

1. Join the room, then pick a mode and a time (use "custom 1 minute" to rehearse quickly).
2. Start, and check the countdown is in sync on every screen.
3. Turn one player's network off for 10 seconds, turn it back on, and check the score catches up.
4. Reload the big screen mid-round.
5. Scan in during a round and check the newcomer is queued.
6. Let the time run out and check the results match on every screen.
7. Start a new round and check queued players get to play.
8. Try a 13th player and check "room full" is shown.

`pnpm --dir live-server smoke` covers the protocol end to end without browsers.
