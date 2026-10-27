<template>
  <section class="live-results" :aria-labelledby="headingId">
    <h2 :id="headingId" class="res-title"><span aria-hidden="true">🏁 </span>{{ title[0] }}<em>{{ title[1] }}</em></h2>
    <p class="res-mode">{{ t('live.mode') }} <em>{{ mode }} · {{ t(`difficulty.${mode}`) }}</em></p>
    <ol class="podium" :class="{ crowded: rest.length > 5 }">
      <li v-for="place in podium" :key="place.rank" class="ps" :class="`p${place.rank}`" :aria-label="place.player ? `${place.rank} · ${place.player.name}` : undefined">
        <span class="portrait" :class="{ vacant: !place.player }">
          <svg v-if="place.rank === 1 && place.player" class="crown" viewBox="0 0 32 24" aria-hidden="true"><path d="m3 6 7 5 6-9 6 9 7-5-4 15H7z" /><path d="M8 17h16" /></svg>
          <PlayerAvatar v-if="place.player" :avatar-id="place.player.avatarId" />
        </span>
        <b :title="place.player?.name">{{ place.player?.name ?? '—' }}</b>
        <small>{{ place.player ? place.player.score.toLocaleString('th-TH') : '—' }}</small>
        <span class="block" aria-hidden="true">{{ place.rank }}</span>
      </li>
    </ol>
    <ol v-if="rest.length" class="rest">
      <li v-for="(player, index) in rest" :key="player.id">{{ index + 4 }} {{ player.name }} <em>{{ player.score.toLocaleString('th-TH') }}</em></li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useGameI18n } from "../../composables/useGameI18n";
import type { LivePlayer, ModeId } from "../../utils/live/protocol";

const props = defineProps<{ players: LivePlayer[]; mode: ModeId }>();
const { t } = useGameI18n();
const headingId = useId();

const ranked = computed(() => props.players.filter((p) => p.status === "playing"));
// Visual order second, first, third; the rise order (3 → 2 → 1) is set in CSS.
const podium = computed(() => [2, 1, 3].map((rank) => ({ rank, player: ranked.value[rank - 1] ?? null })));
const rest = computed(() => ranked.value.slice(3));
// Highlight the last word of the title ("ผู้ชนะ") in yellow, as in the approved mockup.
const title = computed(() => {
  const text = t("live.resultsTitle");
  const at = text.lastIndexOf(" ");
  return at < 0 ? ["", text] : [text.slice(0, at + 1), text.slice(at + 1)];
});
</script>

<style scoped>
.live-results { position: absolute; inset: 0; }
.res-title { position: absolute; top: 3cqw; left: 0; right: 0; margin: 0; text-align: center; font-size: 4cqw; font-weight: 900; line-height: 1.1; }
.res-title em, .res-mode em { font-style: normal; color: #ffdb58; }
.res-mode { position: absolute; top: 8cqw; left: 0; right: 0; margin: 0; text-align: center; color: #bed6ff; font-size: 1.5cqw; font-weight: 700; }
.res-mode em { color: #87dfff; }
.podium { position: absolute; left: 18%; right: 18%; bottom: 13cqw; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: end; margin: 0; padding: 0; list-style: none; }
/* Medal colours and block faces shared with ChallengeRanking. */
.ps { --medal: #ffdc53; --face: linear-gradient(135deg, #f8dda0, #b38026); --rise-delay: 240ms; display: flex; flex-direction: column; align-items: center; gap: .6cqw; min-width: 0; }
.ps.p2 { --medal: #c1d8ff; --face: linear-gradient(135deg, #e6edf6, #8294ad); --rise-delay: 120ms; }
.ps.p3 { --medal: #efb387; --face: linear-gradient(135deg, #f0c7a4, #a2653c); --rise-delay: 0ms; }
.portrait { position: relative; width: 9cqw; height: 9cqw; border: .5cqw solid var(--medal); border-radius: 50%; background: radial-gradient(circle at top, #76a3ed, #23448d); box-shadow: 0 .6cqw 1.6cqw #06183c; }
.portrait img { display: block; width: 100%; height: 100%; border-radius: 50%; object-fit: contain; }
.portrait.vacant { border-style: dashed; opacity: .6; }
.crown { position: absolute; left: 26%; top: -38%; width: 48%; fill: #ffda4b; stroke: #b27f21; stroke-width: 1.5; filter: drop-shadow(0 2px 2px #101d46); }
.ps b { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 2cqw; line-height: 1.25; }
.ps small { color: #ffdb58; font-weight: 900; font-size: 2.2cqw; line-height: 1.15; font-variant-numeric: tabular-nums; }
.block { width: 100%; display: grid; justify-items: center; padding-top: 1.2cqw; border-radius: 12px 12px 0 0; background: var(--face); color: #112455; font-size: 4.5cqw; font-weight: 900; line-height: 1; }
.p1 .block { height: 14cqw; }
.p2 .block { height: 10cqw; }
.p3 .block { height: 7.5cqw; }
/* Two rows of runners-up: lift the podium and shorten its blocks so nothing overlaps. */
.podium.crowded { bottom: 16.5cqw; }
.crowded .p1 .block { height: 10cqw; }
.crowded .p2 .block { height: 7cqw; }
.crowded .p3 .block { height: 5cqw; }
.rest { position: absolute; left: 10%; right: 10%; bottom: 5cqw; display: flex; flex-wrap: wrap; justify-content: center; gap: .8cqw 1.2cqw; margin: 0; padding: 0; list-style: none; }
.rest li { max-width: 22cqw; padding: .6cqw 1.4cqw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border: 1px solid #6e9fe855; border-radius: 999px; background: #071e49d0; font-size: 1.6cqw; }
.rest em { font-style: normal; color: #ffdb58; font-weight: 800; }
/* Podium rises third, second, then first; players drop onto their block and the crown pops last. */
.block { transform-origin: center bottom; animation: podium-rise 560ms var(--rise-delay) cubic-bezier(.34, 1.3, .64, 1) backwards; }
.portrait, .ps b, .ps small { animation: podium-drop 460ms calc(var(--rise-delay) + 260ms) cubic-bezier(.34, 1.5, .64, 1) backwards; }
.crown { transform-origin: 50% 100%; animation: crown-pop 520ms 820ms cubic-bezier(.34, 1.8, .64, 1) backwards; }
@keyframes podium-rise { from { transform: scaleY(.05); } }
@keyframes podium-drop { from { opacity: 0; transform: translateY(-2cqw); } }
@keyframes crown-pop { 0% { opacity: 0; transform: translateY(8px) scale(.3) rotate(-30deg); } 100% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .block, .portrait, .ps b, .ps small, .crown { animation: none; }
}
</style>
