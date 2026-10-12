# Debug Master — M3 / Home v2

Branch: `feature/home-v2`, based on Dev commit `17bc6f5`.

## 2026-10-12 — Config, i18n and storage boundary

- `app/data/home-config.ts`: schemaVersion 1, Set 01; A 1–20, B 21–40, C 41–60; all time limits are **900 seconds (15:00), placeholders**. Mode names in the Thai dictionary are now A “นักบินฝึกหัด”, B “นักสำรวจ”, C “ผู้บัญชาการ”, per the user's reference. Ages 5–18, nickname maximum 24, idle timeout 90 seconds.
- Lightweight Thai dictionary and `useGameI18n`, no new dependency. Step 2 can replace the composable with the frontend's i18n.
- Standalone document language is `th` through Nuxt head configuration.
- `PlayerRepository` / `ScoreRepository` interfaces and `LocalStorageAdapter`. Keys use `codeventure:debug-master:home-v2:v1:` and each value has `schemaVersion: 1`. No migration, deletion, or writes to Dev's old `debug-runner-scores-v1` key.
- Pure ranking helpers now accept challengeId; legacy scores cannot enter A/B/C boards. Bangkok day, score descending then elapsed time ascending are unchanged.
- Validation: `pnpm build` passed (exit 0). No tests written or run, as requested.

## Scope boundaries

Preserve Dev's existing levels, parser, runner, scoring formula and old modes. No edits to `D:/CodeVenture/codeventure-mvp-frontend`. No new puzzles, stars, video, backend, or full per-mode scoring logic in this task.

## 2026-10-12 — Three boards and player setup

- `HomeV2.vue`: three boards with an enabled “เริ่มเกม” button under each column. The button opens `PlayerSetupDialog.vue` for that mode; nickname and age are no longer displayed inline on Home. No separate mode picker or time picker. The dialog's confirm/start button requires a trimmed nickname and an explicitly selected age. Names support Thai and are limited to 24 characters; no initial age selection or profile restoration.
- `ChallengeRanking.vue` and `useScoreBoard`: reads through ScoreRepository only. Top 10 for each A/B/C challenge today in Asia/Bangkok, ordered by score then elapsed time. Top 3 have numbered and distinct highlighted rows. Empty state uses Dev's Codi asset.
- Auto-refresh: repository notifications for same-tab writes, browser storage events for other tabs, and a 15-second refresh for Bangkok day rollover. No backend.
- Wide layout reserves space for three boards with ten rows and their start buttons at 1366×768 and 1920×1080. Narrow screens stack the boards; the setup dialog and its age strip can scroll when necessary. No screenshot/browser validation was performed because the requested verification is build only.

## 2026-10-12 — Session flow and kiosk lifecycle

- Flow: Home → selected mode's nickname/age popup → skippable text tutorial → existing gameplay → summary → challenge leaderboard → next player/Home. Tutorial and popup time are excluded from the game timer.
- A/B/C use the existing timed gameplay path with the configured time limit, filtered Set 01 levels (first level 1/21/41; stop at 20/40/60), and the existing scoring formula. The parser, runner, generation, puzzles and scoring formula are unchanged. No stars or distinct difficulty/scoring rules were added.
- Summary saves once with `challengeId` and `playerId` through ScoreRepository, shows score, elapsed MM:SS and rank among all today's entries on that challenge (even outside the top 10). Failed storage writes show a retry action; retry upserts the same result ID.
- Session end clears pending level advances and stops gameplay input, preventing a late level transition from resuming behind summary.
- Idle timeout: 90 seconds on Home (including the setup popup; closes it and clears fields), tutorial, summary and ranking. Disabled during gameplay and level retries. Pointer/key/input/focus interactions renew the timeout.
- Home return clears both draft/live player fields and the current player record, and remounts the form. A same-URL history entry makes browser Back from a session return to Home. Mount/refresh and pageshow (including browser cache restoration) reset to Home with blank fields.
- `homeConfig.enabled = false` restores Dev's original setup with campaign, timer, ranking 5 minutes and Dead Mode, including the review query preselection. New Home does not expose legacy settings. Review links in Home v2 open Home; direct level preselection remains a legacy feature.
- **Dead Mode**: Dev's seeded endless level generator creates each next level on demand; starts with five hearts, a wrong input loses one heart and retries the level, and the run ends when all hearts are gone.
- Document-level html/body/box sizing styles moved from index.vue to the standalone global stylesheet `assets/css/tailwind.css`. Existing global layout rules are retained. Step 2 should import gameplay/component CSS without these standalone document rules.
- Game HUD now pads minutes to MM:SS as leaderboard already did. Existing Dev gameplay text remains as-is; all new Home/tutorial/summary/ranking text is in the Thai dictionary.
- Validation: `pnpm build` passed (exit 0) after wiring Home and session flow. Final GitHub Pages build with `/debug-master/` also passed (exit 0) through Nuxt's build API with a temporary `nitro.prerender.concurrency: 1` override; all 11 static routes generated. The temporary build runner was removed.
- Windows build limitation: the standard GitHub Pages preset on this installed Nuxt 4.5.1 produced `EPERM` in Nuxt's atomic payload-cache rename when crawling prefixed/unprefixed routes concurrently. Retrying outside the sandbox produced the same error; serial prerender succeeded. No dependency or persistent deployment/build-concurrency configuration was changed. Ordinary `pnpm build` is unaffected; deployment CI runs on Linux.
- No tests written or run. No visual/responsive/browser interaction checks performed, as requested; the build does not establish the actual rendered fit at target screen sizes or prove browser-history/idle behavior in a live kiosk.
- Git history: the original stage request was rejected in the previous session. This follow-up began on a clean `feature/home-v2` at `d15f8c0`, where the previous Home v2 files were already tracked. No attempt was made to restore or recreate that history.

## 2026-10-12 — User-requested popup and stepped age bar

- User clarified that each leaderboard column has its own “เริ่มเกม” button and opens that mode's popup. This supersedes the original requirement to show the form directly on Home.
- `ModeBadge.vue`: code-native wing/rank badges inspired by the supplied image, shown beside the three confirmed mode names. No new raster asset or dependency.
- `PlayerSetupDialog.vue`: native modal dialog with focus containment, Escape/close handling, nickname focus on open, and focus return to the column button on close. Closing/reopening creates a fresh blank form; idle/Home reset also destroys the dialog.
- Age selector uses the existing configured 5–18 range (the image supplies the bar style, not a new age specification). Discrete tick buttons along a rail support tap, pointer dragging in whole steps, and keyboard arrows/Home/End. Selected age shows a yellow fill/dot/number with a Codi marker and age bubble; no age is selected initially. Each tick has a target at least 48px wide and 80px tall. Narrow screens can scroll the strip horizontally.
- Player persistence and tutorial are invoked only after valid popup confirmation; repository/gameplay/scoring rules are unchanged.
- Verification: final `pnpm build` passed (exit 0); `git diff --check` passed. No tests or browser/visual checks, as requested.

## 2026-10-12 — Home visual theme from Signal Lost reference

- Reference: https://codeventure-signal-lost.innovasive.workers.dev/ — inspected in the browser for visual direction only. The entry page uses a blue space scene, navy cards, Codi illustrations on pale blue grid panels, white headings and rounded yellow buttons with a raised edge.
- Home now uses a larger Codi greeting/header, navy mode cards with blue/gold borders, compact difficulty/level/time metadata, and yellow pill-shaped “เริ่มเกม” buttons with a pressed/hover treatment. Existing `bg.png`, `cody-happy.webp`, fonts and rank badges are reused; no new dependency or downloaded asset.
- `ChallengeRanking` has an optional `space` presentation variant used only by Home. Ranking rows stay readable on the dark cards, with numbered gold/silver/bronze top-three highlights. Empty boards show Codi above a landing pad on a light blue grid, with a white message bubble. Summary's default light ranking stays intact.
- Three boards and their popup launch buttons remain the same flow; mode names, player form, age selection, scores/repository, idle policy and gameplay are unchanged. The only new text is the Codi greeting in the Thai dictionary.
- Wide layout still uses three columns and compact top-ten rows; narrow screens stack cards. Component styles do not touch html/body. Actual target-size rendering was not checked: only the external reference was inspected, and product verification remains build only.
- Verification: `pnpm build` passed (exit 0), and `git diff --check` passed. No tests written or run.
