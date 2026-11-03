# Browser-scored challenge runs reach the Scoreboard through a Worker relay

Debug Master scores challenge runs in the browser and is hosted as a static site, but the Codi Arena Scoreboard's API key must stay on a server, and Guests (typed nicknames) can only be submitted with that key. We submit both Hub Players and Guests through one origin-checked relay route on the existing `live-server` Cloudflare Worker, which holds the key as a secret, and we knowingly accept that the score itself is whatever the browser reports. Moving scoring to a server would mean rewriting the game, which we ruled out for the 2026 event. Booths are staffed kiosks, and the mitigations are the Board's `maxScore`, the Scoreboard's per-player rate limit and admin score deletion.

## Considered Options

- **Hub token mode from the browser for Hub Players**: avoids the key for them, but `/oauth/complete` would have to return the access token, it still trusts the browser's score, and Guests would need the relay anyway — so two submit paths for no real gain.
- **Server-side scoring**: the only real fix for forged scores; rejected as too large for this event.
