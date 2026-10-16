<template>
  <section class="lobby-stage">
    <div class="lobby">
      <figure class="qrcard">
        <!-- QR is rendered locally by uqr from our own join URL. -->
        <div class="qr" role="img" :aria-label="joinUrl" v-html="qrSvg" />
        <figcaption>{{ t('live.scanToJoin') }}</figcaption>
      </figure>
      <div class="room">
        <p class="ltitle">{{ t('live.roomCode') }}</p>
        <p class="code">{{ code }}</p>
        <p class="chip">{{ roundInfo[0] }}<em>{{ modeLabel }}</em>{{ roundInfo[1] }}</p>
      </div>
    </div>
    <img class="brand-logo" :src="debugMasterLogo" width="1448" height="980" alt="Debug Master" draggable="false" />
    <ol class="startrow" :aria-label="t('live.players')">
      <li v-for="seat in seats" :key="seat.index" class="slot" :class="{ empty: !seat.player, off: seat.player && !seat.player.connected }">
        <img v-if="seat.player" :key="seat.player.id" class="av filled" :src="avatarSrc(seat.player.avatarId)" alt="" draggable="false" />
        <img v-else class="av" :src="avatarSrc()" alt="" draggable="false" />
        <span class="tile" aria-hidden="true" />
        <b :title="seat.player?.name">{{ seat.player?.name ?? t('live.emptySeat') }}</b>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { renderSVG } from "uqr";
import debugMasterLogo from "../../assets/brand/logo-sleep-display.png";
import { homeConfig } from "../../data/home-config";
import { useGameI18n } from "../../composables/useGameI18n";
import { usePlayerAvatar } from "../../composables/usePlayerAvatar";
import { MAX_PLAYERS, type LivePlayer, type ModeId } from "../../utils/live/protocol";

const props = defineProps<{ code: string; joinUrl: string; mode: ModeId; durationSec: number; players: LivePlayer[] }>();
const { t } = useGameI18n();
const avatarSrc = usePlayerAvatar();
const logoFloatDuration = `${homeConfig.sleepScreen.floatMs}ms`;
const baseURL = useRuntimeConfig().app.baseURL;
const grassTile = `url(${baseURL.endsWith("/") ? baseURL : `${baseURL}/`}tiles/grass.png)`;

const qrSvg = computed(() => (props.joinUrl ? renderSVG(props.joinUrl, { border: 1, blackColor: "#061a38" }) : ""));
const modeLabel = computed(() => `${props.mode} · ${t(`difficulty.${props.mode}`)}`);
// The translated template keeps {mode} when no value is given, so the mode can be highlighted in place.
const roundInfo = computed(() => {
  const text = t("live.nextRound", { minutes: Math.max(1, Math.round(props.durationSec / 60)) });
  const at = text.indexOf("{mode}");
  return at < 0 ? [text, ""] : [text.slice(0, at), text.slice(at + "{mode}".length)];
});

/** Twelve seats in lane order; empty seats stay visible so people know they can still join. */
const seats = computed(() => {
  const list: { index: number; player: LivePlayer | null }[] = Array.from({ length: MAX_PLAYERS }, (_, index) => ({ index, player: null }));
  const unplaced: LivePlayer[] = [];
  for (const p of props.players) {
    if (p.status !== "playing") continue;
    const seat = p.lane != null ? list[p.lane] : undefined;
    if (seat && !seat.player) seat.player = p;
    else unplaced.push(p);
  }
  for (const p of unplaced) {
    const seat = list.find((s) => !s.player);
    if (seat) seat.player = p;
  }
  return list;
});
</script>

<style scoped>
.lobby-stage { position: absolute; inset: 0; }
.lobby { position: absolute; inset: 0; display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 4cqw; padding: 5cqw 6cqw 15cqw; }
.qrcard { display: grid; justify-items: center; gap: .8cqw; margin: 0; padding: 1.6cqw; border-radius: var(--cv-radius-xl); background: #fff; color: #061a38; box-shadow: 0 2cqw 3cqw #03102f80; }
.qr { width: 20cqw; height: 20cqw; }
.qr :deep(svg) { display: block; width: 100%; height: 100%; }
figcaption { font-size: 1.8cqw; font-weight: 800; }
.room p { margin: 0; }
.ltitle { color: #bed6ff; font-size: 2.2cqw; font-weight: 800; }
.code { color: #ffdb58; font-size: 7.5cqw; font-weight: 900; line-height: 1.05; letter-spacing: .4cqw; text-shadow: 0 .5cqw 0 #8a5a00; overflow-wrap: anywhere; }
.room .chip { display: inline-block; margin-top: 1.4cqw; padding: .7cqw 1.8cqw; border: 1px solid #6e9fe866; border-radius: 999px; background: #071e49d0; font-size: 1.7cqw; font-weight: 700; }
.chip em { font-style: normal; color: #87dfff; }
/* Match the QR/room grid's center after its 5cqw top / 15cqw bottom padding.
   Individual translate keeps centering separate from the floating transform. */
.brand-logo { --float-offset: clamp(3px, .65cqw, 12px); position: absolute; right: 4cqw; top: calc(50% - 5cqw); translate: 0 -50%; width: 38cqw; height: auto; object-fit: contain; pointer-events: none; animation: logo-float v-bind(logoFloatDuration) ease-in-out infinite; will-change: transform; }
.startrow { position: absolute; left: 0; right: 0; bottom: 2.6cqw; display: flex; justify-content: center; gap: 1cqw; margin: 0; padding: 0; list-style: none; }
.slot { position: relative; display: grid; justify-items: center; gap: .3cqw; width: 6.6cqw; font-size: 1.25cqw; font-weight: 700; }
.slot.off { opacity: .45; }
.slot b { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
.av { position: relative; z-index: 1; width: 5.4cqw; height: 5.4cqw; border: .35cqw solid #dbeaff; border-radius: 50%; background: radial-gradient(circle at top, #76a3ed, #23448d); object-fit: contain; }
.av.filled { animation: seat-drop 520ms cubic-bezier(.34, 1.5, .64, 1) backwards, idle-hop 1.6s 520ms ease-in-out infinite alternate; }
.tile { width: 6.6cqw; height: 2.4cqw; margin-top: -1.1cqw; border-radius: var(--cv-radius-sm); background: v-bind(grassTile) center / cover; box-shadow: 0 .5cqw 1cqw #03102f80; }
.empty .av { opacity: .35; border-style: dashed; }
.empty .tile { opacity: .55; }
.empty b { color: #bed6ff; font-weight: 400; }
@keyframes seat-drop { from { opacity: 0; transform: translateY(-3cqw); } }
@keyframes idle-hop { to { transform: translateY(-.6cqw); } }
@keyframes logo-float { 0%, 100% { transform: translate3d(0, var(--float-offset), 0); } 50% { transform: translate3d(0, calc(-1 * var(--float-offset)), 0); } }
@media (prefers-reduced-motion: reduce) {
  .av.filled, .brand-logo { animation: none; }
}
</style>
