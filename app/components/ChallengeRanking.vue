<template>
  <section
    v-show="!hideEmpty || !empty || placeholder"
    class="challenge-ranking"
    :class="{
      space: variant === 'space',
      'with-podium': podium,
      'with-credits': credits,
      'with-placeholder': placeholder,
      split
    }"
    :aria-labelledby="headingId"
  >
    <div class="ranking-heading">
      <h3 :id="headingId">{{ t('home.today') }}</h3>
    </div>
    <p class="scoring-policy">{{ t('ranking.scoringPolicy', { strategy: t(`scoring.${board.scoringStrategy}`) }) }}</p>
    <p v-if="error" class="board-error" role="alert">
      {{ t('storage.loadError') }}
    </p>
    <template v-else-if="rows.length || (placeholder && loaded)">
      <p v-if="!rows.length" class="placeholder-note">{{ t('ranking.empty') }}</p>
      <div v-if="podium" class="rank-podium">
        <div
          v-for="place in podiumPlaces"
          :key="place.rank"
          class="podium-slot"
          :class="`podium-place-${place.rank}`"
          role="group"
          :aria-label="
            t('ranking.podiumPlayer', {
              rank: place.rank,
              name: place.score?.name ?? t('ranking.waiting')
            })
          "
        >
          <div class="podium-avatar" :class="{ vacant: !place.score }">
            <svg
              v-if="place.rank === 1 && place.score"
              class="winner-crown"
              viewBox="0 0 32 24"
              aria-hidden="true"
            >
              <path d="m3 6 7 5 6-9 6 9 7-5-4 15H7z" />
              <path d="M8 17h16" />
            </svg>
            <img
              v-if="place.score"
              :class="{ 'is-photo': avatarSrc(place.score.avatarId).startsWith('https:') }"
              :src="avatarSrc(place.score.avatarId)"
              alt=""
              draggable="false"
            />
            <span v-else aria-hidden="true">—</span>
            <span class="podium-medal" aria-hidden="true">{{
              place.rank
            }}</span>
          </div>
          <strong class="podium-name" :title="place.score?.name">{{
            place.score?.name ?? t('ranking.waiting')
          }}</strong>
          <small class="podium-points">{{
            place.score ?
              t('ranking.points', {
                score: place.score.score.toLocaleString('th-TH')
              })
            : '—'
          }}</small>
          <div class="podium-block" aria-hidden="true">
            <span>{{ place.rank }}</span>
          </div>
        </div>
        <p v-if="showTotal" class="player-total"><span>{{ t('ranking.totalPlayers') }}</span><strong>{{ rows.length }}</strong></p>
      </div>
      <div
        ref="creditsViewport"
        class="credits-viewport game-scrollbar"
        :class="{ dragging: isDragging }"
        :tabindex="credits || selectable ? 0 : undefined"
        :role="credits || selectable ? 'region' : undefined"
        :aria-label="credits || selectable ? t('ranking.readScores') : undefined"
        @click.stop="focusForInput"
        @wheel.passive="pauseForInput"
        @pointerdown="beginManualDrag"
        @pointermove="moveManualDrag"
        @pointerup="endManualDrag"
        @pointercancel="endManualDrag"
        @lostpointercapture="endManualDrag"
      >
        <p v-if="!visibleRows.length && rows.length" class="search-empty" role="status">{{ t('ranking.searchEmpty') }}</p>
        <ol ref="creditsContent" class="challenge-rows">
          <li
            v-for="{ score, index } in visibleRows"
            :key="score.id"
            :style="{ '--row': index }"
            :class="[
              { podium: index < 3, mine: isMine(score), selectable },
              `place-${index + 1}`
            ]"
          >
            <button v-if="selectable" type="button" class="player-select" :disabled="selectionBusy" :aria-label="t('ranking.selectPlayer', { name: score.name, rank: index + 1 })" @click.stop="emit('selectPlayer', score)"><span class="sr-only">{{ t('ranking.selectPlayer', { name: score.name, rank: index + 1 }) }}</span></button>
            <span
              class="rank-number"
              :aria-label="t('ranking.rank', { rank: index + 1 })"
              >{{ index + 1 }}</span
            >
            <img
              class="row-avatar"
              :class="{ 'is-photo': avatarSrc(score.avatarId).startsWith('https:') }"
              :src="avatarSrc(score.avatarId)"
              alt=""
              draggable="false"
            />
            <span class="who">
              <strong>{{ score.name }}</strong>
              <small v-if="ageRange(score.age)">{{
                ageRange(score.age)
              }}</small>
            </span>
            <span v-if="isMine(score)" class="you">{{
              t('ranking.you')
            }}</span>
            <span class="result">
              <strong
                :aria-label="t('ranking.points', { score: score.score })"
                >{{ score.score.toLocaleString('th-TH') }}</strong
              >
              <small>{{ formatClock(score.elapsedMs) }}</small>
            </span>
          </li>
          <!-- Open places up to the board size, so an empty board still reads as a leaderboard. -->
          <li
            v-for="rank in openRanks"
            :key="`open-${rank}`"
            :style="{ '--row': rank - 1 }"
            class="open-place"
            :class="[{ podium: rank <= 3 }, `place-${rank}`]"
            aria-hidden="true"
          >
            <span class="rank-number">{{ rank }}</span>
            <span class="row-avatar avatar-slot" />
            <span class="who"><strong>{{ t('ranking.waiting') }}</strong></span>
            <span class="result"><strong>—</strong></span>
          </li>
        </ol>
      </div>
    </template>
    <div v-else-if="!hideEmpty" class="challenge-empty">
      <div class="codi-stand">
        <span class="landing-pad" aria-hidden="true" />
        <img
          :src="variant === 'space' ? PLAYER_POSES.win : PLAYER_SPRITES.down"
          alt="Codi"
          draggable="false"
        />
      </div>
      <p>{{ t('ranking.empty') }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ScoreRepository } from '../storage/contracts'
import type { Score } from '../types/debug-game'
import type { RankingBoard } from '../utils/ranking'
import { formatClock, scorePlayerKey } from '../utils/ranking'
import { PLAYER_SPRITES, PLAYER_POSES } from '../utils/playerSprites'
import { useScoreBoard } from '../composables/useScoreBoard'
import { useGameI18n } from '../composables/useGameI18n'
import { useLeaderboardCredits } from '../composables/useLeaderboardCredits'
import { usePlayerAvatar } from '../composables/usePlayerAvatar'

const props = withDefaults(
  defineProps<{
    repository: ScoreRepository
    board: RankingBoard
    highlightId?: string
    highlightPlayerId?: string
    limit?: number
    search?: string
    selectable?: boolean
    selectionBusy?: boolean
    showTotal?: boolean
    variant?: 'light' | 'space'
    podium?: boolean
    credits?: boolean
    paused?: boolean
    hideEmpty?: boolean
    /** Show the podium and open places even before anyone has played today. */
    placeholder?: boolean
    /** Podium and list side by side; the parent supplies the visible heading. */
    split?: boolean
  }>(),
  {
    variant: 'light',
    podium: false,
    credits: false,
    paused: false,
    hideEmpty: false,
    placeholder: false,
    split: false,
    limit: 10, search: '', selectable: false, selectionBusy: false, showTotal: false
  }
)
const emit = defineEmits<{
  viewportRemoved: []
  emptyChange: [empty: boolean]
  selectPlayer: [score: Score]
}>()
const { t } = useGameI18n()
const headingId = useId()
const { rows, error, loaded } = useScoreBoard(
  props.repository,
  computed(() => props.board),
  props.limit
)
const visibleRows = computed(() => {
  const query = props.search.trim().normalize('NFC').toLocaleLowerCase('th-TH');
  return rows.value.map((score, index) => ({ score, index })).filter(({ score }) =>
    !query || score.name.normalize('NFC').toLocaleLowerCase('th-TH').includes(query),
  );
});
function isMine(score: Score): boolean {
  return score.id === props.highlightId || Boolean(props.highlightPlayerId && scorePlayerKey(score) === props.highlightPlayerId);
}
watch(() => props.search, () => { if (creditsViewport.value) creditsViewport.value.scrollTop = 0; }, { flush: 'post' });
const empty = computed(
  () => loaded.value && !error.value && rows.value.length === 0
)
watch(empty, (value) => emit('emptyChange', value), {
  immediate: true,
  flush: 'post'
})
const podiumPlaces = computed(() =>
  [2, 1, 3].map((rank) => ({ rank, score: rows.value[rank - 1] }))
)
/** Matches the 10 places todayRanking keeps per board. */
const BOARD_PLACES = 10
const openRanks = computed(() =>
  props.placeholder && !error.value
    ? Array.from(
        { length: Math.max(0, BOARD_PLACES - rows.value.length) },
        (_, index) => rows.value.length + index + 1
      )
    : []
)
const creditsViewport = ref<HTMLElement | null>(null)
const creditsContent = ref<HTMLElement | null>(null)
watch(
  creditsViewport,
  (area, previous) => {
    if (!area && previous) emit('viewportRemoved')
  },
  { flush: 'post' }
)
const avatarSrc = usePlayerAvatar()
const {
  isDragging,
  pauseForInput,
  focusForInput,
  beginManualDrag,
  moveManualDrag,
  endManualDrag
} = useLeaderboardCredits(
  creditsViewport,
  creditsContent,
  // Open places fit the board; auto-scrolling through them would only show empty rows.
  computed(() => props.credits && openRanks.value.length === 0),
  computed(() => props.paused)
)
// A split board scrolls on its own, so bring the highlighted run into view.
watch(
  [rows, () => props.highlightId, () => props.highlightPlayerId],
  () => {
    const viewport = creditsViewport.value
    const mine = creditsContent.value?.querySelector<HTMLElement>('li.mine')
    if (!props.split || !viewport || !mine) return
    const top = mine.offsetTop
    const bottom = top + mine.offsetHeight
    if (top >= viewport.scrollTop && bottom <= viewport.scrollTop + viewport.clientHeight) return
    viewport.scrollTop = top - (viewport.clientHeight - mine.offsetHeight) / 2
  },
  { flush: 'post' }
)
function ageRange(age?: number): string {
  if (!age) return ''
  const band = [
    [5, 8],
    [9, 12],
    [13, 15],
    [16, 18]
  ].find(([from, to]) => age >= from! && age <= to!)
  return band ? t('ranking.ageBand', { from: band[0]!, to: band[1]! }) : ''
}
</script>

<style scoped>
.player-total { grid-column: 1 / -1; display: grid; gap: 6px; text-align: center; margin: 18px 0; color: #e3edff; font-weight: 800; }
.player-total strong { font-size: clamp(1.5rem, 3vw, 2.3rem); }
.challenge-rows li.selectable { position: relative; }
.player-select { position: absolute; inset: 0; width: 100%; border: 0; border-radius: inherit; background: transparent; cursor: pointer; }
.player-select:not(:disabled):hover { background: #a9caff18; }
.player-select:focus-visible { outline: 3px solid #ffdc53; outline-offset: -3px; }
.player-select:disabled { cursor: wait; }
.search-empty { margin: 12px; line-height: 1.6; color: #d6e6ff; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.split:has(.player-total) .rank-podium { grid-template-rows: minmax(0, 1fr) auto; }
.challenge-ranking {
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 6px;
  color: var(--cv-text);
}
.ranking-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}
.ranking-heading h3 {
  flex: 1;
}
.scoring-policy { flex: none; margin: 0 0 6px; color: var(--cv-muted); font-size: .8rem; line-height: 1.5; }
.space .scoring-policy { color: #c4dcff; }
.split .scoring-policy { grid-column: 1 / -1; grid-row: 1; }
.credits-viewport {
  min-height: 0;
}
.with-credits .credits-viewport {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-behavior: auto;
  touch-action: pan-y;
  cursor: grab;
  user-select: none;
}
.with-credits .credits-viewport.dragging {
  cursor: grabbing;
}
.credits-viewport:focus-visible {
  outline: 2px solid #9fcaff;
  outline-offset: 2px;
  border-radius: 8px;
}
.rank-podium {
  flex: none;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: end;
  gap: 0px;
  width: 80%;
  margin-inline: auto;
  box-sizing: border-box;
  height: 190px;
  padding: 18px 6px 0;
}
.podium-slot {
  --medal: #ffdc53;
  --podium-face: linear-gradient(135deg, #f8dda0, #b38026);
  --podium-top: #ffe9a3;
  --podium-edge: #efc969;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: end;
  gap: 4px;
  min-width: 0;
}
.podium-place-2 {
  --medal: #c1d8ff;
  --podium-face: linear-gradient(135deg, #e6edf6, #8294ad);
  --podium-top: #f1f6ff;
  --podium-edge: #c5d5e9;
}
.podium-place-3 {
  --medal: #efb387;
  --podium-face: linear-gradient(135deg, #f0c7a4, #a2653c);
  --podium-top: #ffd5b0;
  --podium-edge: #dca57e;
}
.podium-avatar {
  position: relative;
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  margin-bottom: 3px;
  border: 3px solid var(--medal);
  border-radius: 50%;
  background: radial-gradient(circle at top, #76a3ed, #23448d);
  box-shadow: 0 4px 12px #06183c;
}
.podium-avatar img {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: contain;
}
.podium-avatar img.is-photo,
.row-avatar.is-photo {
  object-fit: cover;
  background: transparent;
}
.row-avatar {
  flex: none;
  width: 28px;
  height: 28px;
  border: 1px solid #8ba8de;
  border-radius: 50%;
  background: #d9e8ff;
  object-fit: contain;
}
.podium-avatar.vacant {
  border-style: dashed;
  opacity: 0.6;
}
.podium-medal {
  position: absolute;
  right: -3px;
  bottom: -5px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 2px solid #142c64;
  border-radius: 50%;
  background: var(--medal);
  color: #112455;
  font-size: 0.7rem;
  font-weight: 800;
}
.winner-crown {
  position: absolute;
  width: 30px;
  height: 24px;
  top: -27px;
  left: 8px;
  fill: #ffda4b;
  stroke: #b27f21;
  stroke-width: 1.5;
  filter: drop-shadow(0 2px 2px #101d46);
}
.podium-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #fff;
  font-size: 0.8rem;
  line-height: 1.2;
}
.podium-points {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--medal);
  font-size: 0.65rem;
  line-height: 1.2;
}
.podium-block {
  position: relative;
  isolation: isolate;
  display: grid;
  align-items: start;
  justify-items: center;
  width: 90%;
  height: 68px;
  margin-top: 9px;
  border: 1px solid var(--podium-edge);
  border-radius: 9px 9px 3px 3px;
  background: var(--podium-face);
  box-shadow:
    inset -8px 0 0 rgba(36, 30, 19, 0.16),
    0 6px 10px #061638;
}
.podium-block::before {
  content: '';
  position: absolute;
  left: -1px;
  right: -1px;
  top: -10px;
  height: 13px;
  border-radius: 5px 5px 0 0;
  clip-path: polygon(9% 0, 91% 0, 100% 100%, 0 100%);
  background: var(--podium-top);
  z-index: -1;
}
.podium-block span {
  color: #fff;
  font-size: 2rem;
  line-height: 1;
  font-weight: 800;
  text-shadow: 0 2px 3px rgba(48, 34, 17, 0.7);
}
.podium-place-2 .podium-block {
  height: 47px;
}
.podium-place-3 .podium-block {
  height: 34px;
}
.space.with-podium .challenge-rows {
  gap: 6px;
}
.space.with-podium .challenge-rows li {
  min-height: 46px;
  padding: 5px 9px;
}
.space.with-podium .who {
  display: grid;
  gap: 2px;
}
.space.with-podium .result {
  display: grid;
  gap: 2px;
  text-align: right;
}
h3 {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--cv-heading);
}
.challenge-rows {
  display: grid;
  gap: 3px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.challenge-rows li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 24px;
  padding: 2px 8px;
  line-height: 1.2;
  border-radius: 8px;
  background: #f1f5fb;
}
.challenge-rows li.podium {
  border-left: 3px solid #e2b537;
  background: #fff5cf;
}
.challenge-rows li.place-2 {
  border-left-color: #91a6c2;
  background: #edf3fc;
}
.challenge-rows li.place-3 {
  border-left-color: #d39467;
  background: #fff0e5;
}
.challenge-rows li.mine {
  outline: 2px solid var(--cv-blue);
  outline-offset: -2px;
}
.rank-number {
  flex: 0 0 20px;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 800;
}
.who {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.who strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.85rem;
}
.who small {
  flex: none;
  font-size: 0.65rem;
  color: #526079;
}
.result {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-variant-numeric: tabular-nums;
}
.result strong {
  font-size: 0.85rem;
}
.result small {
  font-size: 0.7rem;
  color: #526079;
}
.you {
  font-size: 0.65rem;
  color: #1254c7;
}
.challenge-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  min-height: 150px;
  padding: 16px;
  text-align: center;
  border: 1px dashed #b6c9e8;
  border-radius: 14px;
  background: #f0f6ff;
}
.challenge-empty img {
  width: 76px;
  height: 92px;
  object-fit: contain;
}
.challenge-empty p {
  max-width: 210px;
  margin: 0;
  font-size: 0.9rem;
  color: #526079;
}
.board-error {
  padding: 16px;
  color: #a32d30;
}
.codi-stand {
  position: relative;
  display: grid;
  place-items: center;
}
.landing-pad {
  display: none;
}
/* Home's space theme is scoped; summary keeps its existing light ranking. */
.space {
  gap: 8px;
  color: #f0f5ff;
}
.space h3 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.875rem;
  color: #dce8ff;
}
.space h3::after {
  content: '';
  height: 1px;
  flex: 1;
  background: rgba(135, 179, 255, 0.35);
}
.space .challenge-rows {
  gap: 4px;
}
.space .challenge-rows li {
  min-height: 28px;
  padding: 2px 8px;
  border: 1px solid rgba(110, 153, 242, 0.23);
  border-radius: 9px;
  background: #102a70;
}
.space .challenge-rows li.podium {
  border-left: 3px solid #ffdb58;
  background: linear-gradient(
    90deg,
    rgba(255, 210, 64, 0.16),
    rgba(27, 57, 133, 0.9)
  );
}
.space .challenge-rows li.place-2 {
  border-left-color: #c1d8ff;
  background: linear-gradient(
    90deg,
    rgba(182, 213, 255, 0.14),
    rgba(27, 57, 133, 0.9)
  );
}
.space .challenge-rows li.place-3 {
  border-left-color: #f1b784;
  background: linear-gradient(
    90deg,
    rgba(245, 161, 105, 0.14),
    rgba(27, 57, 133, 0.9)
  );
}
.space .rank-number {
  display: grid;
  place-items: center;
  flex-basis: 22px;
  height: 22px;
  border-radius: 50%;
  background: #274b98;
  color: #dce8ff;
}
.space .podium .rank-number {
  background: #ffdb58;
  color: #152c61;
}
.space .place-2 .rank-number {
  background: #c1d8ff;
}
.space .place-3 .rank-number {
  background: #f1b784;
}
.space .who strong,
.space .result strong {
  font-size: 0.9rem;
}
.space .place-1 .result strong {
  color: #ffe47e;
}
.space .who small,
.space .result small {
  color: #b5cdfa;
}
.space .you {
  color: #ffe47e;
}
.space .challenge-empty {
  gap: 18px;
  padding: 18px;
  border: 2px solid #8bc2ff;
  border-radius: 18px;
  background-color: #abd8ff;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.55) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.55) 1px, transparent 1px),
    linear-gradient(135deg, #8bcbf7, #bfddff);
  background-size:
    32px 32px,
    32px 32px,
    100% 100%;
  box-shadow: inset 0 1px 0 #e5f4ff;
}
.space .challenge-empty img {
  position: relative;
  z-index: 1;
  width: 116px;
  height: 140px;
  object-fit: contain;
  filter: drop-shadow(0 5px 2px rgba(20, 69, 148, 0.25));
}
.space .landing-pad {
  display: block;
  position: absolute;
  bottom: -5px;
  width: 150px;
  height: 25px;
  border: 2px solid #123981;
  border-radius: 50%;
  background: #377eff;
  box-shadow: 0 4px 0 #124da8;
}
.space .challenge-empty p {
  position: relative;
  z-index: 1;
  max-width: 250px;
  padding: 10px 14px;
  border: 2px solid #14397b;
  border-radius: 14px;
  background: #fff;
  color: #18366c;
  font-size: 0.9rem;
  font-weight: 700;
  box-shadow: 0 4px 0 rgba(31, 86, 164, 0.18);
}
.space .placeholder-note {
  flex: none;
  margin: 0;
  color: #b5cdfa;
  font-size: 0.8rem;
  font-weight: 700;
}
.space .challenge-rows li.open-place,
.space .challenge-rows li.open-place.podium {
  border: 1px dashed rgba(140, 182, 255, 0.4);
  background: rgba(16, 42, 112, 0.45);
}
.space .open-place .rank-number {
  background: transparent;
  box-shadow: inset 0 0 0 1px rgba(140, 182, 255, 0.55);
  color: #b5cdfa;
}
.space .open-place .who strong,
.space .open-place .result strong {
  color: #8fb0e6;
  font-weight: 700;
}
.avatar-slot {
  border: 1px dashed rgba(140, 182, 255, 0.55);
  background: rgba(140, 182, 255, 0.08);
}
.space .board-error {
  border-radius: 12px;
  background: #102a70;
  color: #ffd2b8;
}
@media (max-width: 450px) {
  .who {
    display: grid;
    gap: 0;
  }
  .challenge-rows li {
    min-height: 40px;
  }
}

/* Split: the podium gets its own lit stage, the full board scrolls beside it. */
.split {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  grid-template-rows: auto minmax(0, 1fr);
  column-gap: clamp(14px, 2.4vw, 24px);
  row-gap: 0;
}
.split .ranking-heading {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.split .placeholder-note,
.split .board-error {
  grid-column: 1 / -1;
  margin-bottom: 10px;
}
.split .rank-podium {
  grid-row: 2;
  align-self: stretch;
  width: 100%;
  height: auto;
  min-height: 0;
  padding: 36px clamp(10px, 2vw, 22px) 0;
  overflow: hidden;
  border: 1px solid #86b5ff33;
  border-radius: 18px;
  background:
    radial-gradient(60% 55% at 50% 100%, rgba(255, 220, 88, 0.22), transparent 70%),
    linear-gradient(180deg, #0b1f49, #12306c);
}
.split .podium-avatar {
  width: clamp(52px, 7dvh, 68px);
  height: clamp(52px, 7dvh, 68px);
}
.split .podium-place-1 .podium-avatar {
  width: clamp(60px, 8.5dvh, 80px);
  height: clamp(60px, 8.5dvh, 80px);
}
.split .winner-crown {
  left: 50%;
  translate: -50% 0;
}
.split .podium-name {
  font-size: 0.95rem;
}
.split .podium-points {
  font-size: 0.8rem;
  font-weight: 700;
}
.split .podium-block {
  height: clamp(60px, 12dvh, 96px);
}
.split .podium-place-2 .podium-block {
  height: clamp(42px, 8.5dvh, 68px);
}
.split .podium-place-3 .podium-block {
  height: clamp(30px, 6dvh, 48px);
}
.split .credits-viewport {
  grid-row: 2;
  position: relative;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 2px 6px 2px 2px;
}
.space.split .challenge-rows {
  gap: 6px;
}
.space.split .challenge-rows li {
  min-height: 52px;
  padding: 6px 12px;
  gap: 10px;
}
.space.split .row-avatar {
  width: 36px;
  height: 36px;
}
.space.split .who {
  display: grid;
  gap: 2px;
}
.space.split .who strong {
  font-size: 1rem;
}
.space.split .who small,
.space.split .result small {
  font-size: 0.75rem;
}
.space.split .result {
  display: grid;
  gap: 2px;
  text-align: right;
}
.space.split .result strong {
  font-size: 1.05rem;
}
.space.split .challenge-rows li.mine {
  outline: 2px solid #ffdc58;
  outline-offset: -2px;
}
.space.split .you {
  flex: none;
  padding: 3px 9px;
  border-radius: 999px;
  background: #ffdc58;
  color: #102754;
  font-size: 0.75rem;
  font-weight: 800;
}
@media (max-width: 720px) {
  .split {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: none;
    row-gap: 12px;
  }
  .split .rank-podium,
  .split .credits-viewport {
    grid-row: auto;
  }
  .split .rank-podium {
    height: auto;
    padding-top: 40px;
  }
  .split .credits-viewport {
    overflow: visible;
  }
  /* The podium already shows open places; keep the button within reach. */
  .split .open-place {
    display: none;
  }
  .space.split .challenge-rows li {
    gap: 8px;
    padding-inline: 10px;
  }
  .space.split .row-avatar {
    width: 30px;
    height: 30px;
  }
  .space.split .you {
    padding: 2px 7px;
  }
}

/* Podium rises third, second, then first; each player drops onto their
   block after it lands and the winner's crown pops last. */
.podium-slot { --rise-delay: 240ms; }
.podium-place-2 { --rise-delay: 120ms; }
.podium-place-3 { --rise-delay: 0ms; }
.podium-block {
  transform-origin: center bottom;
  animation: podium-rise 560ms var(--rise-delay) cubic-bezier(0.34, 1.3, 0.64, 1) backwards;
}
.podium-avatar,
.podium-name,
.podium-points {
  animation: podium-drop 460ms calc(var(--rise-delay) + 260ms) cubic-bezier(0.34, 1.5, 0.64, 1) backwards;
}
.winner-crown {
  transform-origin: 50% 100%;
  animation: crown-pop 520ms 820ms cubic-bezier(0.34, 1.8, 0.64, 1) backwards;
}
/* Rows slide in as a list; the delay is capped so long boards stay quick. */
.challenge-rows li {
  animation: row-in 380ms min(calc(var(--row, 0) * 45ms + 150ms), 600ms) cubic-bezier(0.16, 1, 0.3, 1) backwards;
}
.challenge-rows li.mine {
  animation:
    row-in 380ms min(calc(var(--row, 0) * 45ms + 150ms), 600ms) cubic-bezier(0.16, 1, 0.3, 1) backwards,
    mine-glow 900ms 700ms ease-in-out 2;
}
@keyframes podium-rise {
  from {
    transform: scaleY(0.05);
  }
}
@keyframes podium-drop {
  from {
    opacity: 0;
    transform: translateY(-22px);
  }
}
@keyframes crown-pop {
  0% {
    opacity: 0;
    transform: translateY(8px) scale(0.3) rotate(-30deg);
  }
  100% {
    opacity: 1;
  }
}
@keyframes row-in {
  from {
    opacity: 0;
    transform: translateX(-18px);
  }
}
@keyframes mine-glow {
  50% {
    box-shadow: 0 0 0 4px rgba(31, 117, 255, 0.35), 0 0 18px rgba(31, 117, 255, 0.45);
  }
}
@media (prefers-reduced-motion: reduce) {
  .podium-block,
  .podium-avatar,
  .podium-name,
  .podium-points,
  .winner-crown,
  .challenge-rows li {
    animation: none;
  }
  .challenge-rows li.mine {
    animation: mine-glow 900ms ease-in-out 2;
  }
}
</style>
