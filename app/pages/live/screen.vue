<template>
  <main class="live-screen" @pointerdown="unlockOnce">
    <div class="stage" :class="{ 'has-queue': queued.length > 0 }">
      <p v-if="!enabled" class="screen-note">{{ t('live.unavailable') }}</p>

      <form v-else-if="!code" class="code-form" @submit.prevent="openRoom">
        <label for="live-screen-code">{{ t('live.enterCode') }}</label>
        <div class="code-row">
          <input id="live-screen-code" v-model="draft" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="16" />
          <button type="submit" :disabled="!draftCode">{{ t('live.open') }}</button>
        </div>
      </form>

      <template v-else-if="state">
        <template v-if="phase === 'lobby' || phase === 'countdown'">
          <LobbyStage :code="code" :join-url="joinUrl" :mode="state.mode" :duration-sec="state.durationSec" :players="playing" />
          <div v-if="phase === 'countdown' && countdown > 0" class="countdown" aria-live="assertive">
            <span :key="countdown">{{ countdown }}</span>
          </div>
        </template>

        <template v-else-if="phase === 'running'">
          <header class="hud">
            <p class="brand"><i aria-hidden="true" />{{ t('live.brand') }} · <em>{{ code }}</em></p>
            <div class="metrics">
              <div class="metric mode"><span>{{ t('live.mode') }}</span><strong>{{ modeLabel }}</strong></div>
              <div class="metric time" :class="{ 'time-low': timeLow }" role="timer"><span>{{ t('live.timeLeft') }}</span><strong :key="timeLow ? timeText : 'steady'">{{ timeText }}</strong></div>
              <div class="metric"><span>{{ t('live.players') }}</span><strong>{{ playing.length }}</strong></div>
            </div>
          </header>
          <RaceLanes class="race" :players="lanePlayers" :max="max" />
          <LiveBoard class="board" :players="playing" />
        </template>

        <LiveResults v-else :players="playing" :mode="state.mode" />

        <div v-if="phase === 'running' || phase === 'finished'" class="queue-slot">
          <QueueStrip :players="queued" />
        </div>
      </template>

      <p v-else class="screen-note brand"><i aria-hidden="true" />{{ t('live.brand') }} · <em>{{ code }}</em></p>

      <p v-if="code && showLinkStatus" class="link-status" role="status">{{ t('live.reconnecting') }}</p>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import LiveBoard from "~/components/live/LiveBoard.vue";
import LiveResults from "~/components/live/LiveResults.vue";
import LobbyStage from "~/components/live/LobbyStage.vue";
import QueueStrip from "~/components/live/QueueStrip.vue";
import RaceLanes from "~/components/live/RaceLanes.vue";
import { useGameAudio } from "~/composables/useGameAudio";
import { useGameI18n } from "~/composables/useGameI18n";
import { useLiveConfig, useLiveRoom } from "~/composables/useLiveRoom";
import { countdownSec, remainingSec } from "~/utils/live/clock";
import { normalizeRoomCode } from "~/utils/live/protocol";
import { trackMax } from "~/utils/live/track";

// A new ?room= remounts the page, so each mount owns exactly one room socket.
definePageMeta({ key: (route) => route.fullPath });

const { t } = useGameI18n();
const { unlockAudio, playSound } = useGameAudio();
const { enabled } = useLiveConfig();
const route = useRoute();
const code = normalizeRoomCode(route.query.room) ?? "";

const room = code ? useLiveRoom({ code, role: "screen", hello: () => ({ type: "hello" }) }) : null;
const state = computed(() => room?.state.value ?? null);
const connected = computed(() => room?.connected.value ?? false);
const phase = computed(() => state.value?.phase ?? null);
const playing = computed(() => state.value?.players.filter((p) => p.status === "playing") ?? []);
const queued = computed(() => state.value?.players.filter((p) => p.status === "queued") ?? []);
const lanePlayers = computed(() => [...playing.value].sort((a, b) => (a.lane ?? 99) - (b.lane ?? 99)));
const max = computed(() => trackMax(playing.value.reduce((best, p) => Math.max(best, p.score), 0)));
const modeLabel = computed(() => (state.value ? `${state.value.mode} · ${t(`difficulty.${state.value.mode}`)}` : ""));

// Server-adjusted clock, refreshed four times a second.
const now = ref(Date.now());
const mountedAt = ref(Number.POSITIVE_INFINITY);
const everConnected = ref(false);
let ticker: ReturnType<typeof setInterval> | undefined;
const offset = computed(() => room?.offset.value ?? 0);
const remaining = computed(() => remainingSec(state.value?.endAt ?? null, offset.value, now.value));
const countdown = computed(() => countdownSec(state.value?.startAt ?? null, offset.value, now.value));
const timeLow = computed(() => remaining.value <= 30);
const timeText = computed(() => `${Math.floor(remaining.value / 60).toString().padStart(2, "0")}:${(remaining.value % 60).toString().padStart(2, "0")}`);
// Don't flash "reconnecting" during the first connect; show it after a drop or a slow start.
const showLinkStatus = computed(() => !connected.value && (everConnected.value || now.value - mountedAt.value > 1500));
watch(connected, (up) => { if (up) everConnected.value = true; });

const joinUrl = ref("");
const baseURL = useRuntimeConfig().app.baseURL;
onMounted(() => {
  mountedAt.value = Date.now();
  now.value = Date.now();
  ticker = setInterval(() => { now.value = Date.now(); }, 250);
  if (code) joinUrl.value = `${location.origin}${baseURL}?room=${code}`;
});
onBeforeUnmount(() => clearInterval(ticker));

// One completion cue when a round ends while the screen is watching (not when it opens on results).
watch(phase, (next, previous) => {
  if (next === "finished" && previous != null && previous !== "finished") playSound("complete");
});

// Autoplay needs a gesture: the first click anywhere on the screen unlocks audio.
let unlocked = false;
function unlockOnce(): void {
  if (unlocked) return;
  unlocked = true;
  unlockAudio();
}

const draft = ref("");
const draftCode = computed(() => normalizeRoomCode(draft.value));
function openRoom(): void {
  if (draftCode.value) void navigateTo({ query: { ...route.query, room: draftCode.value } });
}
</script>

<style scoped>
.live-screen { position: fixed; inset: 0; display: grid; place-items: center; overflow: hidden; background: var(--cv-navy-900) url("~/assets/bg.png") center bottom / cover no-repeat; color: #fff; }
/* A 16:9 stage that fills the viewport; everything inside scales with its width (cqw), like the mockup. */
.stage { position: relative; width: min(100vw, calc(100dvh * 16 / 9)); aspect-ratio: 16 / 9; overflow: hidden; container-type: inline-size; }

.hud { position: absolute; top: 2.2cqw; left: 2.4cqw; right: 2.4cqw; display: flex; align-items: center; justify-content: space-between; gap: 1.5cqw; }
.brand { display: flex; align-items: center; gap: .8cqw; margin: 0; padding: .6cqw 1.4cqw .6cqw .7cqw; border-radius: 999px; background: #071e4980; font-weight: 800; font-size: 1.5cqw; }
.brand i { width: 1.6cqw; height: 1.6cqw; border-radius: 50%; background: var(--cv-red); box-shadow: 0 0 1.2cqw #ff6b6baa; }
.brand em { font-style: normal; color: #ffdb58; }
/* Same glass metric boxes as GameHud. */
.metrics { display: flex; gap: .8cqw; font-variant-numeric: tabular-nums; }
.metric { display: grid; align-content: center; gap: .3cqw; min-width: 9cqw; padding: .7cqw 1.4cqw; border: 1px solid #6e9fe840; border-radius: var(--cv-radius); background: #071e49b8; }
.metric > span { color: #bed6ff; font-size: 1.1cqw; line-height: 1.2; }
.metric strong { color: #fff; font-size: 2.6cqw; line-height: 1; }
.metric.time strong { font-size: 3.6cqw; }
.metric.mode strong { color: #87dfff; font-size: 2cqw; }
.time-low { border-color: #ff8a8a99; background: #4a1b33cc; }
.metric.time-low strong { display: inline-block; color: #ffb3b3; animation: time-tick 1s ease-out; }
@keyframes time-tick { 0% { transform: scale(1.18); color: #fff; } 40% { transform: scale(1); } }

.race { position: absolute; left: 2.4cqw; right: 27cqw; top: 9.5cqw; bottom: 2.4cqw; }
.has-queue .race { bottom: 6.6cqw; }
.board { position: absolute; right: 2.4cqw; top: 9.5cqw; bottom: 2.4cqw; width: 23cqw; }
.queue-slot { position: absolute; left: 2.4cqw; right: 27cqw; bottom: 1.4cqw; display: flex; }

.countdown { position: absolute; inset: 0; z-index: 5; display: grid; place-items: center; background: #04122ab3; }
.countdown span { color: #ffdb58; font-size: 24cqw; font-weight: 900; line-height: 1; text-shadow: 0 1.4cqw 0 #8a5a00; animation: count-pop 900ms cubic-bezier(.34, 1.5, .64, 1) both; }
@keyframes count-pop { 0% { opacity: 0; transform: scale(.4); } 30% { opacity: 1; transform: scale(1.08); } 60% { transform: scale(1); } }

.screen-note { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); margin: 0; font-size: 2cqw; font-weight: 800; white-space: nowrap; }
.screen-note.brand { font-size: 2.4cqw; padding: 1cqw 2.4cqw 1cqw 1.2cqw; }
.link-status { position: absolute; top: 1cqw; left: 50%; z-index: 6; transform: translateX(-50%); margin: 0; padding: .5cqw 1.4cqw; border: 1px solid #ff8a8a99; border-radius: 999px; background: #4a1b33e6; color: #ffd6d6; font-size: 1.3cqw; font-weight: 700; }

.code-form { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: grid; gap: 1.2cqw; width: 38cqw; padding: 2.4cqw; border-radius: var(--cv-radius-xl); background: #fff; color: var(--cv-heading); box-shadow: var(--cv-shadow-window); }
.code-form label { font-size: 2cqw; font-weight: 800; }
.code-row { display: flex; gap: .8cqw; }
.code-row input { flex: 1; min-width: 0; min-height: 48px; padding: 0 1.2cqw; border: 2px solid var(--cv-border); border-radius: var(--cv-radius); color: var(--cv-heading); font: inherit; font-size: max(16px, 2cqw); font-weight: 800; letter-spacing: .2cqw; text-transform: uppercase; }
.code-row input:focus-visible { outline: 3px solid var(--cv-blue); outline-offset: 1px; border-color: var(--cv-blue); }
.code-row button { min-height: 48px; padding: 0 2cqw; border: 0; border-radius: var(--cv-radius); background: var(--cv-cta); color: #3b2a00; font: inherit; font-size: max(16px, 1.6cqw); font-weight: 900; box-shadow: 0 4px 0 #b86e0e; cursor: pointer; }
.code-row button:disabled { opacity: .5; cursor: not-allowed; }
.code-row button:focus-visible { outline: 3px solid var(--cv-blue); outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  .metric.time-low strong, .countdown span { animation: none; }
}
</style>
