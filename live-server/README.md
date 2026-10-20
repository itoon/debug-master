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


## Authoritative scoring and coordinated protocol rollout

Deploy the matching client and Worker together: `LIVE_PROTOCOL_VERSION = 1` replaces cumulative
`progress` with immutable ordered `gameplay` events (`ready`, `direction`, `reset`). The Worker
solves the configured level program and validates every direction, level, sequence and timestamp;
client-supplied totals/stars are never accepted. An old cumulative client receives a reload request.
No previous-formula score conversion or history migration is provided.

The round freezes set, numeric difficulty and BEST/LATEST strategy at start. Difficulty defaults to
1 independently of mode A/B/C; strategy defaults to BEST. Completed-level points are
`round(1000 * (1 + .5 * (stars - 1)) * (1 + .25 * (difficulty - 1)) / log10(seconds + 10))`.
Use fractional elapsed seconds and round once per level. Zero mistakes give three stars, one gives
two, and two or more give one; incomplete levels score zero. Retry/reset retain the first-ready
clock and mistakes. The public standings and podium include only the current round's values.

Players receive a private canonical session and `acknowledgedSequence`/`nextExpectedSequence`
after hello and host start. Host/screen sockets never receive private ledgers. Each gameplay
candidate is persisted before publication and acknowledgement. The Worker retains the newest
`LIVE_REPLAY_WINDOW = 64` accepted event fingerprints/optional receipts and clears redundant
Live reducer operation history. An older already-accepted sequence returns the canonical session
and sequence without a receipt or delta. This still prevents applying it twice.

The browser persists each immutable input before sending, in an outbox scoped by room, round,
public player and session. After reconnect/reload it reconciles the private accepted prefix, then
replays the unacknowledged suffix before enabling fresh input after recovery. During established play, durable inputs pipeline without waiting for acknowledgements and may queue while offline. Partial acknowledgements only trim the accepted prefix; they do not rewind the board or retransmit the already-inflight suffix. Gameplay never uses socket coalescing.
A missing acknowledgement requests another hello/private snapshot after five seconds. A new private round arriving before public state is buffered until the public round matches; missing handshakes use bounded retries. Storage
failure blocks new input and offers reload; reload restores accepted cursor/mistakes/time. Scores,
completion count and popup deltas come from accepted server data. Live results are never copied
into the ordinary browser leaderboard store. Practice remains unscored; ordinary/Dead scoring
continues entirely in the browser, with Dead's five hearts and generated levels preserved.

`room.phase`/`room.endAt` define results, including End Early's shortened deadline. The frozen
session deadline may be later. A final input at/before endAt may arrive during the two-second
grace; later new evidence is rejected. The session may remain active during results to support
this grace. Exact harmless duplicates still acknowledge after grace. A rejected immutable suffix
is discarded and input stops in a terminal recovery/result state rather than resending forever.
A new round has fresh sessions and sequences, and cannot inherit a prior-round best.

Smoke uses real ready/right/right/right gameplay, checks perfect/one-mistake canonical scores,
private/public agreement, duplicate and lost-ack reconnect, queue/privacy, shortened deadline,
grace expiry, rollover zero scores and kick. Local browser rehearsal should also exercise a
narrow screen's storage recovery and actual offline/reconnect. A real phone/LAN rehearsal remains
necessary for deployment-specific origin and network behavior.
