<template>
  <header class="game-hud">
    <div class="pilot-info">
      <div class="player-profile"><img :src="avatarSrc(avatarId)" alt="" draggable="false" /><div><span>{{ t('game.player') }}</span><strong :title="playerName">{{ playerName || t('game.playerFallback') }}</strong></div></div>
      <div class="metrics">
        <div class="metric score"><span>{{ t('game.score') }}</span><strong>{{ score.toLocaleString('th-TH') }}</strong></div>
        <div v-if="timed" class="metric time"><span>{{ t('game.timer') }}</span><strong>{{ time }}</strong></div>
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
      </div>
      <progress v-if="totalLevels" :value="completedLevels" :max="totalLevels" :aria-label="t('game.progress')" />
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
.game-hud { flex: none; display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(320px, .95fr); align-items: start; gap: 16px; min-width: 0; }
.pilot-info { display: flex; justify-content: space-between; align-items: center; align-self: stretch; min-width: 0; gap: 12px; padding-bottom: 17px; border-bottom: 1px solid #9ac5ff80; }
.mission-info { min-width: 0; display: grid; gap: 8px; }
.mission-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; min-width: 0; }
.level-info { min-width: 0; display: grid; gap: 5px; }
p, h1 { margin: 0; }
.game-brand { display: flex; align-items: center; gap: 7px; font-size: .75rem; color: #d9eaff; font-weight: 800; }
.game-brand i { width: 7px; height: 7px; border-radius: 50%; background: #ffdb58; box-shadow: 0 0 8px #ffdb5855; }
h1 { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 12px; line-height: 1.15; }
.level-number { color: #ffdb58; font-size: clamp(1.4rem, 1.8vw, 1.9rem); white-space: nowrap; font-weight: 500; }
.level-title { color: #fff; font-size: 1rem; font-weight: 800; }
.level-context { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; color: #bdd6ff; font-size: .7rem; line-height: 1.4; }
.concept { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-transform: uppercase; font-weight: 700; }
.level-context span + span { padding-left: 10px; border-left: 1px solid #8eafff55; }
.metrics { flex: none; display: flex; align-items: stretch; flex-wrap: wrap; gap: 8px; font-variant-numeric: tabular-nums; }
.metric { display: grid; align-content: center; gap: 6px; min-width: 92px; min-height: 80px; padding: 10px 14px; border: 1px solid #6e9fe840; border-radius: 14px; background: #071e49b8; }
.metric > span { color: #bed6ff; font-size: .75rem; line-height: 1.2; }
.metric strong { font-size: clamp(1.45rem, 1.9vw, 2rem); line-height: 1; color: #fff; }
.score strong { color: #ffdb58; }
.progress-info strong { color: #87dfff; }
progress { appearance: none; width: 100%; height: 10px; padding: 2px; border: 1px solid #82aeef55; border-radius: 8px; overflow: hidden; background: #071e49b8; accent-color: #87dfff; }
progress::-webkit-progress-bar { background: #6688cc44; }
progress::-webkit-progress-value { background: #87dfff; border-radius: 4px; }
progress::-moz-progress-bar { background: #87dfff; }
.player-profile { display: flex; align-items: center; gap: 12px; min-width: 0; padding: 8px 12px; border-radius: 16px; background: #071e4980; }
.player-profile img { flex: none; width: 64px; height: 64px; border: 3px solid #dbeaff; border-radius: 50%; background: #dbeaff; object-fit: contain; }
.player-profile div { display: grid; gap: 1px; min-width: 0; }
.player-profile span { font-size: .8rem; color: #bed6ff; }
.player-profile strong { color: #fff; font-size: clamp(1.1rem, 1.4vw, 1.6rem); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hearts { align-self: center; display: flex; gap: 2px; color: #ff6980; }
.hearts i { font-style: normal; }
.hearts .lost { color: #ffffff40; }
@media (max-width: 1200px) { .player-profile { padding: 6px 8px; gap: 8px; } .player-profile img { width: 48px; height: 48px; } .metric { min-width: 78px; min-height: 68px; padding: 8px 10px; } .player-profile strong { font-size: 1.1rem; } }
@media (max-width: 920px) { .game-hud { grid-template-columns: minmax(0, 1fr); gap: 12px; } }
@media (max-width: 480px) { .pilot-info { flex-wrap: wrap; gap: 8px; } .player-profile { width: 100%; } .metrics { width: 100%; } .metrics .metric { flex: 1; } .metric { min-height: 60px; } .mission-heading { gap: 8px; } .progress-info { min-width: 70px; } .level-context { font-size: .65rem; } }
</style>
