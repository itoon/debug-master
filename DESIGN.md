---
version: alpha
name: Debug Runner
description: Thai educational space puzzle game with Codi and three timed challenge cards.
colors:
  primary: "#1f75ff"
  background: "#061a38"
  accent: "#fdca3f"
  onDark: "#ffffff"
  danger: "#ff6b6b"
typography:
  sans:
    fontFamily: '"LINESeedSans", "Noto Sans Thai", "Sukhumvit Set", system-ui, sans-serif'
  mono:
    fontFamily: '"SFMono-Regular", ui-monospace, Menlo, Consolas, monospace'
rounded:
  DEFAULT: "12px"
  lg: "24px"
spacing:
  pageMax: "1640px"
components:
  playerSetup:
    maxWidth: "760px"
  profile:
    diameter: "104px"
    borderWidth: "4px"
---

# Debug Runner Design

## Overview

Preserve the established blue space adventure identity and Codi assets. The audience is children using a desktop booth or a smaller personal screen. Thai is the default; Python/item names and Beginner/Intermediate/Pro remain recognizable technical labels. The interface should feel like a playable educational game with clear feedback, rather than an admin dashboard.

This file records existing design context; it does not generate runtime tokens. The user's current instructions and repository handoff govern task scope and gameplay. No Japan-specific market or language scope is established.

## Colors

The canonical global palette lives in `app/assets/css/tailwind.css`: primary → `--cv-blue`, background → `--cv-navy-900`, accent → `--cv-yellow`, onDark → `--cv-on-dark`, danger → `--cv-red`. Component-specific art and surfaces stay in the shared component styles. Keep yellow for important scores/actions and blue for progress. Do not rebrand for an isolated feature or use colour as the only state cue.

Tile surfaces are owned by `app/assets/css/board.css`. Plain floor uses a deeper blue than pale, glossy ice; retain ice's diagonal reflection streaks and the floor's plain/checkered appearance as additional distinguishing cues. Shared tile variables keep board cells and code swatches consistent.

## Typography

`--cv-font` and `--cv-font-mono` in the application stylesheet own the font stacks mirrored above. Retain local LINE Seed Sans TH files, Thai-capable fallbacks and readable code. Names, timers and scores must remain legible; preserve complete values through appropriate text/tooltip treatment.

## Layout

Home uses three cards up to 1640px, stacking below 1100px. Game HUD aligns with the two gameplay columns: player identity at upper left, score/time beside it, and level/context/progress at upper right over the existing code panel. A wide progress bar sits below the level information, with a thin divider below the left player/score group. Combo appears above the board at the left only when greater than ×1; its row stays reserved to avoid board resizing. Sound/Exit sit at the lower left in the board footer, with the D-pad centered on that same footer. Footer controls reflow below the D-pad on small screens; they never float over tiles. Popups have bounded viewport height and internal scrolling. Components do not style html/body. Leaderboard read/scroll regions remain separate from card launch targets.

## Elevation & Depth

Leaderboard podium numbers share a 2rem font size and line-height 1 across gold, silver and bronze blocks. Center them horizontally and align their line boxes to the top of each block; retain the distinct podium heights and compact centered group.

Keep the space background and restrained blue surfaces, thin outlines and soft shadows. App-owned native dialogs use a blurred backdrop with accessible focus/inert behaviour. Motion must not reorder the home grid or move form controls during validation.

The summary dialog hides its scrollbar as requested, while retaining overflow scrolling so result details, retry and navigation remain reachable on small screens. Other scroll areas keep their existing presentation.

## Shapes

Global control/container radii map to `--cv-radius` (12px) and `--cv-radius-xl` (24px). Player portraits use a full circular white border fitted to the image, with a 36px refresh badge overlapping the lower-right and a transparent extension for a 48px pointer target. Its 22px circular-arrow icon has filled arrowheads so the direction is recognizable. Portrait geometry belongs to `PlayerSetupDialog.vue`, not a second global theme.

## Components

Canonical owners are `HomeV2.vue` for mode selection, `PlayerSetupDialog.vue` for nickname/age/profile input, `GameHud.vue` for gameplay information, `SessionPanel.vue` for tutorial/result/ranking, and the existing repositories for local data. `docs/HANDOFF.md` records behavioural agreements and verification history.

Home's compact footer puts a small original 60-level practice entry at the right (36px high, 18px icon), with team links including player management beside the ranking rules. Practice uses the existing game board/code/D-pad with a compact `GameHud` variant: level/context at left, progress centered, and Map/SuperHint actions at right, with the progress bar spanning below. There is no separate practice toolbar, profile or score block. Map opens the native 60-level picker during practice as well as from Home; picking the current level restarts it. Narrow layouts place actions on a new row. Practice never collects a profile or persists ranking data. Staff player management reuses `DocShell`, lists individual saved runs with searchable names and identifying mode/date/score metadata, and confirms deletion in a native dialog focused on Cancel. Identical nicknames remain separate records. Loading, empty, search-empty, storage-error, retry and deletion-pending states must remain explicit. Score/profile mutations pass through repositories and serialize across tabs; async completion must not reopen an abandoned screen.

`BoardSuperHint.vue` owns practice path presentation. An isolated invocation of the existing parser/solver provides the complete route without advancing the live game. Distinct route cells after the initial position get two concentric red circles using `--cv-red`; the final cell has an additional ring. Circle opacity loops from 0.4 to 0.7 and back over one second, offset by 120ms per first route visit to suggest movement along the route. Geometry inherits the board's padding, pitch and cell size; markers stay behind Codi, never take grid space or intercept input. Hidden tabs pause animation; reduced motion shows static circles at 0.55 opacity. Hint status is visually hidden; failures reuse the board's overlay notice rather than add a layout row. This replaces practice's debug metrics/text hints; original hidden Dev debug remains unchanged.

Practice SuperHint consumes destinations in route order using the current attempt's existing correct-input count, independently of whether the hint is visible. A cell stays marked until all its remaining visits have been consumed, including wraps and loop returns to the initial position. Repeated visits add up to three concentric blinking outline rings around the ordinary dot; rings reduce as visits are consumed, and the dot/endpoint ring disappear after the final required visit. The display cap bounds marker density without capping the actual remaining-visit count. New levels, manual restarts and automatic retries reset the existing input count. Wrong keys consume no visit; initial standing is not a move. Next-move arrows and code highlights retain their current behaviour, and no visit data is persisted.

`NextMoveHint.vue` adds a white triangle with dark outline at the Codi tile edge when practice SuperHint is on and a move is pending. Its size is `clamp(24px, 0.5 × cell size, 60px)`, twice the original cue, centered on the edge to keep the enlarged indicator close to Codi. It uses the live expected direction, not the precomputed path index. Its position follows the existing actor container; left/right cues nudge 3px horizontally and up/down cues 3px vertically over an 850ms cycle. It is decorative, ignores pointer input, pauses in hidden tabs and stays static for reduced motion. It disappears during modal selection, failures, completion and the existing gap between moves; screen-reader hint status supplies the next direction separately.

`PracticeLevelDialog.vue` groups levels by their actual concept, ordered by level ID. Emoji and localized category titles belong to `practice-concepts.ts`/the dictionary; unknown concepts retain their title with a puzzle emoji. Each category shows its level count and tactile number buttons. The selected level keeps its yellow background and aria-current state, without a checkmark. The popup caps at 940px width and the viewport height; only its category body scrolls, keeping close/help visible. Button grids use 10, 5 or 3 columns as space narrows, with 48px minimum targets and reduced-motion hover support.

Practice progress represents the current chosen level, not a count of solved levels: selecting level 11 shows 11/60 and fills the bar to 11/60. Ranked/legacy progress keeps its completed-level meaning. Practice skips score and combo accumulation and shows no score popup; a green check plus “ผ่านด่านแล้ว” occupies the existing reserved row above the board during success and at the final completed level. Keep its geometry stable and the original automatic transition timing.

Confirmed practice Exit opens a separate blue summary modal before Home, showing elapsed MM:SS, unique passed level count and wrong directional input count. Its transient totals span the whole practice visit despite map selections, retries or restarts; freeze them at confirmed exit and cancel live callbacks. Never display elapsed time in the practice HUD or persist practice results. Use existing Codi art, completion audio, modal focus and reduced-motion entrance conventions; a single Home action clears the session. Summary participates in the existing 90-second idle return, while gameplay remains exempt. Bound overflow to the viewport and hide its scrollbar without blocking scrolling on small devices.

Practice SuperHint also highlights the active Python source line in `LevelCode`, using optional 1-based `sourceLine` metadata on parsed nodes. Repeated identical commands highlight only the actual active occurrence; loops/functions reuse their body's real source location. Highlight state follows the live runner and clears when SuperHint is off. The opt-in `followActiveLine` presentation scrolls only the code viewport when needed, never the game page. Existing hidden Dev debug highlighting remains unchanged; no debug metrics panel is enabled for practice.

Home mode cards with no scores today use their thumbnail as a full-card cover: the mode title/badge sits at the upper left, with range/difficulty/time at the bottom. Strong navy gradients darken both edges for readable text while leaving the central artwork clear. All cards omit the visible tap-to-start hint; the accessible launch label and click/keyboard targets remain. Empty cards do not show the ranking heading or Codi empty-state message. `ChallengeRanking` remains subscribed through `useScoreBoard` and reports a confirmed empty state to Home; new scores restore the normal podium/list automatically. Loading/storage errors do not masquerade as empty boards. Other ranking screens keep their existing empty-state presentation.

Tutorial uses the same blue game surface and shared `LevelBoard`/`LevelCode` in `TutorialDemo.vue`. Its repeating preview reads the original Set 01 level 1, synchronizes the source-line highlight with the displayed key and Codi, pauses for 1.2 seconds at completion, then resets without a backwards move. It never updates the live run, score, timer or repository. Reduced motion uses a static explanation; hidden tabs suspend the preview. Only Start/Back are primary tutorial actions, with icons and text. The tutorial card fits the available viewport height, adapting board/code space and compacting short screens. Narrow screens reserve enough space for the three code lines and stack the board above the code. Additional control/item guidance replaces the demo area while its disclosure is open and uses two radio tabs so content does not extend the card.

Mode selection moves one card to center and slides others away, then opens the dialog. Closing reverses the sequence. Durations live in `homeConfig.modeMotion`; popup entrance is a single gentle zoom/overshoot/settle. Reduced motion skips movement. Early close, resize, idle and unmount must cancel or continue from the current state without stale UI work.

`useGameAudio` is the sole sound playback owner, driven by `sound-effects.ts`. Home emits selection/transition/popup cues into that same owner so the game's mute state applies everywhere. UI click and slide may overlap softly; gameplay failure/clear/completion retains its existing interruption behaviour. Sound supplements visible state and never gates navigation or scoring.

Ordinary UI controls use the supplied local `app/assets/sounds/pops-4.mp3` click cue through the app shell's delegated bubbling listener. `useGameAudio` caches/decodes it on audio unlock and plays it through the existing master gain/context; the synthesized click remains only a load-error fallback. Delegation runs after control handlers so a Home reset does not immediately cut it off. Disabled controls, background/text clicks and leaderboard reading stay silent. Movement buttons and mode-card selection keep their dedicated cues without an added generic tap; the mute switch itself stays silent. Mouse/touch and native keyboard button activation share the same path.

Age selection remains explicit 5–18 with tap/keyboard/drag alternatives and a numeric tooltip. No Codi image floats over the age bar. Keep the blank-form kiosk reset, repository retry and modal focus contracts. New UI text uses the dictionary/composable.

Random nicknames combine eight playful Thai character/space bases with ten gaming-style descriptors and one emoji instead of numeric suffixes. The words and formatting use dictionary keys; the 12-emoji pool belongs to `homeConfig.nicknameEmojis`. The tone is child-friendly and informal (for example น้องบั๊กตัวตึง🔥 or โคดิสุดเฟี้ยว🎮). Filter each complete candidate using the existing 24 UTF-16-unit limit, preserving whole emoji strings. Keep editable manual names, explicit age selection and no-repeat-on-immediate-click behaviour. Previously stored names are not rewritten.

## Do's and Don'ts

- Reuse the existing assets, Thai typography and canonical components.
- Keep hover/focus/press/disabled feedback and 48px form targets usable without sound or animation.
- Preserve gameplay, scoring and timing when adjusting presentation.
- Do not add backend dependencies, alternate audio contexts or unrelated UI systems for a small change.
- Verification follows the user's build-only contract: no tests, external design lint/audit downloads or browser checks without a changed instruction. Do not claim visual/audio or accessibility compliance from build results alone.
