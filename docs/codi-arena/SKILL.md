---
name: codi-arena-login
description: Integrate a booth game or app with "Login with Codi Arena" (the CODI ARENA NATIONAL 2026 hub as an OpenID Connect provider) - kids sign in by scanning their name-badge QR, the app reads their nickname and dressed Codi, and sends 0-3 stars back. Use when building, reviewing or debugging an app that signs kids in with Codi Arena, calls /oauth/*, /oauth/userinfo or /api/ext/play, or asks "how do I send stars to Codi Arena".
---

# Login with Codi Arena

The Codi Arena hub is a standard **OpenID Connect provider** (Authorization Code + PKCE S256, confidential clients).
Booth apps (CodeVenture first) let a kid sign in by scanning the QR on their name badge, show the kid's nickname and
dressed Codi, and send the booth's stars back. Full API: `reference.md` in this folder. Working example: `server.mjs`.

## Facts to get right

- **Issuer**: the hub URL the developer gives you (`CODI_ISSUER`). Discovery: `<issuer>/.well-known/openid-configuration`.
  Use an OIDC library (Node `openid-client` v6, Python `authlib`, Auth.js, Spring Security...), never hand-rolled JWT checks.
- **Credentials**: `client_id` (`cva_...`) and `client_secret` (`cvs_...`) come from the Dev Portal (`<issuer>/developers`).
  The secret lives **only on the app's server**, in an environment variable. Never in browser code, the repo, logs or a prompt.
- **Flow**: `/oauth/authorize` (response_type=code, PKCE S256 required, send `state` and `nonce`) -> the kid scans the
  badge and taps "ตกลง" on the hub -> back to `redirect_uri?code&state` -> `POST /oauth/token` (client_secret_basic or
  _post, with `code_verifier`) -> `GET /oauth/userinfo` with the Bearer access token.
- **Tokens**: access token 30 minutes, **no refresh token**, `id_token` RS256 (keys at `/oauth/jwks`). `prompt=none`
  always fails (`login_required`): every sign-in scans the badge again, because booth machines are shared.
- **Scopes**: `openid` (required) -> `sub` (the app's own stable id for the kid, not the badge code); `profile` ->
  `name`/`nickname`, `picture` (PNG, add `?size=128|256|512`), `arena_no`, `arena_avatar`; `arena.stars` ->
  `arena_stars`, `arena_rank`, `arena_booths`; `arena.play` -> may send stars. No real names, no parent data, ever.
- **Stars**: `POST <issuer>/api/ext/play` with `Authorization: Bearer <access_token>` and JSON
  `{ "id": "<your play id, 1-64 of A-Z a-z 0-9 . _ : ->", "stars": 0-3, "secret": false }`. The same `id` again
  records nothing (`"duplicate": true`), so retry with the same id. The hub keeps the kid's best stars per booth.
- **Modes**: a new app is in **test mode** (signs in test badges only; http://localhost redirects on any port; stars
  stay out of the event). **Live mode** needs an admin's approval in the Portal ("เปิดใช้จริง"), https redirect URIs,
  and sends stars to the approved game booth. Same client id and secret in both modes.

## When you build the integration

1. Put `CODI_ISSUER`, `CODI_CLIENT_ID`, `CODI_CLIENT_SECRET` in the server's environment; add the redirect URI to the
   app's Login settings in the Portal, character for character.
2. Start sign-in on the server: make `state`, `nonce` and a PKCE verifier, keep them in the device's session, redirect
   to the authorization URL with scope `openid profile arena.stars arena.play` (only what the app uses).
3. On the callback: handle `error=access_denied` (the kid said no: let them play without stars), then exchange the code
   with the library (it checks state, nonce, issuer, audience and the signature), then fetch userinfo.
4. Show the nickname and `picture?size=256`. Keep only `sub`, the run and its stars; nothing else about the kid.
5. Work out the stars **on the server** from the game result (never trust a number posted by the page), send them
   with a unique play id, queue and retry with the same id on network errors until the token expires.
6. "Next kid" clears the device's session. A 401 `invalid_token` means sign in again.
7. Time out hub calls at 5 seconds; if the hub is down, the kid plays on without stars and the game says so.

## When you debug

| Symptom | Cause |
|---|---|
| Hub page "แอปนี้ส่งมาจากที่อยู่ที่ไม่ได้ลงทะเบียนไว้" | `redirect_uri` is not exactly one registered in the Portal |
| Hub page "แอปนี้ยังไม่ได้ลงทะเบียนกับ Codi Arena" | wrong `client_id`, or the app was deleted or stopped |
| `error=test_off` | an admin turned test mode off (event day): use a live app |
| "app นี้อยู่ในโหมดทดสอบ ใช้ได้เฉพาะป้ายทดสอบ" | a real badge on a test-mode app |
| `invalid_grant` | code reused or older than 60 s, wrong `redirect_uri`, or wrong PKCE verifier |
| `invalid_client` (401) | wrong secret, or it was rotated in the Portal |
| `insufficient_scope` (403) on play | the token has no `arena.play` |
| `slow_down` (429) | over 120 requests a minute for the app |

The Portal shows each app's last error under its card, and its "ลองเลย" button signs in a test badge without code.

## Checklist before asking for live mode

- [ ] Signed in with a test badge and sent stars; the same play id twice gives `duplicate: true`
- [ ] Every redirect URI is https; logo, short description and privacy-policy link set in the Portal
- [ ] Secret only in the server's environment; not in git, the page or logs
- [ ] "Next kid" really signs the device out; denial and hub-down paths tested
- [ ] The booth MacBook/notebook camera works in the browser (System Settings > Privacy & Security > Camera)
