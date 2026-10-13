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

Keep the space background and restrained blue surfaces, thin outlines and soft shadows. App-owned native dialogs use a blurred backdrop with accessible focus/inert behaviour. Motion must not reorder the home grid or move form controls during validation.

## Shapes

Global control/container radii map to `--cv-radius` (12px) and `--cv-radius-xl` (24px). Player portraits use a full circular white border fitted to the image, with a 36px refresh badge overlapping the lower-right and a transparent extension for a 48px pointer target. Its 22px circular-arrow icon has filled arrowheads so the direction is recognizable. Portrait geometry belongs to `PlayerSetupDialog.vue`, not a second global theme.

## Components

Canonical owners are `HomeV2.vue` for mode selection, `PlayerSetupDialog.vue` for nickname/age/profile input, `GameHud.vue` for gameplay information, `SessionPanel.vue` for tutorial/result/ranking, and the existing repositories for local data. `docs/HANDOFF.md` records behavioural agreements and verification history.

Tutorial uses the same blue game surface and shared `LevelBoard`/`LevelCode` in `TutorialDemo.vue`. Its repeating preview reads the original Set 01 level 1, synchronizes the source-line highlight with the displayed key and Codi, pauses for 1.2 seconds at completion, then resets without a backwards move. It never updates the live run, score, timer or repository. Reduced motion uses a static explanation; hidden tabs suspend the preview. Only Start/Back are primary tutorial actions, with icons and text. The tutorial card fits the available viewport height, adapting board/code space and compacting short screens. Narrow screens reserve enough space for the three code lines and stack the board above the code. Additional control/item guidance replaces the demo area while its disclosure is open and uses two radio tabs so content does not extend the card.

Mode selection moves one card to center and slides others away, then opens the dialog. Closing reverses the sequence. Durations live in `homeConfig.modeMotion`; popup entrance is a single gentle zoom/overshoot/settle. Reduced motion skips movement. Early close, resize, idle and unmount must cancel or continue from the current state without stale UI work.

`useGameAudio` is the sole sound playback owner, driven by `sound-effects.ts`. Home emits selection/transition/popup cues into that same owner so the game's mute state applies everywhere. UI click and slide may overlap softly; gameplay failure/clear/completion retains its existing interruption behaviour. Sound supplements visible state and never gates navigation or scoring.

Age selection remains explicit 5–18 with tap/keyboard/drag alternatives and a numeric tooltip. No Codi image floats over the age bar. Keep the blank-form kiosk reset, repository retry and modal focus contracts. New UI text uses the dictionary/composable.

## Do's and Don'ts

- Reuse the existing assets, Thai typography and canonical components.
- Keep hover/focus/press/disabled feedback and 48px form targets usable without sound or animation.
- Preserve gameplay, scoring and timing when adjusting presentation.
- Do not add backend dependencies, alternate audio contexts or unrelated UI systems for a small change.
- Verification follows the user's build-only contract: no tests, external design lint/audit downloads or browser checks without a changed instruction. Do not claim visual/audio or accessibility compliance from build results alone.
