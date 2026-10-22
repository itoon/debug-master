<template>
  <section class="race-lanes" :class="{ compact }" :style="{ gridTemplateRows: `auto repeat(${rows}, minmax(0, 1fr))` }">
    <div class="ticks" aria-hidden="true">
      <span v-for="(tick, index) in ticks" :key="index" :style="{ left: `${index * 25}%` }">{{ formatScore(tick) }}</span>
    </div>
    <div v-for="player in lanes" :key="player.id" class="lane" :class="{ off: !player.connected }">
      <div class="pad" aria-hidden="true">{{ t('live.startLine') }}</div>
      <div class="strip" :style="{ backgroundImage: `url(${tileUrl(player.lane)})`, '--lane-p': `${fraction(player) * 100}%` }">
        <div class="runner" :class="{ lead: player.id === leaderId, hop: hopping.has(player.id), flip: fraction(player) > 0.7 }">
          <span class="portrait">
            <svg v-if="player.id === leaderId" class="crown" viewBox="0 0 32 24" aria-hidden="true"><path d="m3 6 7 5 6-9 6 9 7-5-4 15H7z" /><path d="M8 17h16" /></svg>
            <img :class="{ 'is-photo': avatarSrc(player.avatarId).startsWith('https:') }" :src="avatarSrc(player.avatarId)" alt="" draggable="false" />
            <span v-if="player.combo >= 5" class="combo">×{{ player.combo }}</span>
            <span class="plate">
              <b :title="player.name">{{ player.name }}</b>
              <small>{{ formatScore(player.score) }}</small>
              <em v-if="!player.connected" class="off-tag">{{ t('live.disconnected') }}</em>
            </span>
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, watch } from "vue";
import { useGameI18n } from "../../composables/useGameI18n";
import { usePlayerAvatar } from "../../composables/usePlayerAvatar";
import { laneFraction, trackTicks } from "../../utils/live/track";
import type { LivePlayer } from "../../utils/live/protocol";

const props = defineProps<{ players: LivePlayer[]; max: number }>();
const { t } = useGameI18n();
const avatarSrc = usePlayerAvatar();
const baseURL = useRuntimeConfig().app.baseURL;
const tileBase = baseURL.endsWith("/") ? baseURL : `${baseURL}/`;
const TILE_KINDS = ["grass", "ice", "sand", "stone", "wood", "blue"] as const;
/** How long a runner keeps hopping after its score goes up. */
const HOP_MS = 1200;

const lanes = computed(() => props.players.filter((p) => p.status === "playing").sort((a, b) => (a.lane ?? 99) - (b.lane ?? 99)));
// Keep at least six rows so a small round doesn't stretch lanes across the whole screen.
const rows = computed(() => Math.max(lanes.value.length, 6));
const compact = computed(() => rows.value > 8);
const ticks = computed(() => trackTicks(props.max));
const leaderId = computed(() => {
  let best: LivePlayer | null = null;
  for (const p of lanes.value) {
    if (p.score <= 0) continue;
    if (!best || p.score > best.score || (p.score === best.score && (p.levelsCompleted > best.levelsCompleted || (p.levelsCompleted === best.levelsCompleted && p.joinedAt < best.joinedAt)))) best = p;
  }
  return best?.id ?? null;
});

function tileUrl(lane: number | null): string {
  return `${tileBase}tiles/${TILE_KINDS[(lane ?? 0) % TILE_KINDS.length]}.png`;
}
function fraction(player: LivePlayer): number {
  return laneFraction(player.score, props.max);
}
function formatScore(value: number): string {
  return Math.round(value).toLocaleString("th-TH");
}

// A runner hops for HOP_MS after each score gain, then stands still.
const hopping = reactive(new Set<string>());
const hopTimers = new Map<string, ReturnType<typeof setTimeout>>();
const lastScores = new Map<string, number>();
watch(
  () => props.players.map((p) => [p.id, p.score] as const),
  (list) => {
    for (const [id, score] of list) {
      const previous = lastScores.get(id);
      lastScores.set(id, score);
      if (previous === undefined || score <= previous) continue;
      hopping.add(id);
      clearTimeout(hopTimers.get(id));
      hopTimers.set(id, setTimeout(() => { hopping.delete(id); hopTimers.delete(id); }, HOP_MS));
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  for (const timer of hopTimers.values()) clearTimeout(timer);
  hopTimers.clear();
});
</script>

<style scoped>
/* Animatable lane progress: the lit part of the strip and the runner move together. */
@property --lane-p { syntax: "<percentage>"; inherits: true; initial-value: 0%; }
/* One stage cqw, frozen to px so it survives inside the strips (each strip is a size container for cqh). */
@property --stage-u { syntax: "<length>"; inherits: true; initial-value: 0px; }

.race-lanes { --stage-u: 1cqw; display: grid; gap: .55cqw; min-height: 0; }
.ticks { position: relative; height: 1.5cqw; margin: 0 0 0 7cqw; color: #bed6ff; font-size: 1cqw; font-variant-numeric: tabular-nums; }
.ticks span { position: absolute; top: 0; transform: translateX(-50%); white-space: nowrap; }
.ticks span:first-child { transform: none; }
.ticks span:last-child { transform: translateX(-100%); }
.lane { position: relative; display: flex; align-items: center; min-height: 0; }
.lane.off { opacity: .45; }
.pad { flex: none; width: 6.2cqw; height: 78%; display: grid; place-items: center; margin-right: .8cqw; border: 1px dashed #ffffff66; border-radius: var(--cv-radius-sm); background: #ffffff1f; color: #e4edff; font-weight: 800; font-size: .95cqw; }
.strip { position: relative; flex: 1; height: 78%; border-radius: 10px; background-size: auto 100%; background-repeat: repeat-x; filter: saturate(1.05); box-shadow: 0 .7cqw 1.2cqw #03102f80; transition: --lane-p 600ms ease-out; container-type: size; }
/* The stretch ahead of the runner stays dark. */
.strip::after { content: ""; position: absolute; inset: 0; border-radius: inherit; background: linear-gradient(90deg, transparent var(--lane-p), #061a38a6 var(--lane-p)); }
/* The runner is the portrait, centred on the lane progress; its plate hangs beside it. */
.runner { position: absolute; left: var(--lane-p); top: 50%; z-index: 2; width: min(110cqh, calc(4.6 * var(--stage-u))); height: min(110cqh, calc(4.6 * var(--stage-u))); transform: translate(-50%, -58%); }
.runner.hop { animation: hop .32s ease-in-out infinite alternate; }
.portrait { position: relative; display: block; width: 100%; height: 100%; }
.portrait img { display: block; width: 100%; height: 100%; border: calc(.3 * var(--stage-u)) solid #dbeaff; border-radius: 50%; background: radial-gradient(circle at top, #76a3ed, #23448d); object-fit: contain; box-shadow: 0 calc(.4 * var(--stage-u)) calc(1 * var(--stage-u)) #06183c; }
.portrait img.is-photo { object-fit: cover; background: transparent; }
.lead .portrait img { border-color: #ffdb58; box-shadow: 0 0 calc(1.6 * var(--stage-u)) #ffdb5899; }
.crown { position: absolute; left: 28%; top: -42%; width: 44%; fill: #ffdb58; stroke: #8a5a00; stroke-width: 1.5; filter: drop-shadow(0 2px 2px #101d46); }
.combo { position: absolute; left: -26%; bottom: -10%; padding: calc(.05 * var(--stage-u)) calc(.45 * var(--stage-u)); border-radius: 999px; background: #f79722; color: #3b1d00; font-weight: 800; font-size: calc(.95 * var(--stage-u)); line-height: 1.3; box-shadow: 0 0 calc(1 * var(--stage-u)) #f79722aa; }
.plate { position: absolute; left: calc(100% + .5 * var(--stage-u)); top: 50%; transform: translateY(-50%); display: grid; width: max-content; max-width: calc(13 * var(--stage-u)); padding: calc(.25 * var(--stage-u)) calc(.8 * var(--stage-u)); border: 1px solid #6e9fe855; border-radius: var(--cv-radius-sm); background: #071e49e6; white-space: nowrap; }
.flip .plate { left: auto; right: calc(100% + .5 * var(--stage-u)); }
.plate b { overflow: hidden; text-overflow: ellipsis; font-size: calc(1.15 * var(--stage-u)); line-height: 1.25; }
.plate small { color: #ffdb58; font-weight: 800; font-size: calc(1.2 * var(--stage-u)); line-height: 1.2; font-variant-numeric: tabular-nums; }
.off-tag { justify-self: start; margin-top: calc(.15 * var(--stage-u)); padding: 0 calc(.5 * var(--stage-u)); border-radius: 999px; background: #4a1b33; color: #ffb3b3; font-style: normal; font-weight: 800; font-size: calc(.85 * var(--stage-u)); }
/* Nine or more lanes: one-line plates so neighbouring lanes don't collide. */
.compact .plate { display: flex; align-items: baseline; gap: calc(.6 * var(--stage-u)); padding: calc(.15 * var(--stage-u)) calc(.6 * var(--stage-u)); }
.compact .plate b { font-size: calc(1 * var(--stage-u)); }
.compact .plate small { font-size: calc(1.05 * var(--stage-u)); }
.compact .combo { font-size: calc(.8 * var(--stage-u)); }
.compact .off-tag { margin: 0; font-size: calc(.75 * var(--stage-u)); }
@keyframes hop { from { translate: 0 0; } to { translate: 0 -12%; } }
@media (prefers-reduced-motion: reduce) {
  .strip { transition: none; }
  .runner.hop { animation: none; }
}
</style>
