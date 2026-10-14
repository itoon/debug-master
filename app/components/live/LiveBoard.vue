<template>
  <section class="live-board" :aria-labelledby="headingId">
    <h2 :id="headingId">{{ t('live.board') }}</h2>
    <TransitionGroup tag="ol" name="board-row" class="rows">
      <li v-for="(player, index) in players" :key="player.id" class="row" :class="[medal(index), { off: !player.connected }]">
        <span class="n">{{ index + 1 }}</span>
        <img :src="avatarSrc(player.avatarId)" alt="" draggable="false" />
        <b :title="player.name">{{ player.name }}</b>
        <small>{{ player.score.toLocaleString('th-TH') }}</small>
      </li>
    </TransitionGroup>
  </section>
</template>

<script setup lang="ts">
import { useGameI18n } from "../../composables/useGameI18n";
import { usePlayerAvatar } from "../../composables/usePlayerAvatar";
import type { LivePlayer } from "../../utils/live/protocol";

defineProps<{ players: LivePlayer[] }>();
const { t } = useGameI18n();
const avatarSrc = usePlayerAvatar();
const headingId = useId();

function medal(index: number): string {
  return ["gold", "silver", "bronze"][index] ?? "";
}
</script>

<style scoped>
.live-board { display: flex; flex-direction: column; gap: .55cqw; min-height: 0; padding: 1.2cqw; border: 1px solid var(--cv-glass-border); border-radius: var(--cv-radius-lg); background: var(--cv-glass); }
h2 { margin: 0 0 .3cqw; font-size: 1.4cqw; font-weight: 800; }
.rows { position: relative; display: grid; grid-auto-rows: 2.9cqw; gap: .45cqw; min-height: 0; margin: 0; padding: 0; list-style: none; }
.row { display: flex; align-items: center; gap: .8cqw; min-width: 0; padding: 0 .7cqw; border: 1px solid transparent; border-radius: 10px; background: #ffffff0d; font-size: 1.25cqw; }
.row.off { opacity: .55; }
.n { flex: none; width: 1.8cqw; height: 1.8cqw; display: grid; place-items: center; border-radius: 50%; background: #ffffff1f; font-weight: 800; font-size: 1cqw; }
.row img { flex: none; width: 2.2cqw; height: 2.2cqw; border: 1px solid #8ba8de; border-radius: 50%; background: #d9e8ff; object-fit: contain; }
.row b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
.row small { color: #ffdb58; font-weight: 800; font-size: 1.25cqw; font-variant-numeric: tabular-nums; }
/* Medal colours shared with ChallengeRanking. */
.gold .n { background: #ffdc53; color: #112455; }
.silver .n { background: #c1d8ff; color: #112455; }
.bronze .n { background: #efb387; color: #112455; }
.row.gold { border-color: #ffdb5866; background: #ffdb5826; }
/* Rank changes slide rows into place (FLIP); lanes never reorder. */
.board-row-move { transition: transform 300ms ease; }
@media (prefers-reduced-motion: reduce) {
  .board-row-move { transition: none; }
}
</style>
