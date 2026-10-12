<template>
  <section class="challenge-ranking" :aria-labelledby="headingId">
    <h3 :id="headingId">{{ t('home.today') }}</h3>
    <p v-if="error" class="board-error" role="alert">{{ t('storage.loadError') }}</p>
    <ol v-else-if="rows.length" class="challenge-rows">
      <li v-for="(score, index) in rows" :key="score.id"
        :class="[{ podium: index < 3, mine: score.id === highlightId }, `place-${index + 1}`]">
        <span class="rank-number" :aria-label="t('ranking.rank', { rank: index + 1 })">{{ index + 1 }}</span>
        <span class="who">
          <strong>{{ score.name }}</strong>
          <small v-if="ageRange(score.age)">{{ ageRange(score.age) }}</small>
        </span>
        <span v-if="score.id === highlightId" class="you">{{ t('ranking.you') }}</span>
        <span class="result">
          <strong :aria-label="t('ranking.points', { score: score.score })">{{ score.score.toLocaleString('th-TH') }}</strong>
          <small>{{ formatClock(score.elapsedMs) }}</small>
        </span>
      </li>
    </ol>
    <div v-else class="challenge-empty">
      <img :src="PLAYER_SPRITES.down" alt="Codi" draggable="false" />
      <p>{{ t('ranking.empty') }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ScoreRepository } from "../storage/contracts";
import type { RankingBoard } from "../utils/ranking";
import { formatClock } from "../utils/ranking";
import { PLAYER_SPRITES } from "../utils/playerSprites";
import { useScoreBoard } from "../composables/useScoreBoard";
import { useGameI18n } from "../composables/useGameI18n";

const props = defineProps<{ repository: ScoreRepository; board: RankingBoard; highlightId?: string }>();
const { t } = useGameI18n();
const headingId = useId();
const { rows, error } = useScoreBoard(props.repository, computed(() => props.board));
function ageRange(age?: number): string {
  if (!age) return "";
  const band = [[5, 8], [9, 12], [13, 15], [16, 18]].find(([from, to]) => age >= from! && age <= to!);
  return band ? t("ranking.ageBand", { from: band[0]!, to: band[1]! }) : "";
}
</script>

<style scoped>
.challenge-ranking { display: flex; flex-direction: column; min-height: 0; gap: 6px; color: var(--cv-text); }
h3 { margin: 0; font-size: .85rem; font-weight: 800; color: var(--cv-heading); }
.challenge-rows { display: grid; gap: 3px; margin: 0; padding: 0; list-style: none; }
.challenge-rows li { display: flex; align-items: center; gap: 8px; min-width: 0; min-height: 24px; padding: 2px 8px; line-height: 1.2; border-radius: 8px; background: #f1f5fb; }
.challenge-rows li.podium { border-left: 3px solid #e2b537; background: #fff5cf; }
.challenge-rows li.place-2 { border-left-color: #91a6c2; background: #edf3fc; }
.challenge-rows li.place-3 { border-left-color: #d39467; background: #fff0e5; }
.challenge-rows li.mine { outline: 2px solid var(--cv-blue); outline-offset: -2px; }
.rank-number { flex: 0 0 20px; text-align: center; font-size: .85rem; font-weight: 800; }
.who { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 6px; }
.who strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .85rem; }
.who small { flex: none; font-size: .65rem; color: #526079; }
.result { display: flex; align-items: baseline; gap: 8px; font-variant-numeric: tabular-nums; }
.result strong { font-size: .85rem; }
.result small { font-size: .7rem; color: #526079; }
.you { font-size: .65rem; color: #1254c7; }
.challenge-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; min-height: 150px; padding: 16px; text-align: center; border: 1px dashed #b6c9e8; border-radius: 14px; background: #f0f6ff; }
.challenge-empty img { width: 76px; height: 92px; object-fit: contain; }
.challenge-empty p { max-width: 210px; margin: 0; font-size: .9rem; color: #526079; }
.board-error { padding: 16px; color: #a32d30; }
@media (max-width: 450px) { .who { display: grid; gap: 0; } .challenge-rows li { min-height: 40px; } }
</style>
