# Mobile gameplay fixes

Date: 2026-10-22 (Asia/Bangkok).

Per-level points/stars keep their 1400ms lifetime across next-level assembly; starting the next level no longer clears an accepted score receipt. Receipts still come from the existing solo reducer or authoritative Live server. New feedback re-keys the popup and replaces its timer.

Single-finger D-pad taps cancel their touch-end default and use the existing movement handler once. Disabled cooldown controls also suppress double-tap zoom. Dragging, cancelled touches and multi-touch remain browser gestures; mouse/keyboard keep native clicks. Board panning now explicitly permits pinch zoom.

A shared mobile/coarse-pointer policy reduces board/HUD flourishes, snaps score count-up and automatic scrolling, and keeps short position feedback. It includes desktop-mode iPads and preserves Windows touch kiosk/desktop presentation. Memoized tile nodes avoid rebuilding their presentation on actor updates. Scoring and game timing are unchanged.

The player route blocks mobile/tablet landscape with an animated, native rotate-to-portrait dialog. Physical orientation takes precedence over viewport aspect ratio, so an onscreen keyboard does not trigger it. Portrait automatically closes the prompt and restores focus. Other native dialogs cannot cover the prompt; closing it while landscape reopens it. The prompt is absent from Host/big-screen routes and desktop kiosks. Input is blocked while rotating, but timed rounds continue with an explicit notice. Reduced motion keeps a static icon.

## Verification

- App suite: 191 tests passed across 18 files under bundled Node 24 after separating the mobile-motion and orientation tests by topic. The root checkout is missing its declared Vitest link, so a temporary config resolved the already-installed `live-server/node_modules/vitest` runner; no dependencies or lockfiles changed. The temporary config was removed afterward.
- GitHub Pages production build: passed, 19 prerendered routes, with `/debug-master/` base URL and the existing production Live URL. Log: `mobile-gameplay-fixes-build.log`. Existing CSS parser warnings in BoardSuperHint and PlayerSetupDialog remain.
- Browser: played Beginner level 1 normally and verified `+1,415` and three stars remained visible after level 2 appeared. The rotate component was exercised in a temporary local fixture at landscape and portrait tablet sizes, including stacking above another native dialog, focus restoration and forced-close recovery. The fixture and browser tab were removed afterward.
- Code review: the desktop-touch motion classification finding was corrected and passed scoped rereview.
- Static premium audit: 9 existing findings, 0 new findings. The same file/rule findings were reproduced from the corresponding HEAD sources. Existing native-select ownership/form-validation findings are outside this change.
- `git diff --check`: passed.

Actual iPhone/iPad double-tap/pinch behavior, physical orientation events and performance on the reported phone still need hardware verification. Browser viewport/fixture and utility tests do not certify those devices. No GitHub Pages publication, Worker deployment or push was performed. The implementation was subsequently organized into topic-specific commits at the user's request.
