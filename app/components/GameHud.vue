<template>
  <header class="game-hud">
    <div class="level-info">
      <p class="game-brand"><i aria-hidden="true" />Debug Runner</p>
      <h1><span class="level-number">LV {{ level.id.toString().padStart(2, '0') }}</span><span class="level-title">{{ level.title }}</span></h1>
      <p class="level-context"><span class="concept" :title="level.concept">{{ level.concept }}</span><span>{{ language }}</span><span>{{ difficulty }}</span></p>
    </div>
    <div class="metrics">
      <div v-if="timed" class="metric time"><span>{{ t('game.timer') }}</span><strong>{{ time }}</strong></div>
      <div class="metric score"><span>{{ t('game.score') }}</span><strong>{{ score.toLocaleString('th-TH') }}</strong><small>{{ t('game.combo') }} ×{{ combo }}</small></div>
      <div class="metric progress-info"><span>{{ t('game.progress') }}</span><strong>{{ progress }}</strong><progress v-if="totalLevels" :value="completedLevels" :max="totalLevels" :aria-label="t('game.progress')" /></div>
      <span v-if="lives !== undefined" class="hearts" role="img" :aria-label="t('game.lives', { count: lives })"><i v-for="heart in maxLives" :key="heart" :class="{ lost: heart > lives }" aria-hidden="true">♥</i></span>
    </div>
    <div class="player-tools">
      <div class="player-profile"><img :src="avatarSrc(avatarId)" alt="" draggable="false" /><div><span>{{ t('game.player') }}</span><strong :title="playerName">{{ playerName || t('game.playerFallback') }}</strong></div></div>
      <nav class="actions" :aria-label="t('game.actions')"><slot name="actions" /></nav>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useGameI18n } from "../composables/useGameI18n";
import { usePlayerAvatar } from "../composables/usePlayerAvatar";
defineProps<{
  level: { id: number; title?: string; concept: string };
  language: string;
  difficulty: string;
  playerName: string;
  avatarId?: string;
  timed: boolean;
  time: string;
  score: number;
  combo: number;
  progress: string;
  completedLevels: number;
  totalLevels: number;
  lives?: number;
  maxLives: number;
}>();
const { t } = useGameI18n();
const avatarSrc = usePlayerAvatar();
</script>

<style scoped>
.game-hud { flex: none; display: grid; grid-template-columns: minmax(230px, 1fr) auto minmax(220px, .7fr); align-items: center; gap: clamp(12px, 1.5vw, 24px); min-width: 0; padding: 0 0 10px; border-bottom: 1px solid #9ac5ff26; }
.level-info { min-width: 0; display: grid; gap: 5px; }
p, h1 { margin: 0; }
.game-brand { display: flex; align-items: center; gap: 7px; font-size: .75rem; color: #d9eaff; font-weight: 800; }
.game-brand i { width: 7px; height: 7px; border-radius: 50%; background: #ffdb58; box-shadow: 0 0 8px #ffdb5855; }
h1 { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 12px; line-height: 1.15; }
.level-number { color: #ffdb58; font-size: clamp(1.25rem, 1.6vw, 1.6rem); white-space: nowrap; }
.level-title { color: #fff; font-size: 1rem; font-weight: 800; }
.level-context { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; color: #bdd6ff; font-size: .7rem; line-height: 1.4; }
.concept { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-transform: uppercase; font-weight: 700; }
.level-context span + span { padding-left: 10px; border-left: 1px solid #8eafff55; }
.metrics { display: flex; align-items: stretch; flex-wrap: wrap; gap: 6px; font-variant-numeric: tabular-nums; }
.metric { display: grid; align-content: center; gap: 3px; min-width: 78px; padding: 6px 10px; border: 1px solid #6e9fe840; border-radius: 10px; background: #071e49b8; }
.metric > span { color: #bed6ff; font-size: .65rem; line-height: 1.2; }
.metric strong { font-size: clamp(1.2rem, 1.5vw, 1.6rem); line-height: 1; color: #fff; }
.metric small { color: #d0e0ff; font-size: .6rem; }
.score strong { color: #ffdb58; }
.progress-info strong { color: #87dfff; }
progress { appearance: none; width: 100%; height: 4px; border: 0; border-radius: 4px; overflow: hidden; background: #6688cc44; accent-color: #87dfff; }
progress::-webkit-progress-bar { background: #6688cc44; }
progress::-webkit-progress-value { background: #87dfff; border-radius: 4px; }
progress::-moz-progress-bar { background: #87dfff; }
.player-tools { display: grid; justify-items: end; gap: 6px; min-width: 0; }
.player-profile { display: flex; align-items: center; gap: 9px; min-width: 0; max-width: 100%; }
.player-profile img { flex: none; width: 42px; height: 42px; border: 2px solid #8fb9ff; border-radius: 50%; background: #dbeaff; object-fit: contain; }
.player-profile div { display: grid; gap: 1px; min-width: 0; }
.player-profile span { font-size: .6rem; color: #bed6ff; }
.player-profile strong { color: #fff; font-size: 1rem; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
:slotted(button) { min-height: 44px; padding: 0 12px; border-radius: 10px; font-size: .8rem; }
.hearts { align-self: center; display: flex; gap: 2px; color: #ff6980; }
.hearts i { font-style: normal; }
.hearts .lost { color: #ffffff40; }
@media (max-width: 1100px) { .game-hud { grid-template-columns: minmax(0, 1fr) auto; gap: 8px 16px; } .metrics { grid-row: 2; grid-column: 1 / -1; justify-content: center; } .player-tools { grid-column: 2; grid-row: 1; } }
@media (max-width: 560px) { .game-hud { grid-template-columns: 1fr; } .player-tools { grid-row: auto; grid-column: 1; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; } .player-profile strong { max-width: 180px; } .metrics { grid-row: auto; grid-column: 1; justify-content: stretch; } .metric { flex: 1; } }
</style>
