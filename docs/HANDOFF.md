# Debug Master — M3 / Home v2

Branch: `feature/home-v2`, based on Dev commit `17bc6f5`.

## 2026-10-12 — Config, i18n and storage boundary

- `app/data/home-config.ts`: schemaVersion 1, Set 01; A 1–20, B 21–40, C 41–60; all time limits are **900 seconds (15:00), placeholders**. B/C names remain “รอตั้งชื่อ”. Ages 5–18, nickname maximum 24, idle timeout 90 seconds.
- Lightweight Thai dictionary and `useGameI18n`, no new dependency. Step 2 can replace the composable with the frontend's i18n.
- Standalone document language is `th` through Nuxt head configuration.
- `PlayerRepository` / `ScoreRepository` interfaces and `LocalStorageAdapter`. Keys use `codeventure:debug-master:home-v2:v1:` and each value has `schemaVersion: 1`. No migration, deletion, or writes to Dev's old `debug-runner-scores-v1` key.
- Pure ranking helpers now accept challengeId; legacy scores cannot enter A/B/C boards. Bangkok day, score descending then elapsed time ascending are unchanged.
- Validation: `pnpm build` passed (exit 0). No tests written or run, as requested.

## Scope boundaries

Preserve Dev's existing levels, parser, runner, scoring formula and old modes. No edits to `D:/CodeVenture/codeventure-mvp-frontend`. No new puzzles, stars, video, backend, or full per-mode scoring logic in this task.

## 2026-10-12 — Three boards and shared player form

- `HomeV2.vue`: three boards, one nickname/age form, no separate mode picker or time picker. All start buttons require trimmed nickname and an explicitly selected age. Names support Thai and are limited to 24 characters. Age buttons are at least 48px tall; no initial selection or profile restoration.
- `ChallengeRanking.vue` and `useScoreBoard`: reads through ScoreRepository only. Top 10 for each A/B/C challenge today in Asia/Bangkok, ordered by score then elapsed time. Top 3 have numbered and distinct highlighted rows. Empty state uses Dev's Codi asset.
- Auto-refresh: repository notifications for same-tab writes, browser storage events for other tabs, and a 15-second refresh for Bangkok day rollover. No backend.
- Wide layout reserves space for three boards with ten rows and the complete form at 1366×768 and 1920×1080. Narrow screens put the form before stacked boards and allow scrolling of the shell. No screenshot/browser validation was performed because the requested verification is build only.

## 2026-10-12 — Session flow and kiosk lifecycle

- Flow: Home → skippable text tutorial → existing gameplay → summary → challenge leaderboard → next player/Home. Tutorial time is excluded from the game timer.
- A/B/C use the existing timed gameplay path with the configured time limit, filtered Set 01 levels (first level 1/21/41; stop at 20/40/60), and the existing scoring formula. The parser, runner, generation, puzzles and scoring formula are unchanged. No stars or distinct difficulty/scoring rules were added.
- Summary saves once with `challengeId` and `playerId` through ScoreRepository, shows score, elapsed MM:SS and rank among all today's entries on that challenge (even outside the top 10). Failed storage writes show a retry action; retry upserts the same result ID.
- Session end clears pending level advances and stops gameplay input, preventing a late level transition from resuming behind summary.
- Idle timeout: 90 seconds on Home (clears the form), tutorial, summary and ranking. Disabled during gameplay and level retries. Pointer/key/input/focus interactions renew the timeout.
- Home return clears both draft/live player fields and the current player record, and remounts the form. A same-URL history entry makes browser Back from a session return to Home. Mount/refresh and pageshow (including browser cache restoration) reset to Home with blank fields.
- `homeConfig.enabled = false` restores Dev's original setup with campaign, timer, ranking 5 minutes and Dead Mode, including the review query preselection. New Home does not expose legacy settings. Review links in Home v2 open Home; direct level preselection remains a legacy feature.
- **Dead Mode**: Dev's seeded endless level generator creates each next level on demand; starts with five hearts, a wrong input loses one heart and retries the level, and the run ends when all hearts are gone.
- Document-level html/body/box sizing styles moved from index.vue to the standalone global stylesheet `assets/css/tailwind.css`. Existing global layout rules are retained. Step 2 should import gameplay/component CSS without these standalone document rules.
- Game HUD now pads minutes to MM:SS as leaderboard already did. Existing Dev gameplay text remains as-is; all new Home/tutorial/summary/ranking text is in the Thai dictionary.
- Validation: `pnpm build` passed (exit 0) after wiring Home and session flow. Final GitHub Pages build with `/debug-master/` also passed (exit 0) through Nuxt's build API with a temporary `nitro.prerender.concurrency: 1` override; all 11 static routes generated. The temporary build runner was removed.
- Windows build limitation: the standard GitHub Pages preset on this installed Nuxt 4.5.1 produced `EPERM` in Nuxt's atomic payload-cache rename when crawling prefixed/unprefixed routes concurrently. Retrying outside the sandbox produced the same error; serial prerender succeeded. No dependency or persistent deployment/build-concurrency configuration was changed. Ordinary `pnpm build` is unaffected; deployment CI runs on Linux.
- No tests written or run. No visual/responsive/browser interaction checks performed, as requested; the build does not establish the actual rendered fit at target screen sizes or prove browser-history/idle behavior in a live kiosk.
- Git: branch created successfully. The request to stage the first work item was rejected, so no commits have been created; changes remain in the working tree. Intended split: config/i18n/storage, Home/leaderboards, session flow/kiosk/global CSS; update HANDOFF in each commit.
