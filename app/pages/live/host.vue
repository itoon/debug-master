<template>
  <main class="host-page">
    <div class="wrap">
      <p v-if="!enabled" class="note-card">{{ t('live.unavailable') }}</p>

      <!-- Nothing to join yet: ask for a room code, mint a host key for it, then reopen the page on that room. -->
      <form v-else-if="!code" class="card create-card" @submit.prevent="createRoom">
        <h1>{{ t('live.hostTitle') }}</h1>
        <label for="host-room-code" class="field-label">{{ t('live.enterCode') }}</label>
        <input id="host-room-code" v-model="draft" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="16" />
        <button type="submit" class="cta" :disabled="!draftCode">{{ t('live.createRoom') }}</button>
      </form>

      <template v-else>
        <header class="top">
          <h1>{{ t('live.hostTitle') }} · <em>{{ code }}</em></h1>
          <span class="chip" :class="{ live: phase === 'running' || phase === 'countdown' }">{{ chipText }}</span>
        </header>

        <p v-if="showLinkStatus" class="status warn" role="status">{{ t('live.reconnecting') }}</p>
        <p v-if="denied" class="status denied" role="alert">{{ t('live.hostDenied') }}</p>

        <template v-if="state">
          <!-- Lobby -->
          <template v-if="phase === 'lobby'">
            <fieldset class="card">
              <legend>{{ t('live.chooseMode') }}</legend>
              <div class="modes">
                <label v-for="id in MODES" :key="id" class="mode-option" :class="{ selected: state.mode === id, locked }">
                  <input class="sr-only" type="radio" name="host-mode" :value="id" :checked="state.mode === id" :disabled="locked" @change="send({ type: 'setMode', mode: id })" />
                  <b>{{ id }}</b>
                  <small>{{ t(`mode.${id}`) }}</small>
                </label>
              </div>
            </fieldset>

            <fieldset class="card">
              <legend>{{ t('live.chooseTime') }}</legend>
              <div class="times">
                <label v-for="sec in DURATION_PRESETS_SEC" :key="sec" class="time-option" :class="{ selected: state.durationSec === sec, locked }">
                  <input class="sr-only" type="radio" name="host-time" :value="sec" :checked="state.durationSec === sec" :disabled="locked" @change="send({ type: 'setDuration', durationSec: sec })" />
                  <span>{{ t('live.minutes', { count: sec / 60 }) }}</span>
                </label>
                <div class="time-option custom" :class="{ selected: !isPreset, locked, invalid: customInvalid }">
                  <label for="host-custom-minutes">{{ t('live.custom') }}</label>
                  <span class="custom-entry">
                    <input id="host-custom-minutes" v-model="customText" type="number" inputmode="numeric" :min="MIN_DURATION_SEC / 60" :max="MAX_DURATION_SEC / 60" step="1" :disabled="locked" :aria-invalid="customInvalid"
                      @focus="customFocused = true" @blur="customFocused = false" @change="applyCustom" @keydown.enter.prevent="applyCustom" />
                    <small aria-hidden="true">{{ unitText }}</small>
                  </span>
                </div>
              </div>
            </fieldset>

            <section class="card" aria-labelledby="host-players-title">
              <h2 id="host-players-title">{{ t('live.playersCount', { count: playing.length }) }}</h2>
              <ul class="people">
                <li v-for="p in playing" :key="p.id" :class="{ off: !p.connected }">
                  <img :src="avatarSrc(p.avatarId)" alt="" draggable="false" />
                  <b :title="p.name">{{ p.name }}</b>
                  <span v-if="!p.connected" class="tag">{{ t('live.disconnected') }}</span>
                  <button type="button" class="kick" :disabled="locked" @click="send({ type: 'kick', playerId: p.id })">{{ t('live.kick') }}</button>
                </li>
              </ul>
            </section>

            <section v-if="queued.length" class="card" aria-labelledby="host-queue-title">
              <h2 id="host-queue-title">{{ t('live.waitingQueue', { count: queued.length }) }}</h2>
              <ul class="people">
                <li v-for="p in queued" :key="p.id" :class="{ off: !p.connected }">
                  <img :src="avatarSrc(p.avatarId)" alt="" draggable="false" />
                  <b :title="p.name">{{ p.name }}</b>
                  <span v-if="!p.connected" class="tag">{{ t('live.disconnected') }}</span>
                  <button type="button" class="kick" :disabled="locked" @click="send({ type: 'kick', playerId: p.id })">{{ t('live.kick') }}</button>
                </li>
              </ul>
            </section>

            <button type="button" class="cta" :disabled="locked || !canStart" @click="send({ type: 'start' })">{{ t('live.start', { minutes: minutesText }) }}</button>
          </template>

          <!-- Countdown / running / finished -->
          <template v-else>
            <section v-if="phase !== 'finished'" class="card timer-card">
              <span>{{ t('live.timeLeft') }}</span>
              <strong role="timer" :class="{ low: timeLow }">{{ timeText }}</strong>
            </section>

            <section v-if="podium.length" class="card" aria-labelledby="host-rank-title">
              <h2 id="host-rank-title">{{ t('live.board') }}</h2>
              <ol class="people ranks">
                <li v-for="(p, i) in podium" :key="p.id" :class="[MEDALS[i], { off: !p.connected }]">
                  <span class="n">{{ i + 1 }}</span>
                  <img :src="avatarSrc(p.avatarId)" alt="" draggable="false" />
                  <b :title="p.name">{{ p.name }}</b>
                  <small>{{ p.score.toLocaleString('th-TH') }}</small>
                </li>
              </ol>
            </section>

            <button v-if="phase !== 'finished'" type="button" class="danger" :disabled="locked" @click="askEndEarly">{{ t('live.endEarly') }}</button>
            <button v-else type="button" class="cta" :disabled="locked" @click="send({ type: 'newRound' })">{{ t('live.newRound') }}</button>
          </template>
        </template>

        <section class="card tools">
          <button v-if="hostKey" type="button" class="secondary" :disabled="!connected" @click="copyLink">{{ t('live.copyHostLink') }}</button>
          <p v-if="copied" class="copied" role="status">{{ t('live.copied') }}</p>
          <input v-if="showLinkBox" ref="linkBox" class="link-box" type="text" readonly :value="hostLink" :aria-label="t('live.copyHostLink')" @focus="selectLink" />
          <a class="secondary link" :href="screenHref" target="_blank" rel="noopener">{{ t('live.openScreen') }}</a>
        </section>
      </template>
    </div>

    <dialog ref="dialog" class="confirm-dialog" aria-labelledby="host-end-title" @cancel="dialog?.close()">
      <p id="host-end-title">{{ t('live.endEarlyConfirm') }}</p>
      <div class="dialog-actions">
        <button ref="cancelButton" type="button" class="secondary" autofocus @click="dialog?.close()">{{ t('live.cancel') }}</button>
        <button type="button" class="danger" :disabled="locked" @click="confirmEnd">{{ t('live.confirm') }}</button>
      </div>
    </dialog>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { useGameI18n } from "~/composables/useGameI18n";
import { useLiveConfig, useLiveRoom, type LiveRoom } from "~/composables/useLiveRoom";
import { usePlayerAvatar } from "~/composables/usePlayerAvatar";
import { remainingSec } from "~/utils/live/clock";
import { hostKeyFor, newHostKey, saveHostKey } from "~/utils/live/identity";
import { DURATION_PRESETS_SEC, HOST_KEY_RE, MAX_DURATION_SEC, MIN_DURATION_SEC, normalizeRoomCode } from "~/utils/live/protocol";
import type { HostCommand, ModeId } from "~/utils/live/protocol";

// Keyed by room only: stripping ?key= from the URL must not remount the page (and reopen the socket).
definePageMeta({ key: (route) => String(route.query.room ?? "") });

const MODES: ModeId[] = ["A", "B", "C"];
const MEDALS = ["gold", "silver", "bronze"];

const { t } = useGameI18n();
const { enabled } = useLiveConfig();
const route = useRoute();
const router = useRouter();
const avatarSrc = usePlayerAvatar();
const code = normalizeRoomCode(route.query.room) ?? "";

// The room opens after mount: the host key lives in localStorage, which the server render can't read.
const room = shallowRef<LiveRoom | null>(null);
const hostKey = ref<string | null>(null);
const state = computed(() => room.value?.state.value ?? null);
const connected = computed(() => room.value?.connected.value ?? false);
const denied = computed(() => room.value?.isHost.value === false);
const locked = computed(() => !connected.value || room.value?.isHost.value !== true);
const phase = computed(() => state.value?.phase ?? null);
const playing = computed(() => state.value?.players.filter((p) => p.status === "playing") ?? []);
const queued = computed(() => state.value?.players.filter((p) => p.status === "queued") ?? []);
const podium = computed(() => playing.value.slice(0, 3));
const canStart = computed(() => playing.value.some((p) => p.connected));

function send(cmd: HostCommand): void {
  if (!locked.value) room.value?.send(cmd);
}

// Server-adjusted clock, refreshed four times a second.
const now = ref(Date.now());
const mountedAt = ref(Number.POSITIVE_INFINITY);
const everConnected = ref(false);
let ticker: ReturnType<typeof setInterval> | undefined;
const remaining = computed(() => (phase.value === "countdown" ? (state.value?.durationSec ?? 0) : remainingSec(state.value?.endAt ?? null, room.value?.offset.value ?? 0, now.value)));
const timeLow = computed(() => phase.value === "running" && remaining.value <= 30);
const timeText = computed(() => `${Math.floor(remaining.value / 60).toString().padStart(2, "0")}:${(remaining.value % 60).toString().padStart(2, "0")}`);
// Don't flash "reconnecting" during the first connect; show it after a drop or a slow start.
const showLinkStatus = computed(() => !!room.value && !connected.value && (everConnected.value || now.value - mountedAt.value > 1500));
watch(connected, (up) => { if (up) everConnected.value = true; });

const chipText = computed(() => {
  if (phase.value === "running" || phase.value === "countdown") return timeText.value;
  if (phase.value === "finished") return t("live.resultsTitle");
  return t("live.waitStart");
});

const minutesText = computed(() => {
  const min = (state.value?.durationSec ?? 0) / 60;
  return Number.isInteger(min) ? String(min) : min.toFixed(1);
});

// Duration: presets, or whole minutes 1-15 typed in the custom box. The room's value is the source of truth.
const isPreset = computed(() => DURATION_PRESETS_SEC.includes(state.value?.durationSec ?? 0));
const unitText = computed(() => t("live.minutes", { count: "" }).trim());
const customText = ref("");
const customFocused = ref(false);
const customInvalid = computed(() => customText.value !== "" && parseCustom(customText.value) === null);
function parseCustom(raw: string | number): number | null {
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) return null;
  const min = Number(text);
  return min >= MIN_DURATION_SEC / 60 && min <= MAX_DURATION_SEC / 60 ? min : null;
}
watch(() => state.value?.durationSec, (sec) => {
  if (sec == null || customFocused.value) return;
  customText.value = isPreset.value ? "" : String(Math.round(sec / 60));
}, { immediate: true });
function applyCustom(): void {
  const min = parseCustom(customText.value);
  if (min === null) {
    const sec = state.value?.durationSec;
    customText.value = sec == null || isPreset.value ? "" : String(Math.round(sec / 60));
    return;
  }
  send({ type: "setDuration", durationSec: min * 60 });
}

// End early: native confirm dialog, focus on Cancel.
const dialog = ref<HTMLDialogElement | null>(null);
const cancelButton = ref<HTMLButtonElement | null>(null);
function askEndEarly(): void {
  dialog.value?.showModal();
  cancelButton.value?.focus();
}
function confirmEnd(): void {
  send({ type: "endEarly" });
  dialog.value?.close();
}
// A round that ended some other way (timer, other host) takes the dialog with it.
watch(phase, (next) => { if (next !== "running" && next !== "countdown") dialog.value?.close(); });

// Host link and its copy fallback (clipboard API needs https; LAN http falls back to a selectable field).
const baseURL = useRuntimeConfig().app.baseURL;
const base = baseURL.endsWith("/") ? baseURL : `${baseURL}/`;
const origin = ref("");
const hostLink = computed(() => (hostKey.value ? `${origin.value}${base}live/host?room=${code}&key=${hostKey.value}` : ""));
const screenHref = computed(() => `${base}live/screen?room=${code}`);
const copied = ref(false);
const showLinkBox = ref(false);
const linkBox = ref<HTMLInputElement | null>(null);
let copiedTimer: ReturnType<typeof setTimeout> | undefined;
function selectLink(): void {
  linkBox.value?.select();
}
async function copyLink(): Promise<void> {
  if (!hostLink.value) return;
  let ok = false;
  try {
    await navigator.clipboard.writeText(hostLink.value);
    ok = true;
  } catch {
    showLinkBox.value = true;
    await nextTick();
    linkBox.value?.focus();
    linkBox.value?.select();
    try { ok = document.execCommand("copy"); } catch { /* the selected field is the fallback */ }
  }
  copied.value = ok;
  clearTimeout(copiedTimer);
  if (ok) copiedTimer = setTimeout(() => { copied.value = false; }, 2500);
}

// "Create room" form.
const draft = ref("");
const draftCode = computed(() => normalizeRoomCode(draft.value));
function createRoom(): void {
  const next = draftCode.value;
  if (!next) return;
  if (!hostKeyFor(next)) saveHostKey(next, newHostKey());
  void navigateTo({ query: { room: next } });
}

onMounted(() => {
  mountedAt.value = Date.now();
  now.value = Date.now();
  ticker = setInterval(() => { now.value = Date.now(); }, 250);
  origin.value = location.origin;
  if (!enabled || !code) return;

  // A link carries the key once: keep it on this device, then take it out of the address bar.
  const fromUrl = typeof route.query.key === "string" && HOST_KEY_RE.test(route.query.key) ? route.query.key : null;
  if (fromUrl) saveHostKey(code, fromUrl);
  if (route.query.key !== undefined) void router.replace({ query: { room: code } });
  hostKey.value = fromUrl ?? hostKeyFor(code);
  // Without a key the page still joins as a host connection; the server answers host:false and the page shows live.hostDenied.
  room.value = useLiveRoom({ code, role: "host", key: hostKey.value ?? undefined, hello: () => ({ type: "hello" }) });
});
onBeforeUnmount(() => {
  clearInterval(ticker);
  clearTimeout(copiedTimer);
  room.value?.close();
});
</script>

<style scoped>
.host-page { position: fixed; inset: 0; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; background: var(--cv-navy-900) url("~/assets/bg.png") center bottom / cover no-repeat; color: #fff; font-family: var(--cv-font); }
.wrap { display: grid; gap: 12px; width: 100%; max-width: 520px; margin: 0 auto; padding: 14px 14px max(28px, env(safe-area-inset-bottom)); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
button, input { font: inherit; }
button { cursor: pointer; }

.top { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 48px; }
.top h1 { margin: 0; font-size: 1.05rem; font-weight: 800; }
.top em { font-style: normal; color: #ffdb58; }
.chip { flex: none; padding: 8px 14px; border: 1px solid #6e9fe840; border-radius: 999px; background: #071e49b8; color: #bed6ff; font-size: .9rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.chip.live { color: #87dfff; }

.status { margin: 0; padding: 10px 14px; border-radius: var(--cv-radius); font-size: .95rem; font-weight: 700; }
.status.warn { border: 1px solid #ff8a8a99; background: #4a1b33e6; color: #ffd6d6; }
.status.denied { border: 1px solid #ffdb5899; background: #4a3a0fe6; color: #ffe9a6; }
.note-card { margin: 0; padding: 16px; border-radius: var(--cv-radius-lg); background: #fff; color: var(--cv-heading); font-weight: 700; }

/* White cards, like PlayerSetupDialog's popup surface in the approved screen. */
.card { display: grid; gap: 10px; min-width: 0; margin: 0; padding: 14px; border: 0; border-radius: var(--cv-radius-lg); background: #fff; color: var(--cv-heading); box-shadow: var(--cv-shadow-window); }
.card h1, .card h2, .card legend { margin: 0; padding: 0; color: var(--cv-heading); font-size: 1rem; font-weight: 800; }
.card legend { float: left; width: 100%; margin-bottom: 10px; }
.card legend + * { clear: both; }
.field-label { color: #5b6474; font-size: .9rem; font-weight: 700; }

.modes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.mode-option { display: grid; place-items: center; align-content: center; min-height: 72px; padding: 8px 4px; border: 2px solid var(--cv-border); border-radius: var(--cv-radius); background: #fff; cursor: pointer; text-align: center; }
.mode-option b { font-size: 1.5rem; font-weight: 900; line-height: 1.1; }
.mode-option small { color: #5b6474; font-size: .75rem; font-weight: 700; }
.mode-option.selected { border-color: var(--cv-blue); background: var(--cv-blue-soft); color: #1557c0; }
.mode-option.selected small { color: #1557c0; }

.times { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.time-option { display: grid; place-items: center; min-height: 52px; padding: 6px; border: 2px solid var(--cv-border); border-radius: var(--cv-radius); background: #fff; font-weight: 800; text-align: center; cursor: pointer; }
.time-option.selected { border-color: var(--cv-blue); background: var(--cv-blue-soft); color: #1557c0; }
.time-option.custom { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 12px; cursor: default; }
.time-option.custom.invalid { border-color: #d92d20; background: #fff5f5; }
.custom-entry { display: inline-flex; align-items: center; gap: 8px; }
.custom-entry input { width: 84px; min-height: 48px; padding: 0 10px; border: 2px solid var(--cv-border); border-radius: var(--cv-radius); background: #fff; color: var(--cv-heading); font-size: 1.1rem; font-weight: 800; text-align: center; }
.custom-entry small { color: #5b6474; font-weight: 700; }
.mode-option:has(input:focus-visible), .time-option:has(input:focus-visible) { outline: 3px solid var(--cv-blue); outline-offset: 2px; }
.locked { opacity: .5; cursor: not-allowed; }

.people { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
.people li { display: flex; align-items: center; gap: 10px; min-height: 56px; padding: 4px 0; border-bottom: 1px solid #eef1f4; }
.people li:last-child { border-bottom: 0; }
.people img { flex: none; width: 40px; height: 40px; border: 1px solid #8ba8de; border-radius: 50%; background: #d9e8ff; object-fit: contain; }
.people b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
.people li.off { color: #6b7280; }
.people li.off img { filter: grayscale(1); opacity: .6; }
.tag { flex: none; padding: 3px 10px; border-radius: 999px; background: #eef1f4; color: #6b7280; font-size: .8rem; font-weight: 800; }
.kick { flex: none; min-width: 64px; min-height: 48px; padding: 0 14px; border: 1px solid #f2b8b8; border-radius: 10px; background: #fff5f5; color: #b42318; font-weight: 800; }
.ranks .n { flex: none; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: #eef1f4; font-size: .9rem; font-weight: 800; }
.ranks .gold .n { background: #ffdc53; color: #112455; }
.ranks .silver .n { background: #c1d8ff; color: #112455; }
.ranks .bronze .n { background: #efb387; color: #112455; }
.ranks small { flex: none; color: #b07900; font-size: 1.05rem; font-weight: 900; font-variant-numeric: tabular-nums; }

.timer-card { justify-items: center; padding: 18px 14px; text-align: center; }
.timer-card span { color: #5b6474; font-weight: 700; }
.timer-card strong { font-size: 3.4rem; font-weight: 900; line-height: 1; font-variant-numeric: tabular-nums; }
.timer-card strong.low { color: #d92d20; }

.cta, .danger, .secondary { display: inline-flex; align-items: center; justify-content: center; min-height: 56px; padding: 12px 20px; border: 0; border-radius: 14px; font-size: 1.1rem; font-weight: 900; text-decoration: none; }
.cta { background: var(--cv-cta); color: #3b2a00; box-shadow: 0 4px 0 #b86e0e; }
.cta:not(:disabled):active { transform: translateY(3px); box-shadow: 0 1px 0 #b86e0e; }
.danger { border: 2px solid #f2b8b8; background: #fff5f5; color: #b42318; box-shadow: 0 4px 0 #d9a3a0; }
.secondary { min-height: 48px; border: 2px solid var(--cv-border); background: #fff; color: var(--cv-heading); font-size: 1rem; }
.cta:disabled, .danger:disabled, .secondary:disabled, .kick:disabled { opacity: .5; cursor: not-allowed; }
.cta:disabled { opacity: 1; background: #cfd5dd; box-shadow: 0 4px 0 #a9b1bd; color: #5b6474; }
button:focus-visible, a:focus-visible, input:focus-visible { outline: 3px solid var(--cv-blue); outline-offset: 2px; }

.create-card input { min-height: 56px; padding: 0 14px; border: 2px solid var(--cv-border); border-radius: var(--cv-radius); background: #fff; color: var(--cv-heading); font-size: 1.2rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }

.tools { gap: 8px; }
.copied { margin: 0; color: #067647; font-weight: 800; text-align: center; }
.link-box { min-height: 48px; width: 100%; padding: 0 10px; border: 2px solid var(--cv-border); border-radius: var(--cv-radius); background: #f8fafc; color: var(--cv-heading); font-size: .85rem; }

.confirm-dialog { box-sizing: border-box; width: min(360px, calc(100vw - 32px)); padding: 20px; border: 0; border-radius: var(--cv-radius-xl); background: #fff; color: var(--cv-heading); font-family: var(--cv-font); box-shadow: var(--cv-shadow-window); }
.confirm-dialog::backdrop { background: rgba(3, 12, 40, .78); backdrop-filter: blur(5px); }
.confirm-dialog p { margin: 0 0 16px; font-size: 1.1rem; font-weight: 800; line-height: 1.4; }
.dialog-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.dialog-actions .danger { min-height: 48px; font-size: 1rem; }

@media (prefers-reduced-motion: reduce) {
  .cta:not(:disabled):active { transform: none; }
}
</style>
