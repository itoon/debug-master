<template>
  <section class="challenge-ranking" :class="{ space: variant === 'space' }" :aria-labelledby="headingId">
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
      <div class="codi-stand">
        <span class="landing-pad" aria-hidden="true" />
        <img :src="variant === 'space' ? codiHappy : PLAYER_SPRITES.down" alt="Codi" draggable="false" />
      </div>
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
import codiHappy from "~/assets/sprites/cody-happy.webp";

const props = withDefaults(defineProps<{ repository: ScoreRepository; board: RankingBoard; highlightId?: string; variant?: "light" | "space" }>(), { variant: "light" });
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
.codi-stand { position: relative; display: grid; place-items: center; }
.landing-pad { display: none; }
/* Home's space theme is scoped; summary keeps its existing light ranking. */
.space { gap: 8px; color: #f0f5ff; }
.space h3 { display: flex; align-items: center; gap: 10px; font-size: .875rem; color: #dce8ff; }
.space h3::after { content: ""; height: 1px; flex: 1; background: rgba(135, 179, 255, .35); }
.space .challenge-rows { gap: 4px; }
.space .challenge-rows li { min-height: 28px; padding: 2px 8px; border: 1px solid rgba(110, 153, 242, .23); border-radius: 9px; background: #102a70; }
.space .challenge-rows li.podium { border-left: 3px solid #ffdb58; background: linear-gradient(90deg, rgba(255, 210, 64, .16), rgba(27, 57, 133, .9)); }
.space .challenge-rows li.place-2 { border-left-color: #c1d8ff; background: linear-gradient(90deg, rgba(182, 213, 255, .14), rgba(27, 57, 133, .9)); }
.space .challenge-rows li.place-3 { border-left-color: #f1b784; background: linear-gradient(90deg, rgba(245, 161, 105, .14), rgba(27, 57, 133, .9)); }
.space .rank-number { display: grid; place-items: center; flex-basis: 22px; height: 22px; border-radius: 50%; background: #274b98; color: #dce8ff; }
.space .podium .rank-number { background: #ffdb58; color: #152c61; }
.space .place-2 .rank-number { background: #c1d8ff; }
.space .place-3 .rank-number { background: #f1b784; }
.space .who strong, .space .result strong { font-size: .9rem; }
.space .place-1 .result strong { color: #ffe47e; }
.space .who small, .space .result small { color: #b5cdfa; }
.space .you { color: #ffe47e; }
.space .challenge-empty { gap: 18px; padding: 18px; border: 2px solid #8bc2ff; border-radius: 18px; background-color: #abd8ff; background-image: linear-gradient(rgba(255, 255, 255, .55) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, .55) 1px, transparent 1px), linear-gradient(135deg, #8bcbf7, #bfddff); background-size: 32px 32px, 32px 32px, 100% 100%; box-shadow: inset 0 1px 0 #e5f4ff; }
.space .challenge-empty img { position: relative; z-index: 1; width: 116px; height: 140px; object-fit: contain; filter: drop-shadow(0 5px 2px rgba(20, 69, 148, .25)); }
.space .landing-pad { display: block; position: absolute; bottom: -5px; width: 150px; height: 25px; border: 2px solid #123981; border-radius: 50%; background: #377eff; box-shadow: 0 4px 0 #124da8; }
.space .challenge-empty p { position: relative; z-index: 1; max-width: 250px; padding: 10px 14px; border: 2px solid #14397b; border-radius: 14px; background: #fff; color: #18366c; font-size: .9rem; font-weight: 700; box-shadow: 0 4px 0 rgba(31, 86, 164, .18); }
.space .board-error { border-radius: 12px; background: #102a70; color: #ffd2b8; }
@media (max-width: 450px) { .who { display: grid; gap: 0; } .challenge-rows li { min-height: 40px; } }
</style>
