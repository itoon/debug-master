<template>
  <header class="game-hud" :class="{ 'practice-hud': practice }">
    <div v-if="!practice" class="pilot-info">
      <div class="player-profile"><img :src="avatarSrc(avatarId)" alt="" draggable="false" /><div><span>{{ t('game.player') }}</span><strong :title="playerName">{{ playerName || t('game.playerFallback') }}</strong></div></div>
      <div class="metrics">
        <div class="metric score"><span>{{ t('game.score') }}</span><strong :key="scoreBumps" :class="{ bump: scoreBumps > 0 }">{{ shownScore.toLocaleString('th-TH') }}</strong></div>
        <div v-if="timed" class="metric time" :class="{ 'time-low': timeLow }"><span>{{ t('game.timer') }}</span><strong :key="timeLow ? time : 'steady'">{{ time }}</strong></div>
        <div v-if="liveRank" class="metric live-rank"><span>{{ t('live.rank') }}</span><strong>{{ liveRank }}</strong></div>
        <span v-if="lives !== undefined" class="hearts" role="img" :aria-label="t('game.lives', { count: lives })"><i v-for="heart in maxLives" :key="heart" :class="{ lost: heart > lives }" aria-hidden="true">♥</i></span>
      </div>
    </div>
    <div class="mission-info">
      <div class="mission-heading">
        <div class="level-info">
          <p class="game-brand"><i aria-hidden="true" />{{ t('game.title') }}</p>
          <h1><span class="level-number">LV {{ level.id.toString().padStart(2, '0') }}</span><span class="level-title">{{ level.title }}</span></h1>
          <p class="level-context"><span class="concept" :title="level.concept">{{ level.concept }}</span><span>{{ language }}</span><span>{{ difficulty }}</span></p>
        </div>
        <div class="metric progress-info"><span>{{ t('game.progress') }}</span><strong>{{ progress }}</strong></div>
        <!-- Teleport target: the game page moves sound/exit here on compact layouts. -->
        <div id="game-hud-system" class="hud-system" />
        <nav v-if="practice" class="practice-actions" :aria-label="t('game.actions')"><slot name="actions" /></nav>
      </div>
      <div v-if="totalLevels" class="progress-track" role="progressbar" :aria-valuenow="completedLevels" aria-valuemin="0" :aria-valuemax="totalLevels" :aria-label="t('game.progress')">
        <span class="progress-fill" :style="{ transform: `scaleX(${Math.min(1, completedLevels / totalLevels)})` }"><i :key="completedLevels" class="progress-glint" /></span>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useGameI18n } from "../composables/useGameI18n";
import { usePlayerAvatar } from "../composables/usePlayerAvatar";
import { useCountUp } from "../composables/useCountUp";
const props = defineProps<{
  level: { id: number; title?: string; concept: string };
  language: string;
  difficulty: string;
  playerName: string;
  avatarId?: string;
  timed: boolean;
  time: string;
  score: number;
  progress: string;
  completedLevels: number;
  totalLevels: number;
  lives?: number;
  maxLives: number;
  practice?: boolean;
  /** Last stretch of a timed run: the clock pulses once per second. */
  timeLow?: boolean;
  /** Live Race Room only: own place among the round's players, e.g. "2/7". */
  liveRank?: string;
}>();
const { t } = useGameI18n();
const avatarSrc = usePlayerAvatar();
const shownScore = useCountUp(toRef(props, "score"), { duration: 700 });
// Re-keys the score so its bump replays on every gain, not on resets.
const scoreBumps = ref(0);
watch(() => props.score, (next, previous) => { if (next > previous) scoreBumps.value += 1; });
</script>

<style scoped>
/* Mobile first: one compact block (pilot row, then mission row) so the code,
   board and D-pad keep the screen. Wider and taller screens restore the
   two-column desktop HUD with large metrics. */
.game-hud { flex: none; display: grid; grid-template-columns: minmax(0, 1fr); align-items: center; gap: 8px; min-width: 0; }
.pilot-info { display: flex; justify-content: space-between; align-items: center; align-self: stretch; min-width: 0; gap: 8px; padding-bottom: 8px; border-bottom: 1px solid #9ac5ff80; }
.mission-info { min-width: 0; display: grid; gap: 6px; }
.mission-heading { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-width: 0; }
.level-info { min-width: 0; display: grid; gap: 3px; }
p, h1 { margin: 0; }
.game-brand { display: none; align-items: center; gap: 7px; font-size: .75rem; color: #d9eaff; font-weight: 800; }
.game-brand i { width: 7px; height: 7px; border-radius: 50%; background: #ffdb58; box-shadow: 0 0 8px #ffdb5855; }
h1 { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; line-height: 1.15; }
.level-number { color: #ffdb58; font-size: 1.25rem; white-space: nowrap; font-weight: 500; }
.level-title { color: #fff; font-size: .9rem; font-weight: 800; }
.level-context { display: flex; flex-wrap: nowrap; align-items: center; gap: 4px 8px; min-width: 0; color: #bdd6ff; font-size: .65rem; line-height: 1.4; }
.level-context span { flex: none; }
.concept { flex: 0 1 auto !important; min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-transform: uppercase; font-weight: 700; }
.level-context span + span { padding-left: 8px; border-left: 1px solid #8eafff55; }
.metrics { flex: none; display: flex; align-items: stretch; gap: 6px; font-variant-numeric: tabular-nums; }
.metric { display: grid; align-content: center; gap: 2px; min-width: 64px; padding: 5px 10px; border: 1px solid #6e9fe840; border-radius: 12px; background: #071e49b8; }
.metric > span { color: #bed6ff; font-size: .65rem; line-height: 1.2; }
.metric strong { font-size: 1.2rem; line-height: 1; color: #fff; }
.score strong { color: #ffdb58; }
.live-rank strong { color: #87dfff; }
.progress-info { flex: none; }
.progress-info strong { color: #87dfff; }
.progress-track { box-sizing: border-box; width: 100%; height: 8px; padding: 2px; border: 1px solid #82aeef55; border-radius: 8px; overflow: hidden; background: #071e49b8; }
.progress-fill { position: relative; display: block; height: 100%; overflow: hidden; border-radius: 4px; background: #87dfff; transform-origin: left center; transition: transform 520ms cubic-bezier(.16, 1, .3, 1); }
/* A light sweep across the filled part each time a level is added. */
.progress-glint { position: absolute; inset: 0; background: linear-gradient(100deg, transparent 30%, #fff 50%, transparent 70%); transform: translateX(-100%); animation: progress-glint 700ms 180ms ease-out both; }
.score strong { display: inline-block; transform-origin: left center; }
.score strong.bump { animation: score-bump 420ms cubic-bezier(.34, 1.56, .64, 1); }
.time-low { border-color: #ff8a8a99; background: #4a1b33cc; }
.time-low strong { display: inline-block; color: #ffb3b3; animation: time-tick 1s ease-out; }
.hearts i { display: inline-block; }
.hearts .lost { animation: heart-break 520ms ease-out; }
@keyframes progress-glint { to { transform: translateX(100%); } }
@keyframes score-bump { 0% { transform: scale(1); } 35% { transform: scale(1.28); color: #fff3b8; text-shadow: 0 0 14px #ffdb58aa; } 100% { transform: scale(1); } }
@keyframes time-tick { 0% { transform: scale(1.18); color: #fff; } 40% { transform: scale(1); } }
@keyframes heart-break { 0% { transform: scale(1.5); color: #ff6980; } 30% { transform: scale(1.2) rotate(-14deg); } 55% { transform: scale(.9) rotate(10deg); } 100% { transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .progress-fill { transition: none; }
  .progress-glint, .score strong.bump, .time-low strong, .hearts .lost { animation: none; }
}
.player-profile { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 4px 12px 4px 4px; border-radius: 999px; background: #071e4980; }
.player-profile img { flex: none; width: 36px; height: 36px; border: 2px solid #dbeaff; border-radius: 50%; background: #dbeaff; object-fit: contain; }
.player-profile div { display: grid; gap: 1px; min-width: 0; }
/* The "player" caption is redundant next to the avatar on small screens. */
.player-profile span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; font-size: .8rem; color: #bed6ff; }
.player-profile strong { color: #fff; font-size: 1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hearts { align-self: center; display: flex; gap: 2px; color: #ff6980; }
.hearts i { font-style: normal; }
.hearts .lost { color: #ffffff40; }
.game-hud.practice-hud { grid-template-columns: minmax(0, 1fr); }
.practice-hud .mission-heading { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 10px; }
.hud-system { flex: none; display: flex; align-items: center; }
.hud-system:empty { display: none; }
.practice-hud .progress-info { text-align: center; }
.practice-actions { grid-column: 1 / -1; display: flex; justify-content: flex-end; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; }

/* Room play adds an extra rank metric. Reserve space for every value before
   the optional long nickname; do not let it widen a phone's viewport. */
@media (max-width: 639px) {
  .pilot-info { gap: 6px; }
  .player-profile { gap: 5px; padding-right: 6px; }
  .player-profile img { width: 30px; height: 30px; }
  .player-profile strong { font-size: .9rem; }
  .metrics { gap: 4px; }
  .metric { min-width: 52px; padding: 6px; }
  .metric strong { font-size: clamp(.95rem, 4vw, 1.2rem); }
  .mission-heading { flex-wrap: wrap; gap: 6px; }
  .level-info { flex: 1; min-width: min(160px, 100%); }
  .practice-hud .level-info { min-width: 0; }
  .level-number { font-size: 1.15rem; }
  .level-title { font-size: .85rem; }
  /* Retain the heading for assistive technology while freeing visual space. */
  .level-info { position: absolute; width: 1px; height: 1px; min-width: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
}
/* Wide enough for pilot and mission side by side (tablets, landscape phones). */
@media (min-width: 640px) {
  .game-hud { grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr); gap: 16px; }
  .practice-hud .mission-heading { grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto; gap: 16px; }
  .practice-actions { grid-column: auto; }
}
@media (min-width: 640px) and (max-width: 920px) {
  .pilot-info { flex-wrap: wrap; justify-content: flex-start; }
  .mission-heading { flex-wrap: wrap; }
}
/* Phone competition fits profile, score, time and exit in one row. Practice
   retains its map/hint tools without adding a profile or competitive metrics. */
@media (max-width: 639px), (orientation: landscape) and (max-width: 920px) and (max-height: 560px) {
  .game-hud:not(.practice-hud) { grid-template-columns: minmax(0, 1fr) auto auto auto; gap: 4px; }
  .game-hud:not(.practice-hud) :is(.pilot-info, .metrics, .mission-info, .mission-heading) { display: contents; }
  .game-hud:not(.practice-hud) .player-profile { grid-column: 1; grid-row: 1; min-height: 40px; gap: 4px; padding: 3px 6px 3px 3px; }
  .game-hud:not(.practice-hud) .player-profile img { width: 28px; height: 28px; }
  .game-hud:not(.practice-hud) .player-profile strong { font-size: .8rem; }
  .game-hud:not(.practice-hud) .score { grid-column: 2; grid-row: 1; }
  .game-hud:not(.practice-hud) .time { grid-column: 3; grid-row: 1; }
  .game-hud:not(.practice-hud) .hud-system { grid-column: 4; grid-row: 1; justify-content: flex-end; }
  .game-hud:not(.practice-hud) .metric { min-width: 0; padding: 4px 6px; gap: 3px; border-radius: 10px; white-space: nowrap; }
  .game-hud:not(.practice-hud) .metric > span { font-size: .55rem; }
  .game-hud:not(.practice-hud) .metric strong { font-size: .95rem; }
  .game-hud:not(.practice-hud) :is(.progress-info, .live-rank, .hearts),
  .game-hud .level-info { position: absolute; width: 1px; height: 1px; min-width: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; padding: 0; border: 0; }
  .game-hud:not(.practice-hud) .progress-track { grid-column: 1 / -1; grid-row: 2; height: 10px; }
  .game-hud.practice-hud, .practice-hud .mission-info { gap: 4px; }
  .practice-hud .mission-heading { display: grid; grid-template-columns: minmax(72px, 1fr) auto 40px; gap: 4px; }
  .practice-hud .level-info { position: absolute; width: 1px; height: 1px; min-width: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .practice-hud .progress-info { grid-column: 1; grid-row: 1; box-sizing: border-box; width: 100%; min-width: 72px; min-height: 44px; padding: 4px 8px; gap: 6px; border-radius: 10px; white-space: nowrap; }
  .practice-hud .progress-info > span { font-size: .55rem; }
  .practice-hud .progress-info strong { font-size: 1rem; }
  .practice-hud .hud-system { grid-column: 3; grid-row: 1; justify-content: flex-end; }
  .practice-hud .practice-actions { grid-column: 2; grid-row: 1; display: grid; grid-template-columns: auto auto; gap: 4px; }
  .practice-hud .progress-track { height: 10px; }
}
/* Desktop: the full HUD with captions and large metrics. */
@media (min-width: 921px) and (min-height: 561px) {
  .practice-hud .mission-heading { grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); }
  .game-hud { align-items: start; }
  .pilot-info { gap: 12px; padding-bottom: 17px; }
  .mission-info { gap: 8px; }
  .mission-heading { gap: 12px; }
  .level-info { gap: 5px; }
  .game-brand { display: flex; }
  h1 { gap: 6px 12px; }
  .level-number { font-size: clamp(1.4rem, 1.8vw, 1.9rem); }
  .level-title { font-size: 1rem; }
  .level-context { flex-wrap: wrap; gap: 4px 10px; font-size: .7rem; }
  .level-context span + span { padding-left: 10px; }
  .metrics { flex-wrap: wrap; gap: 8px; }
  .metric { gap: 6px; min-width: 78px; min-height: 68px; padding: 8px 10px; border-radius: 14px; }
  .metric > span { font-size: .75rem; }
  .metric strong { font-size: clamp(1.45rem, 1.9vw, 2rem); }
  .progress-track { height: 10px; }
  .player-profile { padding: 6px 8px; border-radius: 16px; }
  .player-profile img { width: 48px; height: 48px; border-width: 3px; }
  .player-profile span { position: static; width: auto; height: auto; overflow: visible; clip-path: none; }
  .player-profile strong { font-size: 1.1rem; }
  .practice-hud .progress-info { min-height: 72px; }
}
@media (min-width: 1201px) and (min-height: 561px) {
  .player-profile { gap: 12px; padding: 8px 12px; }
  .player-profile img { width: 64px; height: 64px; }
  .player-profile strong { font-size: clamp(1.1rem, 1.4vw, 1.6rem); }
  .metric { min-width: 92px; min-height: 80px; padding: 10px 14px; }
}
</style>
