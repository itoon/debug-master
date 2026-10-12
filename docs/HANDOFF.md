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

## 2026-10-12 — Random nickname button

- Added a “สุ่มชื่อ” dice button beside the nickname field in the player popup. Clicking fills an editable Thai space-themed nickname with a two-digit suffix; consecutive clicks always change the current name. This does not imply names are globally unique.
- Button text, generated-name format, name pool and screen-reader announcement use the Thai dictionary. Candidates respect the configured nickname length. Small screens stack the input and button.
- Popup still opens blank; randomization is opt-in. Age remains unselected and required, and player data is saved only on valid confirmation. Existing idle/reset behavior is unchanged.
- Verification: `pnpm build` passed (exit 0), and `git diff --check` passed. No tests written or run.

## 2026-10-12 — Gameplay layout and hierarchy

- User requested an actual two-column gameplay composition: board with attached D-pad on the left, readable code on the right, with a compact top HUD. Existing space background, tiles, Codi, font and palette are retained.
- `index.vue`: Level/concept/stage title, player/language/mode, status, timer, score, combo, progress and Dead Mode hearts are grouped in the top HUD. Timer and score are larger focal metrics; Start/Restart/Menu remain together with their original handlers and disabled conditions.
- D-pad moved inside the left board group, immediately below the rendered board. Up remains above Left/Down/Right. A short contextual instruction sits above the board; the concept is shown beside the level in the HUD, replacing the separate full-width instruction bar.
- Board area is measured with instruction/control heights reserved, so the board and D-pad share one centered group with 12px spacing. Gameplay opts into a 160px maximum tile size (previously 88px); actual tiles still shrink to fit the available width/height. Review and other LevelBoard uses retain the 88px default. No map/grid structure, tile values, Codi positioning, movement, parser or runner changes.
- Code panel aligns with the board/control area and caps its height at 780px. Gameplay opts into readable 16–20.8px code and 1.65 line spacing; long programs scroll inside the editor vertically/horizontally instead of shrinking into tiny text. Review/default LevelCode uses keep the previous sizing and syntax highlighting.
- Desktop keeps two columns within a centered 1640px game frame. At 920px and below, board/controls and code stack with scrollable page overflow; controls and debug features stay available. Notifications, score popups and hints are preserved. New labels use the Thai dictionary; no html/body styles added.
- Verification: `pnpm build` passed (exit 0); `git diff --check` passed. No tests or live viewport checks performed, per the standing build-only instruction. 1920×1080/laptop fit is designed for but not visually verified.

## 2026-10-12 — Gameplay sound effects

- Added three short, synthesized Web Audio effects: soft rising step tone on a correct move; ascending four-note chime on level completion; descending retry cue when a level fails. Failure cue plays once at failure, not again when the automatic retry begins. Manual Restart and mode timeout do not add extra cues.
- Sound definitions/frequencies/durations/volumes live in `app/data/sound-effects.ts`; playback and cleanup are isolated in `useGameAudio.ts`. No audio download, external file, backend or dependency. These synthesized effects can later be replaced with the art team's audio assets.
- Audio initializes/resumes from Start/tutorial start or another player gesture. Browser audio errors/unsupported APIs are ignored without affecting the run. Gameplay never waits for audio; movement, scoring, retries and level advance timing remain unchanged.
- HUD has a keyboard-accessible, localized sound toggle with visible on/off text and pressed state. Sound starts enabled; this setting lives only in the mounted game page and is not persisted in storage. Muting or returning to Home stops current/queued sounds; unmount closes the audio context and releases voices.
- Clear/failure cues replace overlapping step tones, and effect playback is skipped while the document is hidden. Normal effect durations finish before the existing auto-advance/retry delay.
- Verification: `pnpm build` passed (exit 0); `git diff --check` passed. No tests or listening/browser checks, per the build-only instruction.

## 2026-10-12 — Exit during gameplay and save latest score

- During an active run, the HUD's Menu action now reads “ออกเกม”. Clicking captures the current score/time/progress/player/mode, saves through ScoreRepository, then returns to Home with a blank player form. A/B/C results keep the active challengeId and appear on that challenge's existing daily board; legacy modes keep their board metadata.
- The saved score is the latest cumulative score shown in the HUD. The scoring formula is unchanged; an unfinished level does not receive additional completion points. Exiting before the first clear still saves the current zero score.
- Snapshot creation is shared with normal end-of-run saving. Exiting does not also create a summary or a second final result. Repeated save attempts reuse the same snapshot ID (repository upsert), with elapsed time frozen at the first exit click.
- If storage rejects the write, gameplay/timer/audio stop and the frozen result stays in memory. A localized error and “ลองบันทึกและออก” action allow retry; Start/Restart are disabled while that result is pending. Home is entered only after a successful write via this exit action.
- Pending move, failure-animation and retry callbacks are now tracked and cleared when stopping/leaving/restarting a level, alongside the existing level-advance/score-popup timers. Their normal 80ms/0ms/760ms delays are unchanged, and an old callback cannot resume a previous run after exiting. Parser, runner, maps and scoring logic are unchanged.
- The existing browser refresh/Back and idle-home reset policy remains separate; this change saves on the explicit in-game exit action, not as continuous autosave or refresh recovery.
- Verification: final `pnpm build` passed (exit 0); `git diff --check` passed. No tests or live browser checks, per the build-only instruction.

## 2026-10-12 — Canonical tile names

- `app/data/tiles.ts` is the shared naming boundary: p → flower (ดอกไม้), k → rock (หิน), g → grass (หญ้า), o → lava (ลาวา), b → ice (น้ำแข็ง), v → gem (อัญมณี). `TILE_TYPES` exports these six primary names. Existing n/floor and y/sand are retained because Dev's puzzles use eight tile kinds.
- Board accessibility labels/tooltips, Python and JavaScript code chips, the gameplay debug tile label, review solution labels and the elements/asset inventory use this registry. Thai translations and new explanatory text use the lightweight dictionary. Existing CSS colour identifiers remain internal to preserve all art.
- The parser boundary accepts named conditions such as `if lava:`, `if not grass:` and `while ice:` by translating to the existing compact codes. The code view recognizes both named and original conditions. Dev's stored puzzle source/maps and generator output are not rewritten; the runner still compares compact tile codes. Future config/editor integrations should use `tileCode` when encoding named map tiles. This repo has review/elements pages, not a level editor, so no editor was introduced.
- The short tutorial shows the six English/Thai names and explains that tiles are condition markers: rock is passable and lava does not cause failure. No obstacle, damage, movement, scoring or new tile behavior was added.
- Asset inventory IDs and suggested future texture paths now use grass/flower/lava. These are CSS tiles without corresponding texture files today; existing sprite files and CSS selectors remain unchanged. The reference frontend repo was not edited.
- Verification: `pnpm build` passed (exit 0); `git diff --check` passed. No tests written/run or live browser checks, per the standing build-only instruction.

## 2026-10-12 — Make movement and retry audio more audible

- User reports hearing only the level-clear chime. Code inspection confirms move and failure playback calls are present; the step was a 75ms low sine sweep with immediate exponential decay, and the failure sequence fell as low as 82Hz. These short/low fading cues can be difficult to hear on small speakers. Audibility on the user's device has not been measured.
- Step now uses a 140ms mid-range triangle tone with higher gain and a sustained section before a 55ms fade. Failure uses three descending mid-range tones, with stronger gain and sustain before each 70ms fade; the whole cue lasts 420ms, inside the existing 760ms retry delay.
- Added optional per-tone release duration to the audio envelope. Level-clear tone definitions and their existing envelope remain unchanged; mute, browser audio activation, hidden-tab handling and cleanup remain intact.
- Manual Restart now also plays the retry cue. Automatic failure still plays once at failure; starting the retry does not play a duplicate cue. Movement, scoring and game transition delays are unchanged.
- Verification: `pnpm build` passed (exit 0); `git diff --check` passed. No tests or live listening/browser checks, per the build-only instruction.

## 2026-10-12 — Compact player setup popup

- Reduced the popup's maximum width from 900px to 760px with explicit border-box sizing. At full width the inner age track still has room for all fourteen 5–18 ticks at their existing minimum 48px hit widths; narrower screens retain horizontal age scrolling and vertical dialog scrolling.
- Mode badge now fits its text instead of spanning the form. Nickname/random-name row uses a narrower random button, still at least 52px tall. Start button and requirement/privacy text are centered; small screens retain the full-width Start button and stacked nickname row.
- Reduced blank space above the age bar from 86px to 64px and scaled its Codi marker/age bubble to suit. Form spacing remains consistent. Only scoped CSS changed; form validation, blank initial age, random names, drag/keyboard selection, focus handling, storage and session flow are unchanged.
- Verification: `pnpm build` passed (exit 0); `git diff --check` passed. No tests or live viewport checks, per the standing build-only instruction.
