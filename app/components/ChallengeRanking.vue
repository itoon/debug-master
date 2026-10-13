<template>
  <section
    v-show="!hideEmpty || !empty || placeholder"
    class="challenge-ranking"
    :class="{
      space: variant === 'space',
      'with-podium': podium,
      'with-credits': credits,
      'with-placeholder': placeholder
    }"
    :aria-labelledby="headingId"
  >
    <div class="ranking-heading">
      <h3 :id="headingId">{{ t('home.today') }}</h3>
    </div>
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
      </div>
      <div
        ref="creditsViewport"
        class="credits-viewport"
        :class="{ dragging: isDragging }"
        :tabindex="credits ? 0 : undefined"
        :role="credits ? 'region' : undefined"
        :aria-label="credits ? t('ranking.readScores') : undefined"
        @click.stop="focusForInput"
        @wheel.passive="pauseForInput"
        @pointerdown="beginManualDrag"
        @pointermove="moveManualDrag"
        @pointerup="endManualDrag"
        @pointercancel="endManualDrag"
        @lostpointercapture="endManualDrag"
      >
        <ol ref="creditsContent" class="challenge-rows">
          <li
            v-for="(score, index) in rows"
            :key="score.id"
            :class="[
              { podium: index < 3, mine: score.id === highlightId },
              `place-${index + 1}`
            ]"
          >
            <span
              class="rank-number"
              :aria-label="t('ranking.rank', { rank: index + 1 })"
              >{{ index + 1 }}</span
            >
            <img
              class="row-avatar"
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
            <span v-if="score.id === highlightId" class="you">{{
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
          :src="variant === 'space' ? codiHappy : PLAYER_SPRITES.down"
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
import type { RankingBoard } from '../utils/ranking'
import { formatClock } from '../utils/ranking'
import { PLAYER_SPRITES } from '../utils/playerSprites'
import { useScoreBoard } from '../composables/useScoreBoard'
import { useGameI18n } from '../composables/useGameI18n'
import codiHappy from '~/assets/sprites/cody-happy.webp'
import { useLeaderboardCredits } from '../composables/useLeaderboardCredits'
import { usePlayerAvatar } from '../composables/usePlayerAvatar'

const props = withDefaults(
  defineProps<{
    repository: ScoreRepository
    board: RankingBoard
    highlightId?: string
    variant?: 'light' | 'space'
    podium?: boolean
    credits?: boolean
    paused?: boolean
    hideEmpty?: boolean
    /** Show the podium and open places even before anyone has played today. */
    placeholder?: boolean
  }>(),
  {
    variant: 'light',
    podium: false,
    credits: false,
    paused: false,
    hideEmpty: false,
    placeholder: false
  }
)
const emit = defineEmits<{
  viewportRemoved: []
  emptyChange: [empty: boolean]
}>()
const { t } = useGameI18n()
const headingId = useId()
const { rows, error, loaded } = useScoreBoard(
  props.repository,
  computed(() => props.board)
)
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
.credits-viewport {
  min-height: 0;
}
.with-credits .credits-viewport {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.45) transparent;
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
@supports selector(::-webkit-scrollbar) {
  .with-credits .credits-viewport {
    scrollbar-width: auto;
    scrollbar-color: auto;
  }
  .credits-viewport::-webkit-scrollbar {
    width: 6px;
    height: 6px;
    background: transparent;
  }
  .credits-viewport::-webkit-scrollbar-track,
  .credits-viewport::-webkit-scrollbar-corner {
    background: transparent;
  }
  .credits-viewport::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: rgba(156, 163, 175, 0.45);
  }
  .credits-viewport::-webkit-scrollbar-thumb:hover {
    background: rgba(156, 163, 175, 0.65);
  }
  .credits-viewport::-webkit-scrollbar-button {
    display: none;
    width: 0;
    height: 0;
  }
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
</style>
