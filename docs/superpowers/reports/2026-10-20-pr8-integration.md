# PR 8 integration verification

The scoring branch incorporates `main` at `31c449c` before PR review. The primary workspace remains on its existing checkout; conflict resolution and validation use an isolated local clone.

## Resolution

- Preserve `main`'s shared competition-duration setting, five-minute defaults, mobile layout, guided practice, exit controls, and HTTP/LAN storage coordination.
- Combine saved duration and per-mode BEST/LATEST overrides when resolving Home boards and creating sessions. Reset and cross-tab subscriptions cover visibility, duration, and strategy together. Running sessions retain frozen configuration.
- Keep the IndexedDB coordination fallback generic: it returns the mutation's canonical receipt after transaction completion. Session creation uses the existing HTTP-compatible identity helper.
- Preserve both branches' handoff history. Update existing test fixtures to explicitly model secure contexts, and align intentional five-minute preset/deadline expectations with `main` rather than restoring obsolete eight-minute defaults.

## Verification

- App suite: 179 tests passed, including a new combined-duration/strategy/reset regression.
- Worker suite: 82 tests passed; Worker TypeScript checking passed.
- Static generation: 14 routes passed. The existing hint-ring warning and `main`'s existing mobile setup CSS warning remain. Full Vue typechecking is unavailable with the baseline dependencies.
- Generated-client browser verification passed on both a secure loopback origin and a deliberately non-secure local hostname, using real IndexedDB on the latter. Each run checks independent policies/reload, shared ten-minute duration, cross-tab changes, visibility/reset, failed-save retry, malformed-setting reset, 390px layout, actual BEST1537-to-LATEST1248 selection, frozen running-session policy, and a completed canonical level whose receipt updates the HUD. Both runs record no page or console errors.
- A fresh read-only review found no actionable merge-introduced issues in settings, training continuations, Live exit/reset, resume/result board identity, or IndexedDB receipt propagation.

No site or Worker deployment is performed. The PR still requires the coordinated client/Worker rollout described in the runbook.
