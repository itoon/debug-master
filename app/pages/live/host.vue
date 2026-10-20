<template>
  <main class="host-page game-scrollbar">
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
          <div class="brand">
            <img class="brand-logo" :src="debugMasterLogo" width="106" height="72" alt="Debug Master" draggable="false" />
            <div class="brand-copy">
              <p class="eyebrow">{{ t('live.hostControl') }}</p>
              <div class="room-heading">
                <h1>{{ t('live.hostRoomLabel') }} <em>{{ code }}</em></h1>
                <span class="chip" :class="{ live: phase === 'running' || phase === 'countdown' }">{{ chipText }}</span>
              </div>
            </div>
          </div>
          <nav class="tools" :aria-label="t('live.hostTools')">
            <button v-if="hostKey" type="button" class="secondary" :disabled="!connected" @click="copyLink"><HostIcon name="link" />{{ t('live.copyHostLink') }}</button>
            <a class="secondary screen-link" :href="screenHref" target="_blank" rel="noopener"><HostIcon name="screen" />{{ t('live.openScreen') }}</a>
          </nav>
        </header>

        <div v-if="copied || showLinkBox" class="copy-feedback">
          <p v-if="copied" class="copied" role="status">{{ t('live.copied') }}</p>
          <input v-if="showLinkBox" ref="linkBox" class="link-box" type="text" readonly :value="hostLink" :aria-label="t('live.copyHostLink')" @focus="selectLink" />
        </div>
        <p v-if="showLinkStatus" class="status warn" role="status">{{ t('live.reconnecting') }}</p>
        <p v-if="denied" class="status denied" role="alert">{{ t('live.hostDenied') }}</p>
        <p v-if="!state && !showLinkStatus" class="status loading" role="status">{{ t('live.hostLoading') }}</p>

        <template v-if="state">
          <!-- Lobby -->
          <template v-if="phase === 'lobby'">
            <div class="lobby-layout">
              <div class="round-settings">
                <fieldset class="card">
                  <legend><span class="legend-title"><HostIcon name="gamepad" />{{ t('live.chooseMode') }}</span></legend>
                  <div class="modes">
                    <label v-for="id in MODES" :key="id" class="mode-option" :class="{ selected: state.mode === id, locked }">
                      <input class="sr-only" type="radio" name="host-mode" :value="id" :checked="state.mode === id" :disabled="locked" @change="send({ type: 'setMode', mode: id })" />
                      <HostIcon class="mode-icon" :name="id === 'A' ? 'rocket' : id === 'B' ? 'orbit' : 'trophy'" />
                      <b>{{ t(`mode.${id}`) }}</b>
                      <small>{{ id }} · {{ t(`difficulty.${id}`) }}</small>
                      <span v-if="state.mode === id" class="selection-check" aria-hidden="true">✓</span>
                    </label>
                  </div>
                </fieldset>

                <fieldset class="card">
                  <legend><span class="legend-title"><HostIcon name="timer" />{{ t('live.chooseTime') }}</span></legend>
                  <div class="times">
                    <label v-for="sec in DURATION_PRESETS_SEC" :key="sec" class="time-option" :class="{ selected: state.durationSec === sec, locked }">
                      <input class="sr-only" type="radio" name="host-time" :value="sec" :checked="state.durationSec === sec" :disabled="locked" @change="send({ type: 'setDuration', durationSec: sec })" />
                      <span class="time-value">{{ sec / 60 }}</span><small>{{ unitText }}</small>
                    </label>
                    <div class="time-option custom" :class="{ selected: !isPreset, locked, invalid: customInvalid }">
                      <label for="host-custom-minutes">{{ t('live.custom') }}<small id="host-time-help">{{ t('live.hostTimeRange', { min: MIN_DURATION_SEC / 60, max: MAX_DURATION_SEC / 60 }) }}</small></label>
                      <span class="custom-entry">
                        <input id="host-custom-minutes" v-model="customText" type="number" inputmode="numeric" :min="MIN_DURATION_SEC / 60" :max="MAX_DURATION_SEC / 60" step="1" :disabled="locked" :aria-invalid="customInvalid" aria-describedby="host-time-help"
                          @focus="customFocused = true" @blur="customFocused = false" @change="applyCustom" @keydown.enter.prevent="applyCustom" />
                        <small aria-hidden="true">{{ unitText }}</small>
                      </span>
                    </div>
                  </div>
                </fieldset>
              </div>
              <div class="room-side">
                <section class="card roster-card" aria-labelledby="host-players-title">
                  <div class="panel-heading">
                    <h2 id="host-players-title"><HostIcon name="users" />{{ t('live.hostPlayers') }}</h2>
                    <span class="capacity" :aria-label="t('live.playersCount', { count: playing.length })">{{ playing.length }} / {{ MAX_PLAYERS }}</span>
                  </div>
                  <p class="roster-caption">{{ t('live.hostPlayerListHint') }}</p>
                  <div v-if="!playing.length" class="empty-players">
                    <img :src="avatarSrc()" alt="" width="82" height="82" draggable="false" />
                    <h3>{{ t('live.hostNoPlayers') }}</h3>
                    <p>{{ t('live.hostEmptyHelp') }}</p>
                  </div>
                  <ul v-else class="people game-scrollbar">
                    <li v-for="p in playing" :key="p.id" :class="{ off: !p.connected }">
                      <img :src="avatarSrc(p.avatarId)" alt="" draggable="false" />
                      <div class="person-info">
                        <b :title="p.name">{{ p.name }}</b>
                        <small :class="{ offline: !p.connected }"><i aria-hidden="true" />{{ t(p.connected ? 'live.hostPlayerReady' : 'live.disconnected') }}</small>
                      </div>
                      <button type="button" class="kick" :disabled="locked" :aria-label="t('live.hostRemovePlayer', { name: p.name })" :title="t('live.kick')" @click="send({ type: 'kick', playerId: p.id })"><HostIcon name="logout" /></button>
                    </li>
                  </ul>
                  <p class="roster-foot"><HostIcon name="scan" />{{ t('live.hostJoinHelp', { max: MAX_PLAYERS }) }}</p>
                </section>

                <section v-if="queued.length" class="card queue-card" aria-labelledby="host-queue-title">
                  <h2 id="host-queue-title">{{ t('live.waitingQueue', { count: queued.length }) }}</h2>
                  <ul class="people game-scrollbar">
                    <li v-for="p in queued" :key="p.id" :class="{ off: !p.connected }">
                      <img :src="avatarSrc(p.avatarId)" alt="" draggable="false" />
                      <div class="person-info">
                        <b :title="p.name">{{ p.name }}</b>
                        <small v-if="!p.connected" class="offline">{{ t('live.disconnected') }}</small>
                      </div>
                      <button type="button" class="kick" :disabled="locked" :aria-label="t('live.hostRemovePlayer', { name: p.name })" :title="t('live.kick')" @click="send({ type: 'kick', playerId: p.id })"><HostIcon name="logout" /></button>
                    </li>
                  </ul>
                </section>
              </div>
            </div>
            <div class="launch-bar">
              <div>
                <p class="launch-status" :class="{ ready: !locked && canStart }">{{ locked ? t(denied ? 'live.hostDenied' : 'live.reconnecting') : canStart ? t('live.hostReadyCount', { count: onlinePlayers }) : t('live.hostNeedPlayer') }}</p>
                <p class="round-summary">{{ t('live.roundInfo', { mode: `${state.mode} · ${t(`mode.${state.mode}`)}`, minutes: minutesText }) }}</p>
              </div>
              <button type="button" class="cta" :disabled="locked || !canStart" @click="send({ type: 'start' })">{{ t('live.start', { minutes: minutesText }) }}</button>
            </div>
          </template>

          <!-- Countdown / running / finished -->
          <template v-else>
            <div class="round-layout" :class="{ finished: phase === 'finished' }">
              <section v-if="phase !== 'finished'" class="card timer-card">
                <span>{{ t('live.timeLeft') }}</span>
                <strong role="timer" :class="{ low: timeLow }">{{ timeText }}</strong>
              </section>

              <section v-if="podium.length" class="card ranking-card" aria-labelledby="host-rank-title">
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
            </div>
            <div class="round-actions">
              <button v-if="phase !== 'finished'" type="button" class="danger" :disabled="locked" @click="askEndEarly">{{ t('live.endEarly') }}</button>
              <button v-else type="button" class="cta" :disabled="locked" @click="send({ type: 'newRound' })">{{ t('live.newRound') }}</button>
            </div>
          </template>
        </template>
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
import HostIcon from "~/components/live/HostIcon.vue";
import debugMasterLogo from "~/assets/brand/logo-sleep-display.png";
import { useGameI18n } from "~/composables/useGameI18n";
import { useLiveConfig, useLiveRoom, type LiveRoom } from "~/composables/useLiveRoom";
import { usePlayerAvatar } from "~/composables/usePlayerAvatar";
import { remainingSec } from "~/utils/live/clock";
import { hostKeyFor, newHostKey, saveHostKey } from "~/utils/live/identity";
import { DURATION_PRESETS_SEC, HOST_KEY_RE, MAX_DURATION_SEC, MIN_DURATION_SEC, MAX_PLAYERS, normalizeRoomCode } from "~/utils/live/protocol";
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
const onlinePlayers = computed(() => playing.value.filter((p) => p.connected).length);

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
.host-page {
  --host-panel: #1c427e;
  --host-panel-deep: #12315e;
  --host-border: #7097d6;
  --host-muted: #d3e3ff;
  position: fixed; inset: 0; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain;
  background: linear-gradient(180deg, #061a3814, #061a3838), url("~/assets/bg.png") center bottom / cover no-repeat var(--cv-navy-900);
  color: var(--cv-on-dark); font-family: var(--cv-font);
}
.wrap { display: grid; gap: 18px; width: 100%; max-width: 1160px; margin: 0 auto; padding: 28px 28px max(32px, env(safe-area-inset-bottom)); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
button, input { font: inherit; }
button, a { -webkit-tap-highlight-color: transparent; }
button { cursor: pointer; }
svg { flex: none; width: 20px; height: 20px; }

.top { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-bottom: 6px; }
.brand { display: flex; align-items: center; gap: 20px; min-width: 0; }
.brand-logo { flex: none; width: 106px; height: 72px; object-fit: contain; }
.brand-copy { min-width: 0; padding-left: 20px; border-left: 1px solid var(--host-border); }
.eyebrow { margin: 0 0 3px; color: var(--host-muted); font-size: .75rem; font-weight: 700; }
.room-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.top h1 { margin: 0; font-size: 1.75rem; font-weight: 900; line-height: 1.35; overflow-wrap: anywhere; }
.top em { font-style: normal; color: var(--cv-yellow); }
.chip { flex: none; padding: 5px 10px; border: 1px solid var(--host-border); border-radius: 999px; background: var(--host-panel-deep); color: var(--host-muted); font-size: .7rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.chip.live { border-color: var(--cv-green); color: var(--cv-green); }
.tools { flex: none; display: flex; flex-wrap: wrap; gap: 8px; }
.tools .secondary { gap: 8px; min-height: 44px; padding: 9px 12px; font-size: .8rem; }
.tools .screen-link { border-color: var(--cv-blue-light); background: #1f75ff30; }

.status, .note-card { margin: 0; padding: 12px 16px; border: 1px solid var(--host-border); border-radius: var(--cv-radius); background: var(--host-panel-deep); color: var(--host-muted); font-size: .875rem; font-weight: 700; }
.status.warn { border-color: #ff6b6b80; background: #361a35; color: #ffd6d6; }
.status.denied { border-color: #fdca3f80; background: #342d1c; color: #ffe9a6; }

.lobby-layout { display: grid; grid-template-columns: minmax(0, 1.12fr) minmax(0, 1fr); gap: 18px; }
.round-settings { display: grid; align-content: start; gap: 16px; min-width: 0; }
.room-side { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.card { display: grid; align-content: start; gap: 14px; min-width: 0; margin: 0; padding: 22px; border: 1px solid var(--host-border); border-radius: 18px; background: var(--host-panel); box-shadow: 0 12px 32px #04122a30; }
.card h1, .card h2, .card legend { margin: 0; padding: 0; color: var(--cv-on-dark); font-size: 1rem; font-weight: 800; }
.card legend { float: left; width: 100%; margin-bottom: 18px; }
.card legend + * { clear: both; }
.legend-title, .panel-heading h2 { display: inline-flex; align-items: center; gap: 9px; }
.legend-title svg, .panel-heading svg { color: var(--cv-blue-light); }
.field-label { color: var(--host-muted); font-size: .875rem; font-weight: 700; }

.modes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.mode-option { position: relative; display: grid; place-items: center; align-content: center; gap: 8px; min-height: 126px; padding: 14px 4px; border: 2px solid var(--host-border); border-radius: var(--cv-radius); background: var(--host-panel-deep); cursor: pointer; text-align: center; transition: border-color .15s, background .15s; }
.mode-option .mode-icon { width: 28px; height: 28px; color: var(--cv-blue-light); }
.mode-option b { font-size: .85rem; font-weight: 800; line-height: 1.25; }
.mode-option small { color: var(--host-muted); font-size: .7rem; font-weight: 700; }
.mode-option.selected { border-color: var(--cv-yellow); background: #fdca3f0d; }
.mode-option.selected .mode-icon, .mode-option.selected small { color: var(--cv-yellow); }
.selection-check { position: absolute; top: 7px; right: 7px; display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: var(--cv-yellow); color: var(--cv-navy-900); font-size: .7rem; font-weight: 900; }

.times { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.time-option { display: flex; align-items: baseline; justify-content: center; gap: 5px; min-height: 60px; padding: 10px 6px; border: 2px solid var(--host-border); border-radius: var(--cv-radius); background: var(--host-panel-deep); font-weight: 800; text-align: center; cursor: pointer; transition: border-color .15s, background .15s; }
.time-value { font-size: 1.5rem; line-height: 1.3; font-variant-numeric: tabular-nums; }
.time-option small { color: var(--host-muted); font-size: .75rem; font-weight: 700; }
/* Dark text belongs only to the yellow preset, never the navy custom row. */
.time-option.selected:not(.custom) { border-color: var(--cv-yellow); background: var(--cv-yellow); color: var(--cv-navy-900); }
.time-option.selected:not(.custom) small { color: var(--cv-navy-900); }
.time-option.custom { grid-column: 1 / -1; align-items: center; justify-content: space-between; gap: 10px; min-height: 64px; margin-top: 4px; padding: 14px 0 0; border: 0; border-top: 1px solid var(--host-border); border-radius: 0; background: transparent; color: var(--cv-on-dark); text-align: left; cursor: default; }
.custom label { display: grid; gap: 2px; font-size: .875rem; }
.custom label small { color: var(--host-muted); font-size: .7rem; font-weight: 400; }
.custom.selected .custom-entry input { border-color: var(--cv-yellow); }
.custom.invalid .custom-entry input { border-color: var(--cv-red); }
.custom-entry { flex: none; display: inline-flex; align-items: center; gap: 8px; }
.custom-entry input { width: 68px; min-height: 44px; padding: 0 6px; border: 1px solid var(--host-border); border-radius: 10px; background: var(--host-panel-deep); color: var(--cv-on-dark); font-size: 1rem; font-weight: 800; text-align: center; }
.mode-option:has(input:focus-visible), .time-option:has(input:focus-visible) { outline: 3px solid var(--cv-yellow); outline-offset: 3px; }
.locked { opacity: .6; cursor: not-allowed; }

.roster-card { flex: 1; display: flex; flex-direction: column; gap: 14px; }
.panel-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.capacity { padding: 4px 10px; border: 1px solid var(--host-border); border-radius: 999px; background: var(--host-panel-deep); color: var(--cv-blue-light); font-size: .8rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.roster-caption { margin: -8px 0 0; color: var(--host-muted); font-size: .75rem; }
.empty-players { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; min-height: 230px; padding: 24px 8px; text-align: center; }
.empty-players img { width: 82px; height: 82px; object-fit: contain; }
.empty-players h3 { margin: 0; font-size: 1rem; }
.empty-players p { max-width: 260px; margin: 0; color: var(--host-muted); font-size: .8rem; line-height: 1.6; }
.people { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.roster-card .people, .queue-card .people { max-height: 288px; overflow-y: auto; scrollbar-gutter: stable; }
.queue-card .people { max-height: 168px; }
.people li { display: flex; align-items: center; gap: 10px; min-height: 64px; padding: 8px 10px; border: 1px solid var(--host-border); border-radius: var(--cv-radius); background: var(--host-panel-deep); }
.people img { flex: none; width: 40px; height: 40px; border: 1px solid var(--cv-blue-light); border-radius: 50%; background: #d9e8ff; object-fit: contain; }
.people b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .875rem; font-weight: 700; }
.person-info { flex: 1; display: grid; gap: 3px; min-width: 0; }
.person-info small { display: flex; align-items: center; gap: 5px; color: var(--cv-green); font-size: .7rem; }
.person-info i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.people li.off, .person-info small.offline { color: var(--host-muted); }
.people li.off img { filter: grayscale(1); opacity: .6; }
.kick { flex: none; display: grid; place-items: center; width: 44px; min-height: 44px; padding: 0; border: 1px solid #ff6b6b45; border-radius: 10px; background: #ff6b6b10; color: #ffadad; }
.kick svg { width: 18px; height: 18px; }
.roster-foot { display: flex; align-items: center; gap: 8px; margin: auto 0 0; padding-top: 14px; border-top: 1px solid var(--host-border); color: var(--host-muted); font-size: .7rem; line-height: 1.5; }
.roster-foot svg { width: 18px; height: 18px; color: var(--cv-blue-light); }

.launch-bar { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 20px 22px; border: 1px solid var(--host-border); border-radius: 18px; background: var(--host-panel); }
.launch-status { display: flex; align-items: center; gap: 6px; margin: 0 0 5px; color: var(--host-muted); font-size: .75rem; line-height: 1.5; }
.launch-status::before { flex: none; content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.launch-status.ready { color: var(--cv-green); }
.round-summary { margin: 0; color: var(--cv-yellow); font-size: .875rem; font-weight: 800; }
.launch-bar .cta { flex: none; min-width: 260px; }
.round-layout { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); gap: 18px; }
.round-layout.finished .ranking-card { grid-column: 1 / -1; }
.round-actions { display: flex; justify-content: flex-end; }
.round-actions > button { min-width: 260px; }
.ranks .n { flex: none; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--host-border); font-size: .875rem; font-weight: 800; }
.ranks .gold .n { background: var(--cv-yellow); color: var(--cv-navy-900); }
.ranks .silver .n { background: #c1d8ff; color: var(--cv-navy-900); }
.ranks .bronze .n { background: #efb387; color: var(--cv-navy-900); }
.ranks small { flex: none; color: var(--cv-yellow); font-size: 1.05rem; font-weight: 900; font-variant-numeric: tabular-nums; }
.timer-card { align-content: center; justify-items: center; gap: 20px; min-height: 230px; text-align: center; }
.timer-card span { color: var(--host-muted); font-weight: 700; }
.timer-card strong { font-size: clamp(3rem, 6vw, 4.5rem); font-weight: 900; line-height: 1; font-variant-numeric: tabular-nums; }
.timer-card strong.low { color: var(--cv-red); }

.cta, .danger, .secondary { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 56px; padding: 12px 20px; border: 1px solid transparent; border-radius: var(--cv-radius); font-size: 1rem; font-weight: 900; text-decoration: none; transition: background .15s, border-color .15s, transform .15s; }
.cta { border-color: #ffe792; background: var(--cv-yellow); color: var(--cv-navy-900); box-shadow: 0 4px 0 #ac790d; }
.cta:not(:disabled):active { transform: translateY(3px); box-shadow: 0 1px 0 #ac790d; }
.danger { border-color: #ff6b6b80; background: #361a35; color: #ffd6d6; }
.secondary { min-height: 44px; border-color: var(--host-border); background: var(--host-panel-deep); color: var(--cv-on-dark); font-size: .875rem; }
.cta:disabled, .danger:disabled, .secondary:disabled, .kick:disabled { opacity: .5; cursor: not-allowed; }
.cta:disabled { opacity: 1; border-color: var(--host-border); background: #243e69; box-shadow: 0 4px 0 #071c3f; color: var(--host-muted); }
button:focus-visible, a:focus-visible, input:focus-visible { outline: 3px solid var(--cv-yellow); outline-offset: 3px; }
button:not(:disabled):active, a:active { filter: brightness(.94); }
.create-card { width: 100%; max-width: 520px; margin: 36px auto; }
.create-card input { width: 100%; min-height: 52px; padding: 0 14px; border: 1px solid var(--host-border); border-radius: var(--cv-radius); background: var(--host-panel-deep); color: var(--cv-on-dark); font-size: 1.2rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.copy-feedback { display: grid; gap: 8px; }
.copied { margin: 0; color: var(--cv-green); font-size: .8rem; font-weight: 800; }
.link-box { min-height: 48px; width: 100%; padding: 0 12px; border: 1px solid var(--host-border); border-radius: var(--cv-radius); background: var(--host-panel-deep); color: var(--cv-on-dark); font-size: 1rem; }
.confirm-dialog { box-sizing: border-box; width: min(400px, calc(100vw - 32px)); padding: 24px; border: 1px solid var(--cv-blue-light); border-radius: var(--cv-radius-xl); background: var(--cv-navy-800); color: var(--cv-on-dark); font-family: var(--cv-font); box-shadow: 0 24px 60px #04122a80; }
.confirm-dialog::backdrop { background: #030c28c7; backdrop-filter: blur(5px); }
.confirm-dialog p { margin: 0 0 20px; font-size: 1.1rem; font-weight: 800; line-height: 1.5; }
.dialog-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.dialog-actions button { min-height: 48px; padding: 10px; font-size: .875rem; }

@media (hover: hover) {
  .mode-option:not(.locked):hover, .time-option:not(.custom):not(.locked):hover { border-color: var(--cv-yellow); }
  .cta:not(:disabled):hover { background: #ffdc70; }
  .secondary:not(:disabled):hover { border-color: var(--cv-blue-light); background: #1b3d70; }
  .danger:not(:disabled):hover, .kick:not(:disabled):hover { border-color: var(--cv-red); background: #54243b; }
}
@media (max-width: 960px) {
  .top { flex-wrap: wrap; }
  .tools { margin-left: auto; }
}
@media (max-width: 760px) {
  .wrap { padding: 20px 18px max(28px, env(safe-area-inset-bottom)); }
  .lobby-layout, .round-layout { grid-template-columns: minmax(0, 1fr); }
  .card { padding: 20px; }
  .brand { gap: 14px; }
  .brand-copy { padding-left: 14px; }
  .tools { width: 100%; margin-left: 0; }
  .tools > * { flex: 1; }
  .launch-bar { flex-direction: column; align-items: stretch; gap: 16px; padding: 20px; }
  .launch-bar .cta, .round-actions > button { width: 100%; min-width: 0; }
  .empty-players { min-height: 200px; }
}
@media (max-width: 400px) {
  .wrap { padding-inline: 14px; }
  .card, .launch-bar { padding: 16px; }
  .brand-logo { width: 80px; height: 58px; }
  .brand { gap: 12px; }
  .brand-copy { padding-left: 12px; }
  .top h1 { font-size: 1.4rem; }
  .modes, .times { gap: 7px; }
  .mode-option b { font-size: .72rem; }
  .mode-option { min-height: 118px; }
  .tools .secondary { font-size: .72rem; padding-inline: 8px; }
  .people li { gap: 8px; padding-inline: 8px; }
  .ranks img { width: 32px; height: 32px; }
  .ranks small { font-size: .875rem; }
}
@media (prefers-reduced-motion: reduce) {
  .mode-option, .time-option, .cta, .danger, .secondary { transition: none; }
  .cta:not(:disabled):active { transform: none; }
}
</style>
