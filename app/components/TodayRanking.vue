<template>
  <section class="today-ranking" :aria-labelledby="headingId">
    <h2 :id="headingId">{{ title }}</h2>
    <p class="board-name">{{ subtitle }}</p>
    <p class="board-rules">คะแนนมากก่อน · เสมอกันดูด่านที่ผ่าน แล้วดูเวลาที่อัปเดต{{ board.scoringStrategy === 'BEST' ? 'ก่อน' : 'ล่าสุด' }} · วันนี้ตามเวลาไทย</p>

    <ol v-if="rows.length" class="rows">
      <li
        v-for="(score, index) in rows"
        :key="score.id"
        :class="{ top: index === 0, mine: score.id === highlightId }"
      >
        <span class="rank">{{ index + 1 }}</span>
        <span class="who">
          <strong>{{ score.name }}</strong>
          <small v-if="ageBand(score.age)">{{ ageBand(score.age) }}</small>
        </span>
        <span class="result">
          <strong>{{ score.score.toLocaleString("en-US") }}</strong>
          <small>{{ formatClock(score.elapsedMs) }}</small>
        </span>
      </li>
    </ol>
    <p v-else class="empty">ยังไม่มีใครเล่นแบบนี้วันนี้ เริ่มเป็นคนแรกเลย</p>
  </section>
</template>

<script setup lang="ts">
// "Today's ranking" card: the start screen shows it for the mode being picked,
// the end-of-game dialog for the mode just played. Rules: utils/ranking.ts.
import type { Score } from "../types/debug-game";
import {
  ageBand,
  formatClock,
  todayRanking,
  type RankingBoard,
} from "../utils/ranking";

const props = withDefaults(
  defineProps<{
    scores: Score[];
    board: RankingBoard;
    subtitle: string;
    title?: string;
    /** Score to highlight, e.g. the run that just ended. */
    highlightId?: string;
  }>(),
  { title: "อันดับวันนี้", highlightId: "" },
);

const headingId = useId();
const rows = computed(() => todayRanking(props.scores, props.board));
</script>

<style scoped>
.today-ranking {
  display: grid;
  gap: 6px;
  align-content: start;
  color: var(--cv-text);
}

h2 {
  margin: 0 0 6px;
  color: var(--cv-heading);
  font-size: clamp(1.6rem, 3vw, 2.1rem);
  font-weight: 800;
}

.board-name {
  margin: 0;
  color: var(--cv-heading);
  font-weight: 700;
}

.board-rules {
  margin: 0 0 12px;
  color: var(--cv-muted);
  font-size: 0.85rem;
}

.rows {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rows li {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid var(--cv-border);
  border-radius: var(--cv-radius);
  background: #fff;
}

.rows li.top {
  border-color: #f6e3a8;
  background: #fff8e1;
}

.rows li.mine {
  box-shadow: 0 0 0 2px var(--cv-blue);
}

.rank {
  color: var(--cv-heading);
  font-weight: 800;
  text-align: center;
}

.who,
.result {
  display: grid;
  min-width: 0;
  line-height: 1.3;
}

.who strong {
  overflow: hidden;
  color: var(--cv-heading);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.result strong {
  color: var(--cv-heading);
}

small {
  color: var(--cv-muted);
  font-size: 0.8rem;
}

.empty {
  margin: 0;
  padding: 18px 14px;
  border: 1px dashed var(--cv-border);
  border-radius: var(--cv-radius);
  color: var(--cv-muted);
  text-align: center;
}
</style>
