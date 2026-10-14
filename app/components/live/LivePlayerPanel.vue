<template>
  <main class="live-player-panel" :class="`stage-${stage}`" :aria-labelledby="headingId">
    <section class="live-card">
      <p class="live-brand"><i aria-hidden="true" />{{ t('live.brand') }}<template v-if="state"> · {{ state.code }}</template></p>

      <template v-if="stage === 'countdown'">
        <p class="round-info">{{ roundInfo }}</p>
        <h1 :id="headingId" ref="heading" tabindex="-1" class="sr-only">{{ t('live.waitStart') }}</h1>
        <p class="countdown" role="status" aria-live="assertive">
          <span :key="countdown" class="countdown-number">{{ countdown > 0 ? countdown : t('live.countdownGo') }}</span>
        </p>
      </template>

      <template v-else>
        <img v-if="self" class="live-avatar" :src="avatarSrc(self.avatarId)" alt="" draggable="false" />
        <p v-if="self" class="live-name" :title="self.name">{{ self.name }}</p>
        <h1 :id="headingId" ref="heading" tabindex="-1">{{ title }}</h1>

        <template v-if="stage === 'lobby'">
          <p class="round-info">{{ roundInfo }}</p>
          <p class="waiting-dots" aria-hidden="true"><i /><i /><i /></p>
          <div class="lobby-players">
            <p>{{ t('live.playersCount', { count: playing.length }) }}</p>
            <ul>
              <li v-for="player in playing" :key="player.id" :class="{ me: player.id === selfId, off: !player.connected }">
                <img :src="avatarSrc(player.avatarId)" :alt="player.name" :title="player.name" draggable="false" />
              </li>
            </ul>
          </div>
        </template>

        <template v-else-if="stage === 'queued'">
          <p v-if="queueRemainingSec > 0" class="round-info">{{ t('live.queuedEta', { time: clock(queueRemainingSec) }) }}</p>
        </template>

        <template v-else-if="stage === 'results' && self">
          <dl class="result-metrics">
            <div><dt>{{ t('summary.score') }}</dt><dd class="score">{{ self.score.toLocaleString('th-TH') }}</dd></div>
            <div><dt>{{ t('live.rank') }}</dt><dd>{{ rank }}/{{ playing.length }}</dd></div>
          </dl>
          <p class="round-info">{{ t('summary.levels', { count: self.levelsCompleted }) }}</p>
          <p v-if="lateScoreNote" class="late-note" role="note">{{ t('live.lateScore') }}</p>
        </template>

        <ol v-if="showStandings" class="standings" :aria-label="t('live.board')">
          <li v-for="row in standings" :key="row.player.id" :class="[medal(row.rank), { me: row.player.id === selfId, off: !row.player.connected }]">
            <span class="n">{{ row.rank }}</span>
            <img :src="avatarSrc(row.player.avatarId)" alt="" draggable="false" />
            <b :title="row.player.name">{{ row.player.name }}</b>
            <small>{{ row.player.score.toLocaleString('th-TH') }}</small>
          </li>
        </ol>

        <div class="live-actions">
          <template v-if="stage === 'lobby' || stage === 'queued' || stage === 'results' || stage === 'connecting'">
            <button type="button" class="text-action" @click="emit('changePlayer')">{{ t('live.changePlayer') }}</button>
            <button type="button" class="main-action" @click="emit('leave')">{{ t('live.leave') }}</button>
          </template>
          <button v-else type="button" class="main-action" @click="emit('home')">{{ t('live.home') }}</button>
        </div>
      </template>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useGameI18n } from "../../composables/useGameI18n";
import { usePlayerAvatar } from "../../composables/usePlayerAvatar";
import type { LivePlayerStage } from "../../utils/live/playerStage";
import type { RoomState } from "../../utils/live/protocol";

const props = defineProps<{
  stage: LivePlayerStage;
  state: RoomState | null;
  /** This device's public LivePlayer.id (from `you`); empty until known. */
  selfId: string;
  countdown: number;
  queueRemainingSec: number;
  lateScoreNote: boolean;
}>();
const emit = defineEmits<{ changePlayer: []; leave: []; home: [] }>();
const { t } = useGameI18n();
const avatarSrc = usePlayerAvatar();
const headingId = useId();
const heading = ref<HTMLElement | null>(null);

const playing = computed(() => props.state?.players.filter((p) => p.status === "playing") ?? []);
const self = computed(() => props.state?.players.find((p) => p.id === props.selfId) ?? null);
const rank = computed(() => playing.value.findIndex((p) => p.id === props.selfId) + 1);
const roundInfo = computed(() => {
  const s = props.state;
  if (!s) return "";
  const min = s.durationSec / 60;
  return t("live.roundInfo", { mode: `${s.mode} · ${t(`difficulty.${s.mode}`)}`, minutes: Number.isInteger(min) ? min : min.toFixed(1) });
});
const title = computed(() => {
  switch (props.stage) {
    case "unavailable": return t("live.unavailable");
    case "connecting": return t("live.reconnecting");
    case "lobby": return t("live.waitHost");
    case "queued": return t("live.queued");
    case "full": return t("live.full");
    case "kicked": return t("live.kicked");
    case "results": return rank.value > 0 ? t("live.yourRank", { rank: rank.value, total: playing.value.length }) : t("live.resultsTitle");
    default: return "";
  }
});

// Queue and results show the round's board: the top five, plus this player's own row if lower.
const showStandings = computed(() => (props.stage === "queued" || props.stage === "results") && playing.value.length > 0);
const standings = computed(() => {
  const rows = playing.value.map((player, index) => ({ player, rank: index + 1 }));
  const top = rows.slice(0, 5);
  const mine = rows.find((row) => row.player.id === props.selfId);
  return mine && mine.rank > 5 ? [...top, mine] : top;
});
function medal(place: number): string {
  return ["", "gold", "silver", "bronze"][place] ?? "";
}
function clock(sec: number): string {
  return `${Math.floor(sec / 60).toString().padStart(2, "0")}:${(sec % 60).toString().padStart(2, "0")}`;
}

// Like SessionPanel: move focus to the heading whenever the screen changes.
onMounted(() => heading.value?.focus());
watch(() => props.stage, async () => {
  await nextTick();
  heading.value?.focus();
});
</script>

<style scoped>
.live-player-panel { box-sizing: border-box; min-height: 100%; display: grid; place-items: center; padding: 12px; }
.live-card { box-sizing: border-box; position: relative; width: min(560px, 100%); display: grid; justify-items: center; gap: 14px; padding: clamp(22px, 3vw, 32px); border: 1px solid #7faaff; border-radius: var(--cv-radius-xl); background: linear-gradient(155deg, #19387b, #0b214a); color: #fff; text-align: center; box-shadow: var(--cv-shadow-window); animation: live-arrive 380ms cubic-bezier(.2, .8, .2, 1) both; }
p, h1, dl, dd, ol { margin: 0; }
.live-brand { display: inline-flex; align-items: center; gap: 8px; color: #bdd8ff; font-size: .85rem; font-weight: 800; letter-spacing: .04em; }
.live-brand i { width: 8px; height: 8px; border-radius: 50%; background: var(--cv-red); box-shadow: 0 0 8px #ff6b6b99; animation: live-dot 1.6s ease-in-out infinite; }
h1 { color: #ffdc58; font-size: clamp(1.35rem, 4vw, 1.8rem); font-weight: 800; line-height: 1.3; text-wrap: balance; }
h1:focus { outline: none; }
.round-info { color: #bdd8ff; font-size: .95rem; }
.live-avatar { width: 96px; height: 96px; border: 4px solid #fff; border-radius: 50%; background: #d8eaff; object-fit: contain; }
.live-name { max-width: 100%; margin-top: -6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 1.1rem; font-weight: 800; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

/* Lobby: three soft dots while staff get ready, and everyone already in the room. */
.waiting-dots { display: flex; gap: 8px; }
.waiting-dots i { width: 10px; height: 10px; border-radius: 50%; background: #87dfff; animation: wait-dot 1.2s ease-in-out infinite; }
.waiting-dots i:nth-child(2) { animation-delay: .15s; }
.waiting-dots i:nth-child(3) { animation-delay: .3s; }
.lobby-players { display: grid; gap: 8px; width: 100%; padding-top: 12px; border-top: 1px solid #86b5ff33; color: #bdd8ff; font-size: .85rem; }
.lobby-players ul { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; padding: 0; margin: 0; list-style: none; }
.lobby-players img { display: block; width: 40px; height: 40px; border: 2px solid #8ba8de; border-radius: 50%; background: #d9e8ff; object-fit: contain; }
.lobby-players .me img { border-color: #ffdb58; box-shadow: 0 0 0 2px #ffdb5855; }
.lobby-players .off { opacity: .5; }

/* Countdown: one big number per second. */
.countdown { display: grid; place-items: center; min-height: 160px; }
.countdown-number { color: #ffdb58; font-size: clamp(5rem, 22vw, 8rem); font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; text-shadow: 0 0 24px #ffdb5866; animation: count-pop 900ms cubic-bezier(.34, 1.56, .64, 1) both; }

/* Results: score and place, like the summary metrics. */
.result-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; width: 100%; }
.result-metrics div { display: grid; gap: 8px; padding: 14px 8px; border: 1px solid #86b5ff33; border-radius: 14px; background: #071a3c80; }
dt { color: #bed7ff; font-size: .85rem; }
dd { font-size: 1.5rem; font-weight: 800; font-variant-numeric: tabular-nums; }
dd.score { color: #ffdb58; }
.late-note { padding: 8px 12px; border: 1px solid #ffdb5866; border-radius: var(--cv-radius); background: #ffdb581f; color: #ffe9a3; font-size: .85rem; }

.standings { display: grid; gap: 6px; width: 100%; padding: 0; list-style: none; text-align: left; }
.standings li { display: flex; align-items: center; gap: 10px; min-width: 0; min-height: 40px; padding: 0 10px; border: 1px solid transparent; border-radius: 10px; background: #ffffff0d; }
.standings li.me { border-color: #87dfff99; background: #87dfff1f; }
.standings li.off { opacity: .55; }
.standings .n { flex: none; width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; background: #ffffff1f; font-size: .8rem; font-weight: 800; }
.standings img { flex: none; width: 30px; height: 30px; border: 1px solid #8ba8de; border-radius: 50%; background: #d9e8ff; object-fit: contain; }
.standings b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
.standings small { color: #ffdb58; font-size: 1rem; font-weight: 800; font-variant-numeric: tabular-nums; }
/* Medal colours shared with ChallengeRanking / LiveBoard. */
.gold .n { background: #ffdc53; color: #112455; }
.silver .n { background: #c1d8ff; color: #112455; }
.bronze .n { background: #efb387; color: #112455; }

.live-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; width: 100%; padding-top: 4px; }
button { min-height: 48px; padding: 12px 20px; border-radius: var(--cv-radius); font: inherit; font-weight: 800; cursor: pointer; transition: background 150ms, transform 150ms; }
button:active { transform: translateY(2px); }
button:focus-visible { outline: 3px solid #ffc83d; outline-offset: 3px; }
.main-action { min-width: 180px; border: 0; color: #102754; background: #ffdc58; box-shadow: 0 3px 0 #bc8e22; }
.main-action:hover { background: #ffe88f; }
.text-action { border: 1px solid #799bd466; color: #e0ecff; background: #203f76; }
.text-action:hover { background: #29508f; }

@keyframes live-arrive { from { opacity: 0; transform: translateY(12px) scale(.97); } }
@keyframes live-dot { 50% { opacity: .35; } }
@keyframes wait-dot { 0%, 100% { opacity: .35; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-6px); } }
@keyframes count-pop { 0% { opacity: 0; transform: scale(1.6); } 35% { opacity: 1; transform: scale(.94); } 60% { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) {
  .live-card, .live-brand i, .waiting-dots i, .countdown-number { animation: none; }
  .waiting-dots i { opacity: .8; }
  button, button:active { transition: none; transform: none; }
}
@media (max-width: 420px) {
  .live-actions { flex-direction: column; }
  .live-actions button { width: 100%; }
}
</style>
