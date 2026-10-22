<template>
  <div class="app-shell" :class="{ 'home-flow-shell': homeConfig.enabled && (showSetup || showTutorial || (showRanking && !showSummary)) }" @click="playUiClick">
    <Transition v-if="homeConfig.enabled && showSetup && pendingPracticeIntro === null" name="sleep-switch" mode="out-in" :duration="homeTransitionDuration" @after-enter="focusHomeAfterWake">
      <HomeSleepScreen v-if="homeSleeping" key="home-sleep" @wake="wakeHome" @unlock-audio="unlockAudio" />
      <HomeV2 v-else ref="homeView" :key="homeResetKey" :entering="homeEntering"
        :repository="repositories.scores" :modes-repository="repositories.modes" :error="homeStorageError" :busy="homeStarting" @start="prepareChallenge" @resume="resumeChallenge" @reset-error="homeStorageError = ''"
        @unlock-audio="unlockAudio" @sound="playSound" @practice="openPracticePicker" @sleep="showHomeSleep" />
    </Transition>
    <ResumeSessionDialog v-if="resumeSessionId" :session-id="resumeSessionId" @resume="resumeStoredSession" @start-new="dismissStoredSession" />
    <ScoringSaveDialog v-if="competition.saveError.value && !practiceActive && !liveMode" :busy="retryingCheckpoint" @retry="retryScoreSave" @leave="leaveFailedSession" />
    <PracticeLevelDialog v-if="showPracticePicker" :levels="practiceLevels" :selected-level="practiceActive ? currentLevel.id : selectedLevelDraft" :busy="practiceStarting" @close="closePracticePicker" @select="requestPracticeLevel" />
    <PracticeSummaryDialog v-if="practiceSummary" :result="practiceSummary" @home="backToStart" />
    <SessionPanel v-if="pendingPracticeIntro !== null || (activeChallenge && (showTutorial || showSummary || showRanking))"
      :stage="pendingPracticeIntro !== null || showTutorial ? 'tutorial' : showSummary ? 'summary' : 'ranking'"
      :mode="activeChallenge ?? undefined" :practice-intro-count="pendingPracticeIntro !== null ? practiceLevels.length : undefined" :repository="repositories.scores" :board="rankingBoard"
      :result="summaryScore" :saved="scoreSaved" :saving="scoreSaving" :storage-error="scoreStorageError" :show-summary-rank="showSummaryRank"
      @play="startFromTutorial" @home="backFromTutorial" @ranking="showChallengeRanking" @retry="retryScoreSave" />
    <ExitConfirmDialog v-if="showExitConfirm" :practice="practiceActive" :live="liveMode" @cancel="showExitConfirm = false" @confirm="confirmExit" />
    <PlayerSetupDialog v-if="liveMode && liveStage === 'setup'" :mode="liveSetupMode" :initial="liveSetupInitial" @start="liveJoin" @close="liveGoHome" />
    <LivePlayerPanel v-if="liveMode && liveStage !== 'setup' && liveStage !== 'running'" :stage="liveStage" :state="liveState" :self-id="liveSelfId"
      :countdown="liveCountdown" :queue-remaining-sec="liveQueueRemaining" :late-score-note="liveLateScore"
      @change-player="liveChangePlayer" @leave="liveLeave" @home="liveGoHome" />
    <div v-if="liveMode && ['running', 'countdown', 'results'].includes(liveStage) && liveSyncStatus !== 'ready'" class="live-sync-note" role="status" aria-live="polite">
      {{ liveSyncText }}
      <button v-if="liveSyncStatus === 'storage-error' || liveSyncStatus === 'reload-required'" type="button" @click="liveReload">{{ t('live.reload') }}</button>
    </div>
    <main v-show="!showSetup && !showTutorial && !(activeChallenge && showRanking && !showSummary) && (!liveMode || liveStage === 'running')" class="game">
      <section class="board-panel">
        <GameHud :level="currentLevel" :language="languageLabel"
          :practice="practiceActive" :difficulty="practiceActive ? t('practice.badge') : activeChallenge ? t(`difficulty.${activeChallenge.id}`) : modeLabel"
          :player-name="playerName" :avatar-id="currentAvatarId"
          :timed="isTimedMode" :time="formattedTime" :score="totalScore"
          :progress="progressLabel"
          :completed-levels="hudProgressValue" :total-levels="deadRun ? 0 : activeLevels.length"
          :lives="deadRun ? livesLeft : undefined" :max-lives="DEAD_LIVES"
          :time-low="isTimedMode && campaignStarted && timerRemaining > 0 && timerRemaining <= 30" :live-rank="liveRank">
          <template #actions>
            <button type="button" class="practice-map-button soft-button small" :disabled="practiceStarting" aria-haspopup="dialog" :aria-label="t('practice.chooseButton', { count: practiceLevels.length })" @click="openPracticePicker"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15" /></svg><span class="practice-label-full">{{ t('practice.chooseButton', { count: practiceLevels.length }) }}</span><span class="practice-label-short" aria-hidden="true">{{ t('practice.chooseShort') }}</span></button>
            <button type="button" class="soft-button small superhint-button" :class="{ 'hint-enabled': practiceSuperHint }" :disabled="practiceStarting" :aria-pressed="practiceSuperHint" :aria-label="t(practiceSuperHint ? 'practice.hidePath' : 'practice.showPath')" @click="practiceSuperHint = !practiceSuperHint"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m8 7-5 5 5 5m8-10 5 5-5 5M13 5l-2 14" /></svg>{{ t('practice.superHint') }}<span class="hint-check" aria-hidden="true">{{ practiceSuperHint ? '✓' : '' }}</span></button>
          </template>
        </GameHud>
        <p v-if="practiceActive" class="sr-only" role="status">{{ t(practiceSuperHint ? practiceHintSolution?.error ? 'practice.pathError' : 'practice.pathGuide' : status === 'completed' ? 'practice.completed' : 'practice.noRanking') }}<template v-if="practiceSuperHint && canControl && expectedMove"> · {{ t('practice.nextMove', { direction: t(`game.${expectedMove.direction}`) }) }}</template></p>


        <div class="play-cluster">
          <div class="board-wrap">
            <div
              v-if="notificationMessage && status !== 'success'"
              class="notification"
              :class="`notification-${status}`"
              role="alert"
            >
              <strong>{{ notificationTitle }}</strong>
              <p>{{ notificationMessage }}</p>
            </div>
            <div v-if="practiceActive && (status === 'success' || status === 'completed')" :key="`practice-pass-${boardRound}`"
              class="notification notification-success practice-success-notice" role="status">
              <strong>✓ {{ t('practice.passed') }}</strong>
            </div>
            <p v-if="practiceSuperHint && practiceActive && practiceHintSolution?.error && !notificationMessage" class="notification" role="alert">{{ t('practice.pathError') }}</p>
            <div class="board-and-controls">
              <p class="board-combo" :role="practiceActive ? 'status' : undefined"><span v-if="practiceActive && (status === 'success' || status === 'completed')" class="practice-passed">✓ {{ t('practice.passed') }}</span><span v-else-if="!practiceActive && comboStreak > 1" :key="comboStreak" class="combo-pop" :class="{ 'combo-hot': comboStreak >= 5 }">{{ t('game.comboDisplay', { count: comboStreak }) }}</span></p>
              <div ref="boardViewportEl" class="board-viewport game-scrollbar" role="region" :aria-label="t('game.boardViewport', { level: currentLevel.id })" tabindex="0"
                @pointerdown.passive="cancelBoardFollow" @touchstart.passive="cancelBoardFollow" @wheel.passive="cancelBoardFollow">
              <LevelBoard
                :key="boardRound"
                :level="currentLevel"
                :space="boardSpace"
                :max-cell-size="160"
                :shattering="boardShattering"
                cascade
              >
                <BoardSuperHint v-if="practiceSuperHint && practiceActive && !practiceStarting && ['playing', 'success', 'completed'].includes(status) && !practiceHintSolution?.error" :key="currentLevel.id" :path="practiceHintSolution?.path ?? []" :completed-moves="levelCorrectInputs" />
                <div
                  v-if="wrapExit"
                  :key="`exit-${wrapExit.id}`"
                  class="actor wrap-exit"
                  :style="{ '--x': wrapExit.col, '--y': wrapExit.row, '--wrap-dx': wrapExit.dx, '--wrap-dy': wrapExit.dy }"
                  aria-hidden="true"
                  @animationend.self="wrapExit = null"
                >
                  <img class="player-sprite" :src="codiSprite" alt="" draggable="false" />
                </div>
                <div
                  class="actor"
                  :class="[`actor-${status}`, { warp: playerWarped }]"
                  :style="actorStyle"
                  aria-hidden="true"
                >
                  <span v-if="playerHop" :key="`dust-${playerHop}`" class="landing-dust"><i /><i /></span>
                  <span v-if="status === 'success' || status === 'completed'" class="clear-burst"><i v-for="ray in 8" :key="ray" :style="{ '--ray': ray }" /></span>
                  <div :key="playerHop" class="hop" :class="{ 'wrap-in': wrapExit }"
                    :style="wrapExit ? { '--wrap-dx': wrapExit.dx, '--wrap-dy': wrapExit.dy } : undefined">
                    <img
                      class="player-sprite"
                      :src="codiSprite"
                      alt=""
                      draggable="false"
                    />
                  </div>
                  <NextMoveHint v-if="((practiceActive && practiceSuperHint) || mobileGuidance) && canControl && !showExitConfirm && expectedMove" :direction="expectedMove.direction" />
                </div>
              </LevelBoard>
              </div>
              <div ref="controlsEl" class="board-footer">
                <!-- On phones and tablets these system buttons move up into the HUD so
                     they never sit beside the D-pad under the player's thumb. -->
                <Teleport to="#game-hud-system" defer :disabled="!compactLayout">
                <nav class="game-actions" :aria-label="t('game.actions')">
                  <button type="button" class="hud-action sound-toggle" :aria-pressed="soundEnabled" :aria-label="t('game.soundEffects')"
                    :title="t(soundEnabled ? 'game.mute' : 'game.unmute')" @click="toggleSound">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" /><path v-if="soundEnabled" d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /><path v-else d="m17 9 5 6m0-6-5 6" /></svg>
                  </button>
                  <button v-if="!campaignStarted && !practiceActive && !liveMode" type="button" class="hud-action primary-button small"
                    :disabled="status === 'playing' || campaignStarted"
                    @click="startGame">{{ t('game.start') }} <span aria-hidden="true">▶</span></button>
                  <button v-if="liveMode" type="button" class="hud-action soft-button small live-reset" :disabled="!canControl" @click="restartLevel">{{ t('practice.restart') }}</button>
                  <button v-if="!liveMode || compactLayout" type="button" class="hud-action soft-button small exit-action" :class="{ 'live-only-exit': liveMode }"
                    :disabled="scoreSaving || practiceStarting"
                    :aria-label="liveMode ? t('live.leave') : campaignStarted ? t('game.exit') : t('game.menu')"
                    :title="liveMode ? t('live.leave') : campaignStarted ? t('game.exitHint') : undefined"
                    @click="requestExit"><svg class="exit-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 4H4v16h5m6-12 4 4-4 4M8 12h11" /></svg><span class="exit-text">{{ campaignStarted ? t('game.exit') : t('game.menu') }}</span></button>
                </nav>
                </Teleport>
                <div class="touch-controls" :aria-label="t('game.controls')">
                <button type="button" class="arrow up" data-direction="up" :class="{ 'guided-arrow': mobileGuidedMove === 'up' }" :disabled="!canControl" :aria-label="t('game.up')" aria-keyshortcuts="ArrowUp W" @click="controlMove('up')">▲<TouchTapHint v-if="mobileGuidedMove === 'up'" /></button>
                <button type="button" class="arrow left" data-direction="left" :class="{ 'guided-arrow': mobileGuidedMove === 'left' }" :disabled="!canControl" :aria-label="t('game.left')" aria-keyshortcuts="ArrowLeft A" @click="controlMove('left')">◀<TouchTapHint v-if="mobileGuidedMove === 'left'" /></button>
                <button type="button" class="arrow down" data-direction="down" :class="{ 'guided-arrow': mobileGuidedMove === 'down' }" :disabled="!canControl" :aria-label="t('game.down')" aria-keyshortcuts="ArrowDown S" @click="controlMove('down')">▼<TouchTapHint v-if="mobileGuidedMove === 'down'" /></button>
                <button type="button" class="arrow right" data-direction="right" :class="{ 'guided-arrow': mobileGuidedMove === 'right' }" :disabled="!canControl" :aria-label="t('game.right')" aria-keyshortcuts="ArrowRight D" @click="controlMove('right')">▶<TouchTapHint v-if="mobileGuidedMove === 'right'" /></button>
                </div>
              </div>
            </div>
          </div>

          <LevelCode
            :class="{ 'python-code': displayLanguage === 'python' }"
            :level="currentLevel"
            :language="displayLanguage"
            :title="t('game.readCode', { language: languageLabel })"
            :readable="true"
            scroll-hint
            :is-active-line="isGameCodeLineActive"
            :follow-active-line="(practiceActive && practiceSuperHint) || mobileGuidance"
            :teaching-guidance="practiceActive || mobileGuidance"
            :executed-step="executedCodeStep ?? undefined"
            :follow-executed="compactLayout && displayLanguage === 'python' && !mobileGuidance"
            :follow-upcoming="followMobileViewports && displayLanguage === 'python'"
            :upcoming-line="expectedMove?.sourceLine"
          />
        </div>

        <transition name="score-pop">
          <div v-if="scorePopup && !practiceActive" :key="scorePopupId" class="score-popup" role="status" aria-live="polite">
            <strong>+{{ scorePopup.points.toLocaleString('th-TH') }}</strong>
            <span>{{ '★'.repeat(scorePopup.stars) }} · {{ t('scoring.stars', { count: scorePopup.stars }) }}</span>
          </div>
        </transition>

        <section v-if="debugMode && !practiceActive" class="debug-card">
          <div class="metric-grid">
            <div>
              <span>{{ t('debug.position') }}</span
              ><strong>[{{ player.row }}, {{ player.col }}]</strong>
            </div>
            <div>
              <span>{{ t('game.tile') }}</span><strong>{{ tileKindLabel(currentTile) }}</strong>
            </div>
            <div>
              <span>{{ t('debug.step') }}</span><strong>{{ executionSteps }}</strong>
            </div>
            <div>
              <span>{{ t('debug.inputs') }}</span><strong>{{ playerInputs }}</strong>
            </div>
          </div>
          <p class="debug-note">{{ feedbackMessage }}</p>
          <button type="button" class="soft-button" @click="showNextHint">
            {{ t('practice.hint') }}
          </button>
          <div v-if="revealedHints.length" class="hint-list">
            <p v-for="hint in revealedHints" :key="hint">{{ hint }}</p>
          </div>
        </section>

      </section>
    </main>

    <!-- Dev's setup and four legacy modes stay available behind the config flag. -->
    <div v-if="showSetup && !homeConfig.enabled" class="landing">
      <header class="landing-top">
        <p class="landing-brand">CodeVenture · Debug Master</p>
        <p class="landing-tagline">อ่านโค้ด · คิด · เดินไปกับ Codi</p>
      </header>

      <div class="landing-grid">
        <TodayRanking
          class="landing-card landing-ranking"
          :scores="scores"
          :board="rankingBoard"
          :subtitle="rankingSubtitle"
        />

        <form
          class="landing-card setup-card"
          aria-labelledby="setup-title"
          @submit.prevent="startGame"
        >
          <div class="setup-hero">
            <img
              class="setup-codi"
              :src="PLAYER_SPRITES.down"
              alt=""
              draggable="false"
            />
            <div>
              <h2 id="setup-title">ผจญภัยกับ Codi</h2>
              <p>{{ t('game.setupInstruction', { language: languageName }) }}</p>
            </div>
          </div>

          <label class="field">
            <span>ชื่อเล่น</span>
            <input
              id="player-name"
              v-model.trim="playerNameDraft"
              type="text"
              maxlength="24"
              placeholder="ชื่อที่ใช้แสดงอันดับ"
              autocomplete="nickname"
              required
            />
          </label>

          <fieldset class="choice-group">
            <legend>เลือกอายุ</legend>
            <div class="age-grid">
              <button
                v-for="age in PLAYER_AGES"
                :key="age"
                type="button"
                class="age-chip"
                :class="{ selected: playerAgeDraft === age }"
                :aria-pressed="playerAgeDraft === age"
                @click="playerAgeDraft = age"
              >
                {{ age }} ปี
              </button>
            </div>
          </fieldset>

          <fieldset class="choice-group">
            <legend>เลือกวิธีเล่น · อันดับด้านข้างเปลี่ยนตามนี้</legend>
            <div class="mode-cards">
              <label
                v-for="option in MODE_OPTIONS"
                :key="option.id"
                class="mode-card"
                :class="{ selected: selectedMode === option.id }"
              >
                <input
                  v-model="selectedMode"
                  class="visually-hidden"
                  type="radio"
                  name="mode"
                  :value="option.id"
                />
                <strong>{{ option.title }}</strong>
                <small>{{ option.hint }}</small>
              </label>
            </div>
          </fieldset>

          <label v-if="selectedMode === 'timer'" class="field narrow">
            <span>เวลา (นาที)</span>
            <input
              id="timer-minutes"
              v-model.number="customMinutes"
              type="number"
              min="1"
              max="60"
            />
          </label>

          <label v-if="selectedMode !== 'dead'" class="field narrow">
            <span>ชุดโจทย์</span>
            <select id="level-set" v-model="selectedSetId">
              <option v-for="set in allSets" :key="set.id" :value="set.id">
                {{ set.title }}
              </option>
            </select>
          </label>

          <fieldset v-if="selectedMode === 'campaign'" class="level-picker">
            <legend>เลือกด่านเริ่ม</legend>
            <p class="level-picker-note">
              ด่าน {{ selectedLevelDraft.toString().padStart(2, "0") }} ·
              {{ campaignLevelConcept }}
            </p>
            <div class="level-grid" role="listbox" aria-label="เลือกด่าน">
              <button
                v-for="level in activeLevels"
                :key="level.id"
                type="button"
                class="level-chip"
                :class="{ selected: selectedLevelDraft === level.id }"
                role="option"
                :aria-selected="selectedLevelDraft === level.id"
                :aria-label="`ด่าน ${level.id}`"
                @click="selectedLevelDraft = level.id"
              >
                {{ level.id.toString().padStart(2, "0") }}
              </button>
            </div>
          </fieldset>

          <details class="more-options">
            <summary>ตัวเลือกเพิ่มเติม</summary>
            <div class="more-options-body">
              <div class="segmented" role="radiogroup" aria-label="รูปแบบโค้ด">
                <label
                  v-for="option in codeLanguageOptions"
                  :key="option.id"
                  :class="{ selected: selectedLanguageDraft === option.id }"
                >
                  <input
                    v-model="selectedLanguageDraft"
                    class="visually-hidden"
                    type="radio"
                    name="language"
                    :value="option.id"
                  />
                  {{ option.title }}
                </label>
              </div>
              <label class="debug-toggle">
                <input v-model="debugModeDraft" type="checkbox" />
                <span
                  ><strong>Debug Mode</strong
                  ><small>ดู Position, Tile, Step, Input และ Hint ระหว่างเล่น</small></span
                >
              </label>
            </div>
          </details>

          <p class="privacy-note">
            ชื่อเล่นและอายุใช้จัดอันดับในเครื่องนี้เท่านั้น ผู้จัดลบข้อมูลหลังงาน
            ไม่ต้องใช้ชื่อจริง
          </p>

          <div class="start-row">
            <p v-if="!canStart" class="start-hint">กรอกชื่อเล่นเพื่อเริ่มเล่น</p>
            <button type="submit" class="primary-button start-button" :disabled="!canStart">
              เริ่มเล่น
            </button>
          </div>
        </form>
      </div>

      <p class="landing-links">
        สำหรับทีม: <NuxtLink to="/review">คลังโจทย์</NuxtLink> ·
        <NuxtLink to="/elements">Elements</NuxtLink>
      </p>
    </div>

    <section
      v-if="showRanking && !activeChallenge && !practiceActive"
      class="overlay"
      role="dialog"
      aria-modal="true"
      aria-label="อันดับวันนี้"
    >
      <div class="ranking-card">
        <TodayRanking
          :scores="scores"
          :board="rankingBoard"
          :subtitle="rankingSubtitle"
          :highlight-id="lastScoreId"
        />
        <div class="ranking-actions">
          <button type="button" class="soft-button" @click="showRanking = false">
            ปิด
          </button>
          <button type="button" class="primary-button" @click="backToStart">
            กลับหน้าแรก
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { levelSets } from "../data/level-sets";
import { challengeSets } from "../data/challenge-groups";
import { tileKindLabel, type BoardSpace } from "../composables/useBoardPresentation";
import { useProgramParser } from "../composables/useProgramParser";
import type {
  Direction,
  GameStatus,
  Mode,
  MoveNode,
  Node,
  PracticeSummary,
  Score,
  ScorePopup,
} from "../types/debug-game";
import {
  CODE_LANGUAGE_OPTIONS,
  type CodeLanguage,
} from "../utils/codeLanguage";
import {
  createRunState,
  runUntilMove,
  solveLevel,
  stepPosition,
  type RunState,
} from "../utils/programRunner";
import {
  generateLevel,
  newRunSeed,
  type GeneratedLevel,
} from "../utils/levelGen";
import { PLAYER_AGES, scorePlayerKey, hasRankingScore, type RankingBoard } from "../utils/ranking";
import { nicknameKey } from "../utils/playerNickname";
import { newPlayerId } from "../utils/playerIdentity";
import { createViewportScroller } from "../utils/viewportScroll";
import { PLAYER_SPRITES, PLAYER_POSES, START_FACING } from "../utils/playerSprites";
import { DEFAULT_COMPETITION_CONFIG, enabledModesFor, homeConfig, type ChallengeMode, type ModeScoringStrategies } from "../data/home-config";
import { useGameI18n } from "../composables/useGameI18n";
import { createLocalRepositories } from "../storage/LocalStorageAdapter";
import { useCompetitionSession } from "../composables/useCompetitionSession";
import { competitionLevelKey, toScore } from "../utils/competition/session";
import type { SessionReceipt } from "../types/competition";
import type { PlayerSetupInput } from "../storage/contracts";
import { isPlayerAvatarId, PLAYER_AVATARS } from "../data/player-avatars";
import { useGameAudio } from "../composables/useGameAudio";
import { useGameTouchControls } from "../composables/useGameTouchControls";
import { useLiveConfig, useLiveRoom, type LiveRoom } from "../composables/useLiveRoom";
import { livePlayerId, resetLivePlayerId } from "../utils/live/identity";
import { clearLiveSession, loadLiveSession, saveLiveSession } from "../utils/live/session";
import { derivePlayerStage } from "../utils/live/playerStage";
import { countdownSec, remainingSec, serverTime } from "../utils/live/clock";
import { takeInitialSearch } from "../utils/live/initialSearch";
import { roomCodeFromSearch, type PlayerHello, type RoomState } from "../utils/live/protocol";
import LivePlayerPanel from "../components/live/LivePlayerPanel.vue";

const { t } = useGameI18n();
const { enabled: soundEnabled, unlockAudio, playSound, stopSounds, toggleSound } = useGameAudio();
const repositories = createLocalRepositories();
const competition = useCompetitionSession(repositories.sessions);
const resumeSessionId = ref<string>();
const retryingCheckpoint = ref(false);
let checkpointWrite: Promise<SessionReceipt | undefined> = Promise.resolve(undefined);
let completionFeedback: ScorePopup | null = null;
let finishingSession: Promise<void> | undefined;
const allSets = [...levelSets, ...challengeSets];
const activeChallenge = ref<ChallengeMode | null>(null);
const currentPlayerId = ref("");
const currentAvatarId = ref<string | undefined>(undefined);
const homeResetKey = ref(0);
const homeSleeping = ref(true); // Only initial page entry and the manual Home button set this true.
const homeEntering = ref(false);
const homeTransitionDuration = computed(() => {
  const sleeping = homeSleeping.value;
  const still = import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    enter: still ? 0 : sleeping ? 220 : homeConfig.sleepScreen.cardInMs + homeConfig.sleepScreen.cardStaggerMs * (homeConfig.modes.length - 1) + homeConfig.sleepScreen.entryBufferMs,
    leave: still ? 0 : sleeping ? 220 : homeConfig.sleepScreen.transitionMs,
  };
});
const homeView = ref<{ focusFirstMode: () => Promise<void> } | null>(null);
let focusAfterWake = false;
const showTutorial = ref(false);
const pendingPracticeIntro = ref<number | null>(null);
const practiceTeachingLevels = shallowRef<number[]>([]);
const showSummary = ref(false);
const showExitConfirm = ref(false);
const practiceActive = ref(false);
const showPracticePicker = ref(false);
const practiceStarting = ref(false);
const practiceSuperHint = ref(false);
const practiceSummary = ref<PracticeSummary | undefined>();
const practiceSessionStartedAt = ref<number | null>(null);
const practicePassedLevels = ref(new Set<number>());
const practiceMistakes = ref(0);
const homeStarting = ref(false);
const scoreSaving = ref(false);
let sessionToken = 0;
let homeAfterSave = false;
const practiceSet = levelSets.find((set) => set.id === homeConfig.practice.levelSetId)!;
const practiceLevels = practiceSet.levels;
let practiceLaunchToken = 0;
let practiceLaunchButton: HTMLElement | null = null;
const summaryScore = ref<Score | undefined>();
const showSummaryRank = computed(() => !!summaryScore.value && hasRankingScore(summaryScore.value));
const scoreSaved = ref(false);
const homeStorageError = ref("");
const scoreStorageError = ref(false);
let lastInteractionAt = Date.now();
let idleTimer: ReturnType<typeof setInterval> | undefined;
let unsubscribeScores: (() => void) | undefined;

const showSetup = ref(true);
const showRanking = ref(false);
const selectedMode = ref<Mode>("ranking");
const selectedSetId = ref(levelSets[0]?.id ?? "set-01");
const playerNameDraft = ref("");
const playerAgeDraft = ref<number | null>(null);
const playerAge = ref<number | undefined>(undefined);
const playerName = ref("");
const customMinutes = ref(10);
const debugModeDraft = ref(false);
const debugMode = ref(false);
const selectedLanguageDraft = ref<CodeLanguage>("python");
const codeLanguage = ref<CodeLanguage>("python");
const codeLanguageOptions = CODE_LANGUAGE_OPTIONS;
const displayLanguage = computed(() =>
  showSetup.value ? selectedLanguageDraft.value : codeLanguage.value,
);

const selectedLevelIndex = ref(0);
const selectedLevelDraft = ref(1);
const activeSet = computed(
  () => allSets.find((set) => set.id === selectedSetId.value) ?? levelSets[0],
);
// Dead Mode: levels are generated one at a time while the run goes on
// (utils/levelGen). Every other mode plays the selected level set.
const deadRun = ref<{ seed: number; levels: GeneratedLevel[] } | null>(null);
// Lives in Dead Mode: a mistake costs one and replays the level.
const DEAD_LIVES = 5;
const livesLeft = ref(DEAD_LIVES);
const activeLevels = computed(
  () => deadRun.value?.levels ?? activeSet.value.levels,
);
const currentLevel = computed(
  () => activeLevels.value[selectedLevelIndex.value] ?? activeLevels.value[0],
);
const { parseProgram } = useProgramParser(() => currentLevel.value.id);
// The board area is measured so tiles scale to fill it (see fitCellSize).
const boardViewportEl = ref<HTMLElement | null>(null);
const boardScroller = createViewportScroller();
let boardFollowGeneration = 0;
function cancelBoardFollow(): void {
  boardFollowGeneration += 1;
  boardScroller.cancel();
}
const controlsEl = ref<HTMLElement | null>(null);
useGameTouchControls(controlsEl, controlMove);
const boardSpace = ref<BoardSpace>({ width: 0, height: 0 });
// Matches the desktop layout query in the styles below; anything smaller is
// the compact (phone/tablet) layout with sound and exit in the HUD.
const compactLayout = ref(false);
let desktopQuery: MediaQueryList | null = null;
const syncCompactLayout = () => { compactLayout.value = !desktopQuery?.matches; };
let boardResizeObserver: ResizeObserver | null = null;

// Junior note:
// `player` is the only mutable board position. Everything else should derive
// from current level + player position so we have one clear source of truth.
const player = reactive({
  row: currentLevel.value.start[0],
  col: currentLevel.value.start[1],
});
// Codi (the board actor) only reads `player`; these refs drive its animation.
const playerHop = ref(0);
// Remounts the board each round so its tiles cascade in after a start, retry or clear.
const boardRound = ref(0);
// Panning a large map never carries into a new level or a fresh attempt.
watch(boardRound, () => {
  cancelBoardFollow();
  if (!boardViewportEl.value) return;
  boardViewportEl.value.scrollTop = 0;
  boardViewportEl.value.scrollLeft = 0;
}, { flush: 'post' });
const playerWarped = ref(false);
// Edge wrap: a copy of Codi slides out past the edge it left while the real
// actor slides in from the opposite edge, so a wrap reads as one ordinary step.
const wrapExit = ref<{ id: number; row: number; col: number; dx: number; dy: number } | null>(null);
const playerFacing = ref<Direction>(START_FACING);
const status = ref<GameStatus>("ready");
const campaignStarted = ref(false);
const notificationMessage = ref("");
const boardShattering = ref(false);
const feedbackMessage = ref("กด Start เพื่อเริ่มเกม");
// Interpreter state for the current level (see utils/programRunner.ts).
let runState: RunState = createRunState({ main: [], functions: {} });
const activeNode = ref<Node | null>(null);
const expectedMove = ref<MoveNode | null>(null);
const executionSteps = ref(0);
const playerInputs = ref(0);
const totalInputs = ref(0);
const completedLevels = ref(0);
const totalScore = ref(0);
const comboStreak = ref(0);
const bestCombo = ref(0);
const revealedHintCount = ref(0);
const scores = ref<Score[]>([]);
const scorePopup = ref<ScorePopup | null>(null);
const scorePopupId = ref(0);
const timerRemaining = ref(0);
const startedAt = ref(0);
const levelStartedAt = ref(0);
const levelCorrectInputs = ref(0);
const executedCodeStep = shallowRef<{ line: number; sequence: number } | null>(null);
let executedCodeSequence = 0;
// Observe accepted inputs before the existing runner clears expectedMove.
// Never advance the interpreter or change input/scoring/timer behavior here.
watch(levelCorrectInputs, (count, previous) => {
  if (count <= previous) return;
  const line = expectedMove.value?.sourceLine;
  if (line) executedCodeStep.value = { line, sequence: ++executedCodeSequence };
}, { flush: 'sync' });
watch(boardRound, () => { executedCodeStep.value = null; }, { flush: 'sync' });
let timerId: ReturnType<typeof setInterval> | null = null;
let levelAdvanceTimer: ReturnType<typeof setTimeout> | null = null;
let scorePopupTimer: ReturnType<typeof setTimeout> | null = null;
let stepTimer: ReturnType<typeof setTimeout> | null = null;
let failAnimationTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

// Start screen: the four ways to play, in display order.
const MODE_OPTIONS: { id: Mode; title: string; hint: string }[] = [
  { id: "ranking", title: "แข่ง 05:00", hint: "เวลาเท่ากันทุกคน" },
  { id: "timer", title: "ท้าทายเวลา", hint: "เลือกเวลาเอง" },
  { id: "campaign", title: "ตะลุยด่าน", hint: "เลือกด่านเริ่ม ไม่จับเวลา" },
  { id: "dead", title: "Dead Mode", hint: "ด่านสุ่ม มี 5 หัวใจ" },
];
const RANKING_SECONDS = 300;
const canStart = computed(() => playerNameDraft.value.length > 0);
const languageName = computed(
  () => codeLanguageOptions.find((option) => option.id === selectedLanguageDraft.value)?.title,
);
const timeLimitSec = computed(() => {
  if (activeChallenge.value) return activeChallenge.value.timeLimit;
  if (selectedMode.value === "ranking") return RANKING_SECONDS;
  if (selectedMode.value === "timer") return Math.max(1, customMinutes.value) * 60;
  return undefined;
});
// Which leaderboard applies to the current choices (start screen and the
// end-of-game dialog both show this one).
const rankingBoard = computed<RankingBoard>(() => summaryScore.value ? {
  challengeId: summaryScore.value.challengeId, setId: summaryScore.value.setId,
  mode: summaryScore.value.mode, timeLimitSec: summaryScore.value.timeLimitSec,
  difficulty: summaryScore.value.difficulty, scoringStrategy: summaryScore.value.scoringStrategy,
} : ({
  challengeId: activeChallenge.value?.challengeId,
  setId: selectedMode.value === "dead" ? "dead" : selectedSetId.value,
  mode: selectedMode.value,
  timeLimitSec: timeLimitSec.value,
  difficulty: activeChallenge.value?.difficulty ?? DEFAULT_COMPETITION_CONFIG.difficulty,
  scoringStrategy: activeChallenge.value?.scoringStrategy ?? DEFAULT_COMPETITION_CONFIG.scoringStrategy,
}));
const rankingSubtitle = computed(() => {
  const setTitle = activeSet.value.title;
  if (selectedMode.value === "dead") return "Dead Mode · ด่านสุ่ม 5 หัวใจ";
  if (selectedMode.value === "ranking") return `${setTitle} · แข่งเวลา · 05:00`;
  if (selectedMode.value === "timer")
    return `${setTitle} · ท้าทายเวลา · ${Math.max(1, customMinutes.value)} นาที`;
  return `${setTitle} · ตะลุยด่าน`;
});
const lastScoreId = ref("");
const isTimedMode = computed(
  () => selectedMode.value === "timer" || selectedMode.value === "ranking",
);
const hudProgressValue = computed(() => practiceActive.value ? currentLevel.value.id : completedLevels.value);
const progressLabel = computed(() =>
  deadRun.value
    ? `ผ่าน ${completedLevels.value} ด่าน`
    : `${hudProgressValue.value}/${activeLevels.value.length}`,
);
const modeLabel = computed(() => {
  if (selectedMode.value === "dead") return "Dead Mode";
  if (selectedMode.value === "campaign") return "ตะลุยด่าน";
  if (selectedMode.value === "ranking") return "Ranking 5:00";
  return `${customMinutes.value} min`;
});
const languageLabel = computed(() =>
  displayLanguage.value === "js" ? "JavaScript" : "Python",
);
// Dead Mode ends when the hearts run out (see endDeadRun).
const isDeadRunOver = computed(
  () => Boolean(deadRun.value) && status.value === "failed" && !campaignStarted.value,
);
const statusLabel = computed(() =>
  isDeadRunOver.value
    ? "Game over"
    : {
        ready: "Ready",
        playing: "Control",
        success: "Correct",
        failed: "Restart",
        timeup: "Time up",
        completed: "Done",
      }[status.value],
);
const notificationTitle = computed(() => {
  if (isDeadRunOver.value) return t("game.gameOver");
  if (status.value === "failed") return t("game.retryTitle");
  if (status.value === "timeup") return t("game.timeUpTitle");
  if (status.value === "success") return t("game.correctTitle");
  return t("game.notificationTitle");
});
const canControl = computed(
  () => (practiceActive.value || (liveMode.value ? liveCanInput.value : !competition.busy.value)) && !showExitConfirm.value && !showPracticePicker.value && !practiceSummary.value && !practiceStarting.value && status.value === "playing" && Boolean(expectedMove.value),
);
const codiSprite = computed(() =>
  status.value === "failed" || status.value === "timeup"
    ? PLAYER_POSES.failed
    : PLAYER_SPRITES[playerFacing.value],
);
const actorStyle = computed(() => ({
  "--x": player.col,
  "--y": player.row,
}));
const currentTile = computed(
  () => currentLevel.value.map[player.row]?.[player.col] ?? "n",
);
const practiceHintSolution = computed(() => {
  if (!practiceActive.value || !practiceSuperHint.value) return null;
  try {
    return solveLevel(currentLevel.value, parseProgram(currentLevel.value.code));
  } catch {
    return { path: [], error: 'Invalid hint program' };
  }
});
const campaignLevelConcept = computed(() => {
  const level =
    activeLevels.value[
      Math.max(
        0,
        Math.min(activeLevels.value.length - 1, selectedLevelDraft.value - 1),
      )
    ];
  return level?.concept ?? "";
});
const formattedTime = computed(() => formatClock(timerRemaining.value));
const revealedHints = computed(() =>
  [
    t('debug.concept', { concept: currentLevel.value.concept }),
    currentLevel.value.learningObjective ||
      t("game.readAndMove"),
    expectedMove.value
      ? t('debug.nextMove', { direction: expectedMove.value.direction })
      : t('debug.branchHint'),
  ].slice(0, revealedHintCount.value),
);
async function startGame(): Promise<void> {
  if (competition.busy.value && !practiceActive.value && !liveMode.value) return;
  const token = sessionToken;
  finishingSession = undefined;
  checkpointWrite = Promise.resolve(undefined);
  completionFeedback = null;
  summaryScore.value = undefined;
  unlockAudio(); // Called from a player gesture; no autoplay on page load.
  // Copy setup modal values into live game state once, right before a run.
  playerName.value = playerNameDraft.value || "Player";
  playerAge.value = playerAgeDraft.value ?? undefined;
  debugMode.value = debugModeDraft.value;
  codeLanguage.value = selectedLanguageDraft.value;
  showSetup.value = false;
  showRanking.value = false;
  if (selectedMode.value === "dead") {
    const seed = newRunSeed();
    deadRun.value = { seed, levels: [generateLevel(seed, 0)] };
    livesLeft.value = DEAD_LIVES;
  } else {
    deadRun.value = null;
  }
  if (selectedMode.value === "campaign") {
    const levelIndex = Math.max(
      0,
      Math.min(activeLevels.value.length - 1, selectedLevelDraft.value - 1),
    );
    selectedLevelIndex.value = levelIndex;
  } else {
    selectedLevelIndex.value = 0;
  }
  completedLevels.value = 0;
  totalInputs.value = 0;
  totalScore.value = 0;
  comboStreak.value = 0;
  bestCombo.value = 0;
  scorePopup.value = null;
  campaignStarted.value = true;
  startedAt.value = Date.now();
  if (!practiceActive.value && !liveMode.value) {
    currentPlayerId.value ||= newPlayerId();
    const saved = await competition.start({
      id: newPlayerId(), playerId: currentPlayerId.value, name: playerName.value,
      avatarId: currentAvatarId.value, age: playerAge.value, challengeId: activeChallenge.value?.challengeId,
      setId: deadRun.value ? 'dead' : activeSet.value.id,
      setTitle: deadRun.value ? `Dead Mode (seed ${deadRun.value.seed})` : activeSet.value.title,
      mode: selectedMode.value, language: codeLanguage.value, debug: debugMode.value,
      startedAt: startedAt.value, timeLimitSec: timeLimitSec.value,
      config: { difficulty: activeChallenge.value?.difficulty ?? DEFAULT_COMPETITION_CONFIG.difficulty,
        scoringStrategy: activeChallenge.value?.scoringStrategy ?? DEFAULT_COMPETITION_CONFIG.scoringStrategy },
      checkpoint: { levelIndex: selectedLevelIndex.value, combo: 0, bestCombo: 0, inputs: 0,
        ...(deadRun.value ? { deadSeed: deadRun.value.seed, hearts: DEAD_LIVES } : {}) },
    });
    if (!saved || token !== sessionToken) return;
  }
  beginTimer();
  if (liveMode.value) void restoreLiveBoard();
  else void beginLevel();
}

function backToStart(): void {
  openSetup();
}

function openSetup(): void {
  if (scoreSaving.value) {
    homeAfterSave = true;
    return;
  }
  homeAfterSave = false;
  competition.abandon();
  finishingSession = undefined;
  checkpointWrite = Promise.resolve(undefined);
  showRanking.value = false;
  sessionToken += 1;
  homeStarting.value = false;
  scoreSaving.value = false;
  showExitConfirm.value = false;
  stopSounds();
  stopTimer();
  clearPendingRunTimers();
  clearLevelAdvanceTimer();
  clearScorePopupTimer();
  if (!deadRun.value) selectedLevelDraft.value = currentLevel.value.id;
  deadRun.value = null;
  selectedSetId.value = activeSet.value.id;
  selectedLanguageDraft.value = codeLanguage.value;
  showSetup.value = true;
  campaignStarted.value = false;
  status.value = "ready";
  if (homeConfig.enabled) resetHomeSession();
}

function requestExit(): void {
  if (practiceSummary.value) return;
  if (campaignStarted.value) showExitConfirm.value = true;
  else exitGame();
}

function confirmExit(): void {
  if (!showExitConfirm.value) return;
  showExitConfirm.value = false;
  exitGame();
}

async function exitGame(): Promise<void> {
  if (liveMode.value) return liveLeave();
  if (practiceActive.value) return presentPracticeSummary();
  if (!competition.session.value || competition.session.value.status === 'finished') return openSetup();
  await finishCompetition(Date.now());
}

function leaveFailedSession(): void {
  // Explicit departure cancels pending continuations. The durable checkpoint remains resumable.
  sessionToken++;
  competition.abandon();
  finishingSession = undefined;
  scoreSaving.value = false;
  openSetup();
}

function presentPracticeSummary(): void {
  if (practiceSummary.value || practiceSessionStartedAt.value === null) return;
  const finishedAt = Date.now();
  const result: PracticeSummary = {
    elapsedMs: Math.max(0, finishedAt - practiceSessionStartedAt.value),
    levelsCompleted: practicePassedLevels.value.size,
    mistakes: practiceMistakes.value,
  };
  // End the live run before opening the dialog. Pending move/retry/next-level
  // callbacks cannot change the result, which never enters a repository.
  practiceLaunchToken += 1;
  showPracticePicker.value = false;
  practiceStarting.value = false;
  showExitConfirm.value = false;
  stopTimer();
  stopSounds();
  clearPendingRunTimers();
  clearLevelAdvanceTimer();
  clearScorePopupTimer();
  scorePopup.value = null;
  campaignStarted.value = false;
  expectedMove.value = null;
  activeNode.value = null;
  status.value = "ready";
  practiceSummary.value = result;
  lastInteractionAt = finishedAt;
  playSound("complete");
}

/** Home v2 supplies only session inputs; Dev's runner and scoring stay intact. */
async function prepareChallenge(profile: PlayerSetupInput, mode: ChallengeMode, existingPlayerId?: string): Promise<void> {
  if (homeStarting.value || !showSetup.value) return;
  const nickname = profile.nickname.trim();
  if (!nickname || nickname.length > homeConfig.nicknameMaxLength || !homeConfig.ages.includes(profile.age) || !isPlayerAvatarId(profile.avatarId)) return;
  // Recheck immediately before creating a profile; explicit identity reuse is allowed.
  if (existingPlayerId === undefined) {
    try {
      const key = nicknameKey(nickname);
      if (repositories.scores.list().some(score => nicknameKey(score.name) === key)) {
        homeStorageError.value = t('home.nicknameTaken');
        return;
      }
    } catch {
      homeStorageError.value = t('home.nicknameCheckError');
      return;
    }
  }
  let savedModeIds;
  let savedDuration;
  let scoringStrategies: ModeScoringStrategies;
  try {
    savedModeIds = repositories.modes.enabledIds();
    savedDuration = repositories.modes.durationSec();
    scoringStrategies = repositories.modes.scoringStrategies();
  } catch {
    homeStorageError.value = t("modes.loadError");
    return;
  }
  const configuredMode = enabledModesFor(savedModeIds, scoringStrategies, savedDuration).find((item) => item.id === mode.id);
  if (!configuredMode || configuredMode.timeLimit <= 0 || configuredMode.timeLimit > 900 || !challengeSets.some((set) => set.id === configuredMode.levelSetId)) return;
  if (configuredMode.timeLimit !== mode.timeLimit) { homeStorageError.value = t('modes.durationChanged'); return; }
  let playerId: string;
  const token = ++sessionToken;
  homeStarting.value = true;
  try {
    playerId = existingPlayerId ?? newPlayerId();
    await repositories.players.save({ id: playerId, nickname, age: profile.age, avatarId: profile.avatarId });
  } catch {
    if (token === sessionToken) homeStorageError.value = t("storage.error");
    return;
  } finally {
    if (token === sessionToken) homeStarting.value = false;
  }
  if (token !== sessionToken) return;
  homeStorageError.value = "";
  // Keep one same-URL history entry so browser Back exits a session to Home.
  // Preserve Vue Router's state; session screens themselves are not routes.
  if (!window.history.state?.debugMasterHomeV2Session) {
    window.history.pushState({ ...window.history.state, debugMasterHomeV2Session: true }, "", window.location.href);
  }
  currentPlayerId.value = playerId;
  currentAvatarId.value = profile.avatarId;
  playerNameDraft.value = nickname;
  playerAgeDraft.value = profile.age;
  activeChallenge.value = configuredMode;
  selectedSetId.value = configuredMode.levelSetId;
  selectedLevelIndex.value = 0;
  selectedLevelDraft.value = 1;
  selectedMode.value = "timer";
  customMinutes.value = configuredMode.timeLimit / 60;
  selectedLanguageDraft.value = "python";
  debugModeDraft.value = false;
  deadRun.value = null;
  showSetup.value = false;
  showTutorial.value = true;
  lastInteractionAt = Date.now();
  // Only explicit reuse of a stored identity skips the tutorial;
  // newly created profiles follow the normal introduction.
  if (existingPlayerId !== undefined) playChallenge();
}

async function resumeChallenge(scoreId: string, mode: ChallengeMode): Promise<void> {
  if (homeStarting.value || !showSetup.value) return;
  let score: Score | undefined;
  try {
    const chosen = repositories.scores.list().find(item => item.id === scoreId);
    if (chosen) score = repositories.scores.today({ challengeId: mode.challengeId, setId: mode.levelSetId, mode: 'timer', timeLimitSec: mode.timeLimit, difficulty: mode.difficulty, scoringStrategy: mode.scoringStrategy }, new Date(), Infinity).find(item => scorePlayerKey(item) === scorePlayerKey(chosen));
  } catch {
    homeStorageError.value = t('storage.loadError');
    return;
  }
  if (!score || !homeConfig.ages.includes(score.age as number) || !score.name.trim() || score.name.trim().length > homeConfig.nicknameMaxLength) {
    homeStorageError.value = t('player.unavailable');
    return;
  }
  await prepareChallenge({ nickname: score.name, age: score.age!, avatarId: isPlayerAvatarId(score.avatarId) ? score.avatarId : PLAYER_AVATARS[0] }, mode, scorePlayerKey(score));
}

function openPracticePicker(): void {
  if ((!showSetup.value && !practiceActive.value) || showPracticePicker.value || practiceSummary.value || homeStarting.value || practiceStarting.value || showExitConfirm.value) return;
  practiceLaunchButton = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  showPracticePicker.value = true;
  lastInteractionAt = Date.now();
}
function requestPracticeLevel(levelId: number): void {
  if (!practiceActive.value && compactLayout.value && showPracticePicker.value && practiceLevels.some(level => level.id === levelId)) {
    showPracticePicker.value = false;
    pendingPracticeIntro.value = levelId;
    lastInteractionAt = Date.now();
    return;
  }
  void startPracticeLevel(levelId);
}
function startFromTutorial(): void {
  const levelId = pendingPracticeIntro.value;
  pendingPracticeIntro.value = null;
  if (levelId === null) { playChallenge(); return; }
  // Restore the existing picker's precondition, then use its original start.
  showPracticePicker.value = true;
  void startPracticeLevel(levelId);
}
function backFromTutorial(): void {
  const levelId = pendingPracticeIntro.value;
  pendingPracticeIntro.value = null;
  if (levelId === null) { backToStart(); return; }
  showPracticePicker.value = true;
}
async function closePracticePicker(): Promise<void> {
  if (practiceStarting.value) return;
  showPracticePicker.value = false;
  await nextTick();
  if (practiceLaunchButton?.isConnected) practiceLaunchButton.focus({ preventScroll: true });
}
async function startPracticeLevel(levelId: number): Promise<void> {
  if (practiceStarting.value || practiceSummary.value || !practiceLevels.some((level) => level.id === levelId) || (!practiceActive.value && !showPracticePicker.value)) return;
  const token = ++practiceLaunchToken;
  sessionToken += 1;
  const alreadyPracticing = practiceActive.value;
  practiceStarting.value = true;
  practiceActive.value = true;
  activeChallenge.value = null;
  currentPlayerId.value = '';
  currentAvatarId.value = undefined;
  playerNameDraft.value = t('practice.badge');
  playerAgeDraft.value = null;
  selectedSetId.value = practiceSet.id;
  selectedMode.value = 'campaign';
  selectedLanguageDraft.value = 'python';
  debugModeDraft.value = false;
  if (!alreadyPracticing) practiceSuperHint.value = false;
  showSummary.value = false;
  showRanking.value = false;
  await nextTick(); // The existing set watcher resets the selected level first.
  if (token !== practiceLaunchToken || !practiceActive.value) return;
  selectedLevelDraft.value = levelId;
  if (!window.history.state?.debugMasterHomeV2Session) window.history.pushState({ ...window.history.state, debugMasterHomeV2Session: true }, '', window.location.href);
  showPracticePicker.value = false;
  practiceStarting.value = false;
  if (!alreadyPracticing) {
    // Map selections/restarts reset Dev's run counters; practice summary
    // intentionally retains its own totals for the whole visit.
    practiceSessionStartedAt.value = Date.now();
    practicePassedLevels.value = new Set<number>();
    practiceMistakes.value = 0;
    practiceTeachingLevels.value = [];
  }
  startGame();
}
function playChallenge(): void {
  if (!activeChallenge.value || !showTutorial.value) return;
  showTutorial.value = false;
  startGame(); // New players start after tutorial; validated returning players start immediately.
}

function showChallengeRanking(): void {
  showSummary.value = false;
  showRanking.value = true;
  lastInteractionAt = Date.now();
}

function resetHomeSession(): void {
  pendingPracticeIntro.value = null;
  practiceTeachingLevels.value = [];
  homeAfterSave = false;
  sessionToken += 1;
  homeStarting.value = false;
  scoreSaving.value = false;
  practiceLaunchToken += 1;
  practiceActive.value = false;
  practiceSummary.value = undefined;
  practiceSessionStartedAt.value = null;
  practicePassedLevels.value = new Set<number>();
  practiceMistakes.value = 0;
  practiceSuperHint.value = false;
  practiceStarting.value = false;
  showPracticePicker.value = false;
  showExitConfirm.value = false;
  showSetup.value = true;
  showTutorial.value = false;
  showSummary.value = false;
  showRanking.value = false;
  playerNameDraft.value = "";
  playerAgeDraft.value = null;
  playerName.value = "";
  playerAge.value = undefined;
  currentPlayerId.value = "";
  currentAvatarId.value = undefined;
  activeChallenge.value = null;
  summaryScore.value = undefined;
  scoreSaved.value = false;
  scoreStorageError.value = false;
  homeStorageError.value = "";
  homeResetKey.value += 1; // Recreate the form; never hydrate a previous profile.
  lastInteractionAt = Date.now();
  void repositories.players.clearCurrent().catch(() => { /* Form still clears if storage is blocked. */ });
}

function recordInteraction(): void { lastInteractionAt = Date.now(); }
function wakeHome(input: 'keyboard' | 'pointer'): void {
  if (!showSetup.value || !homeSleeping.value) return;
  focusAfterWake = input === 'keyboard';
  homeEntering.value = true;
  homeSleeping.value = false;
  recordInteraction();
}
function showHomeSleep(): void {
  if (!showSetup.value || homeStarting.value || scoreSaving.value) return;
  focusAfterWake = false;
  homeSleeping.value = true;
  recordInteraction();
}
function focusHomeAfterWake(): void {
  homeEntering.value = false;
  if (!showSetup.value || homeSleeping.value || !focusAfterWake) return;
  focusAfterWake = false;
  void homeView.value?.focusFirstMode();
}

function playUiClick(event: MouseEvent): void {
  if (!event.isTrusted || !(event.target instanceof Element)) return;
  const control = event.target.closest<HTMLElement>('button, a[href], input[type="radio"], input[type="checkbox"], summary');
  if (!control || control.matches(':disabled, [aria-disabled="true"]') || control.closest('[inert]')) return;
  // Movement and mode selection already have their own sound feedback.
  // The mute switch stays silent; it controls whether this cue can play.
  if (control.matches('.arrow, .sound-toggle, [data-mode-launch]')) return;
  unlockAudio();
  playSound("click");
}
function resetAfterBrowserNavigation(event: Event): void {
  if (liveMode.value) return event.type === "popstate" ? liveLeave() : undefined; // Back gives up the seat.
  if (homeConfig.enabled) backToStart();
}
function refreshStoredScores(): void {
  try { scores.value = repositories.scores.list(); }
  catch { scores.value = []; }
}

async function retryScoreSave(): Promise<void> {
  if (practiceActive.value || liveMode.value || retryingCheckpoint.value) return;
  retryingCheckpoint.value = true;
  try { await competition.retry(); }
  finally { retryingCheckpoint.value = false; }
}

function beginTimer(): void {
  stopTimer();
  if (!isTimedMode.value) {
    timerRemaining.value = 0;
    return;
  }
  if (liveMode.value) return liveBeginTimer();
  const tick = () => {
    const deadline = competition.session.value?.deadline;
    timerRemaining.value = deadline === undefined ? 0 : Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    if (deadline !== undefined && Date.now() >= deadline) timeUp();
  };
  tick();
  if (campaignStarted.value) timerId = setInterval(tick, 100);
}

function stopTimer(): void {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function clearLevelAdvanceTimer(): void {
  if (levelAdvanceTimer) {
    clearTimeout(levelAdvanceTimer);
    levelAdvanceTimer = null;
  }
}

function clearScorePopupTimer(): void {
  if (scorePopupTimer) {
    clearTimeout(scorePopupTimer);
    scorePopupTimer = null;
  }
}

function showLevelScorePopup(feedback: ScorePopup): void {
  clearScorePopupTimer();
  scorePopup.value = feedback;
  scorePopupId.value++;
  scorePopupTimer = setTimeout(() => {
    scorePopup.value = null;
    scorePopupTimer = null;
  }, 1400);
}

function clearPendingRunTimers(): void {
  for (const timer of [stepTimer, failAnimationTimer, retryTimer]) {
    if (timer !== null) clearTimeout(timer);
  }
  stepTimer = null;
  failAnimationTimer = null;
  retryTimer = null;
  boardShattering.value = false;
}

async function beginLevel(liveResumeCursor?: number): Promise<void> {
  const token = sessionToken;
  if (liveMode.value) {
    if (!liveCanInput.value) return;
    // Normal entry advances on a durable local event. Recovery supplies an already accepted cursor.
    if (liveResumeCursor === undefined && !liveRoom.value?.sendGameplay({ action: 'ready', levelId: currentLevel.value.id })) return;
  }
  if (!practiceActive.value && !liveMode.value) {
    await checkpointWrite;
    if (token !== sessionToken || !campaignStarted.value) return;
    const saved = competition.session.value;
    if (!saved || saved.status === 'finished') return;
    const level = { setId: saved.setId, levelId: currentLevel.value.id,
      ...(deadRun.value ? { seed: deadRun.value.seed } : {}) };
    if (saved.checkpoint.levelKey !== competitionLevelKey(level)) {
      checkpointWrite = competition.apply({ type: 'enter-level', level, levelIndex: selectedLevelIndex.value, at: Date.now() });
      const receipt = await checkpointWrite;
      if (token !== sessionToken || !campaignStarted.value) return;
      if (!receipt) { void restoreCompetitionBoard(); return; }
      if (receipt.session.status === 'finished') { campaignStarted.value = false; showCanonicalResult(); return; }
    }
    syncCompetitionCounters();
  }
  clearPendingRunTimers();
  clearLevelAdvanceTimer();
  runState = createRunState(parseProgram(currentLevel.value.code));
  boardRound.value += 1;
  player.row = currentLevel.value.start[0];
  player.col = currentLevel.value.start[1];
  playerWarped.value = true;
  wrapExit.value = null;
  playerFacing.value = START_FACING;
  expectedMove.value = null;
  activeNode.value = null;
  executionSteps.value = 0;
  playerInputs.value = 0;
  levelCorrectInputs.value = 0;
  levelStartedAt.value = !practiceActive.value && !liveMode.value
    ? activeLevelRecord()?.firstReadyAt ?? Date.now() : Date.now();
  revealedHintCount.value = 0;
  notificationMessage.value = "";
  boardShattering.value = false;
  status.value = "playing";
  feedbackMessage.value = t("game.startInstruction");
  if (!practiceActive.value && !liveMode.value) replayCheckpointCursor();
  if (liveMode.value) replayCheckpointCursor(liveResumeCursor ?? 0);
  advanceToMove();
}

function restartLevel(): void {
  if (!campaignStarted.value) return;
  if (liveMode.value && (!canControl.value || !liveRoom.value?.sendGameplay({ action: 'reset', levelId: currentLevel.value.id }))) return;
  playSound("wrong");
  if (!practiceActive.value && !liveMode.value) {
    if (competition.busy.value) return;
    checkpointWrite = competition.apply({ type: 'reset-attempt', at: Date.now() });
  }
  void beginLevel();
}

function advanceToMove(): void {
  // Run the program until it needs the next arrow key (or ends / errors).
  if (status.value !== "playing") return;
  const result = runUntilMove(
    runState,
    () => currentTile.value,
    (node) => {
      activeNode.value = node;
    },
  );
  executionSteps.value = runState.steps;
  if (result.kind === "move") {
    expectedMove.value = result.node;
    feedbackMessage.value = `รอกด ${result.node.direction}()`;
    return;
  }
  if (result.kind === "error") {
    failLevel(result.reason);
    return;
  }
  completeLevel();
}

function controlMove(direction: Direction): void {
  // The game only succeeds when the player's input matches the next move node.
  if (!canControl.value || !expectedMove.value) return;
  const acceptedAt = Date.now();
  if (liveMode.value) {
    const endAt = liveState.value?.endAt;
    if (endAt == null || serverTime(liveOffset.value, acceptedAt) > endAt) { timeUp(); return; }
    if (!liveRoom.value?.sendGameplay({ action: 'direction', levelId: currentLevel.value.id, direction })) return;
  }
  if (!practiceActive.value && !liveMode.value) {
    const saved = competition.session.value;
    if (!saved || (saved.deadline !== undefined && acceptedAt > saved.deadline)) { timeUp(); return; }
    const previousRevision = saved.revision;
    const correct = direction === expectedMove.value.direction;
    const solution = correct ? solveLevel(currentLevel.value, parseProgram(currentLevel.value.code)) : undefined;
    const finalInput = !!solution && !solution.error && levelCorrectInputs.value + 1 === solution.moves.length;
    const before = saved.totalScore;
    checkpointWrite = competition.apply({ type: correct ? 'correct-input' : 'wrong-input', at: acceptedAt, ...(finalInput ? { complete: true } : {}) });
    if (!competition.pendingOperation.value || competition.session.value?.revision === previousRevision) { void restoreCompetitionBoard(); return; }
    syncCompetitionCounters();
    if (finalInput) completionFeedback = { levelId: currentLevel.value.id, points: competition.session.value!.totalScore - before, stars: activeLevelRecord()?.stars ?? 0 };
  }
  const expected = expectedMove.value.direction;
  if (direction !== expected) {
    pulseArrow(direction, true);
    failLevel("Wrong key");
    return;
  }
  const result = stepPosition(
    player,
    direction,
    currentLevel.value.rows,
    currentLevel.value.cols,
  );
  wrapExit.value = result.wrapped
    ? {
        id: playerHop.value + 1,
        row: player.row,
        col: player.col,
        dx: direction === "left" ? -1 : direction === "right" ? 1 : 0,
        dy: direction === "up" ? -1 : direction === "down" ? 1 : 0,
      }
    : null;
  player.row = result.row;
  player.col = result.col;
  // Wrapping teleports to the far edge, so skip the slide across the board.
  playerWarped.value = result.wrapped;
  playerFacing.value = direction;
  playSound("move");
  pulseArrow(direction, false);
  playerHop.value += 1;
  playerInputs.value += 1;
  if (practiceActive.value) totalInputs.value += 1;
  levelCorrectInputs.value += 1;
  expectedMove.value = null;
  feedbackMessage.value = result.wrapped
    ? `ถูกต้อง และ wrap ไปอีกฝั่ง`
    : "ถูกต้อง";
  const token = sessionToken;
  const savedInput = checkpointWrite;
  stepTimer = setTimeout(async () => {
    stepTimer = null;
    if (liveMode.value && (!liveCanInput.value || !campaignStarted.value || token !== sessionToken)) return;
    if (!practiceActive.value && !liveMode.value) {
      const receipt = await savedInput;
      if (token !== sessionToken || !campaignStarted.value) return;
      if (!receipt) { void restoreCompetitionBoard(); return; }
    }
    advanceToMove();
  }, 80);
}

// Keyboard and touch input both press the matching D-pad key; a wrong key flashes red.
function pulseArrow(direction: Direction, wrong: boolean): void {
  const button = controlsEl.value?.querySelector<HTMLElement>(`.arrow.${direction}`);
  if (!button || typeof button.animate !== "function") return;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (wrong) {
    const red = { backgroundColor: "#ffd6d6", borderColor: "#ff6b6b", color: "#c62f3c" };
    button.animate(still
      ? [red, { ...red, offset: .7 }, {}]
      : [
          { ...red, transform: "translateX(0)" },
          { transform: "translateX(-5px) rotate(-3deg)", offset: .2 },
          { transform: "translateX(5px) rotate(3deg)", offset: .45 },
          { ...red, transform: "translateX(-3px)", offset: .7 },
          {},
        ], { duration: 420, easing: "ease-out" });
    return;
  }
  button.animate(still
    ? [{ backgroundColor: "#dcebff" }, {}]
    : [
        { transform: "translateY(3px) scale(.92)", boxShadow: "inset 0 -1px 0 rgba(6, 26, 56, .12)", backgroundColor: "#dcebff" },
        { transform: "translateY(-1px) scale(1.04)", offset: .6 },
        {},
      ], { duration: 220, easing: "cubic-bezier(.16, 1, .3, 1)" });
}

function completeLevel(): void {
  playSound("clear");
  if (!practiceActive.value && !liveMode.value) {
    syncCompetitionCounters();
    if (completionFeedback) showLevelScorePopup(completionFeedback);
    completionFeedback = null;
  } else if (practiceActive.value) {
    clearScorePopupTimer();
    scorePopup.value = null;
    practicePassedLevels.value.add(currentLevel.value.id);
    completedLevels.value += 1;
  } else syncLiveCounters();
  status.value = "success";
  notificationMessage.value = "";
  if (deadRun.value) {
    // Endless: build the next level now, so the run never runs out.
    const run = deadRun.value;
    run.levels.push(generateLevel(run.seed, run.levels.length));
  }
  if (selectedLevelIndex.value >= activeLevels.value.length - 1) {
    status.value = "completed";
    if (liveMode.value) return; // Live: nothing is saved; the clock runs on until the round result.
    saveScore();
    stopTimer();
    return;
  }
  levelAdvanceTimer = setTimeout(() => {
    selectedLevelIndex.value += 1;
    beginLevel();
  }, 520);
}

function failLevel(reason: string): void {
  playSound("wrong");
  status.value = "failed";
  expectedMove.value = null;
  comboStreak.value = 0;
  if (reason === "Wrong key") {
    if (practiceActive.value) practiceMistakes.value += 1;
    reason = t("game.wrongMove");
  }
  if (deadRun.value) {
    if (liveMode.value || practiceActive.value) livesLeft.value = Math.max(0, livesLeft.value - 1);
    reason = `${reason} · เหลือ ${livesLeft.value} หัวใจ`;
  }
  notificationMessage.value = reason;
  feedbackMessage.value = notificationMessage.value;
  boardShattering.value = false;
  failAnimationTimer = setTimeout(() => {
    failAnimationTimer = null;
    boardShattering.value = true;
  }, 0);
  const failedInput = checkpointWrite;
  const token = sessionToken;
  retryTimer = setTimeout(async () => {
    retryTimer = null;
    if (liveMode.value && (!liveCanInput.value || token !== sessionToken)) return;
    if (!practiceActive.value && !liveMode.value) {
      const receipt = await failedInput;
      if (token !== sessionToken) return;
      if (!receipt) { void restoreCompetitionBoard(); return; }
    }
    boardShattering.value = false;
    if (!campaignStarted.value || status.value !== "failed") return;
    if (deadRun.value && livesLeft.value === 0) {
      endDeadRun();
      return;
    }
    beginLevel();
  }, 760);
}

// Dead Mode ends when the last heart is lost.
function endDeadRun(): void {
  campaignStarted.value = false;
  stopTimer();
  notificationMessage.value = `ผ่านไป ${completedLevels.value} ด่าน · ${totalScore.value} คะแนน`;
  saveScore();
}

function timeUp(): void {
  stopTimer();
  if (liveMode.value) return liveTimeUp();
  status.value = "timeup";
  expectedMove.value = null;
  notificationMessage.value = "หมดเวลา 5 นาที/เวลาที่ตั้งไว้ แสดง Ranking แล้ว";
  saveScore();
}

function activeLevelRecord() {
  const saved = competition.session.value;
  return saved?.checkpoint.levelKey ? saved.levels[saved.checkpoint.levelKey] : undefined;
}

function syncCompetitionCounters(): void {
  const saved = competition.session.value;
  if (!saved || practiceActive.value || liveMode.value) return;
  totalScore.value = saved.totalScore;
  completedLevels.value = saved.levelsCompleted;
  totalInputs.value = saved.checkpoint.inputs;
  comboStreak.value = saved.checkpoint.combo;
  bestCombo.value = saved.checkpoint.bestCombo;
  livesLeft.value = saved.checkpoint.hearts ?? DEAD_LIVES;
}

function replayCheckpointCursor(cursor = activeLevelRecord()?.attemptCursor ?? 0): void {
  for (let i = 0; i < cursor; i++) {
    const result = runUntilMove(runState, () => currentTile.value);
    if (result.kind !== 'move') break;
    const position = stepPosition(player, result.node.direction, currentLevel.value.rows, currentLevel.value.cols);
    player.row = position.row; player.col = position.col;
    playerFacing.value = result.node.direction;
    levelCorrectInputs.value++;
    playerInputs.value++;
  }
}

async function restoreCompetitionBoard(): Promise<void> {
  const saved = competition.session.value;
  if (!saved) return;
  if (saved.status === 'finished') { campaignStarted.value = false; showCanonicalResult(); return; }
  selectedLevelIndex.value = saved.checkpoint.levelIndex;
  if (deadRun.value) while (deadRun.value.levels.length <= selectedLevelIndex.value) deadRun.value.levels.push(generateLevel(deadRun.value.seed, deadRun.value.levels.length));
  syncCompetitionCounters();
  if (saved.checkpoint.hearts === 0) { await finishCompetition(Date.now()); return; }
  if (activeLevelRecord()?.completed) {
    if (deadRun.value && selectedLevelIndex.value === deadRun.value.levels.length - 1) deadRun.value.levels.push(generateLevel(deadRun.value.seed, deadRun.value.levels.length));
    if (selectedLevelIndex.value >= activeLevels.value.length - 1) { await finishCompetition(Date.now()); return; }
    selectedLevelIndex.value++;
  }
  await beginLevel();
}

function showCanonicalResult(): void {
  const saved = competition.session.value;
  if (!saved || saved.status !== 'finished') return;
  const score = toScore(saved);
  syncCompetitionCounters();
  summaryScore.value = score;
  lastScoreId.value = score.id;
  scoreSaved.value = true;
  scoreStorageError.value = false;
  refreshStoredScores();
  showSummary.value = !!activeChallenge.value;
  showRanking.value = !activeChallenge.value;
  lastInteractionAt = Date.now();
  playSound('complete');
}

function finishCompetition(at: number): Promise<void> {
  if (finishingSession) return finishingSession;
  if (!competition.session.value) return Promise.resolve();
  const token = sessionToken;
  showExitConfirm.value = false;
  stopTimer(); stopSounds();
  clearPendingRunTimers(); clearLevelAdvanceTimer(); clearScorePopupTimer();
  scorePopup.value = null;
  campaignStarted.value = false;
  expectedMove.value = null;
  scoreSaving.value = true;
  // Queued behind the final input and its frozen completion, including on retry.
  const finished = competition.finish(at);
  finishingSession = (async () => {
    const receipt = await finished;
    if (token !== sessionToken) return;
    if (!receipt && competition.session.value?.status === 'active') {
      finishingSession = undefined;
      await finishCompetition(Date.now());
      return;
    }
    scoreSaving.value = false;
    showCanonicalResult();
    if (homeAfterSave) openSetup();
  })();
  return finishingSession;
}

async function saveScore(): Promise<void> {
  if (practiceActive.value || liveMode.value) return;
  await finishCompetition(Date.now());
}

function dismissStoredSession(): void {
  resumeSessionId.value = undefined;
  // Starting another player must not attach the previous booth identity.
  competition.abandon();
}

async function resumeStoredSession(id: string): Promise<void> {
  resumeSessionId.value = undefined;
  const token = ++sessionToken;
  try {
    const saved = await competition.resume(id);
    if (!saved || token !== sessionToken) return;
    practiceActive.value = false;
    activeChallenge.value = homeConfig.modes.find(mode => mode.challengeId === saved.challengeId) ?? null;
    if (activeChallenge.value) activeChallenge.value = { ...activeChallenge.value, difficulty: saved.config.difficulty, scoringStrategy: saved.config.scoringStrategy, timeLimit: saved.timeLimitSec ?? activeChallenge.value.timeLimit };
    selectedMode.value = saved.mode;
    if (saved.mode !== 'dead') selectedSetId.value = saved.setId;
    currentPlayerId.value = saved.playerId;
    currentAvatarId.value = saved.avatarId;
    playerName.value = saved.name; playerNameDraft.value = saved.name;
    playerAge.value = saved.age; playerAgeDraft.value = saved.age ?? null;
    codeLanguage.value = saved.language;
    debugMode.value = saved.debug;
    customMinutes.value = (saved.timeLimitSec ?? 300) / 60;
    startedAt.value = saved.startedAt;
    if (saved.mode === 'dead') {
      const seed = Number(saved.checkpoint.deadSeed);
      deadRun.value = { seed, levels: Array.from({ length: saved.checkpoint.levelIndex + 1 }, (_, i) => generateLevel(seed, i)) };
    } else deadRun.value = null;
    await nextTick(); // The set watcher resets the cursor before restoration.
    selectedLevelIndex.value = saved.checkpoint.levelIndex;
    showSetup.value = false; showTutorial.value = false;
    showSummary.value = false; showRanking.value = false;
    syncCompetitionCounters();
    if (saved.status === 'finished') { showCanonicalResult(); return; }
    campaignStarted.value = true;
    finishingSession = undefined;
    checkpointWrite = Promise.resolve(undefined);
    if (saved.mode === 'dead' && saved.checkpoint.hearts === 0) { await finishCompetition(Date.now()); return; }
    if (activeLevelRecord()?.completed) {
      if (deadRun.value) deadRun.value.levels.push(generateLevel(deadRun.value.seed, deadRun.value.levels.length));
      if (selectedLevelIndex.value >= activeLevels.value.length - 1) { await finishCompetition(Date.now()); return; }
      selectedLevelIndex.value++;
    }
    beginTimer();
    await beginLevel();
  } catch { homeStorageError.value = t('storage.loadError'); }
}

function showNextHint(): void {
  if (!debugMode.value) return;
  revealedHintCount.value = Math.min(revealedHintCount.value + 1, 3);
}

function isGameCodeLineActive(line: string, index: number): boolean {
  if (mobileGuidance.value) return canControl.value && expectedMove.value?.sourceLine === index + 1;
  if (practiceActive.value) {
    return practiceSuperHint.value && !practiceStarting.value && displayLanguage.value === "python" && activeNode.value?.sourceLine === index + 1;
  }
  return debugMode.value && isActiveRawLine(line);
}

function isActiveRawLine(line: string): boolean {
  if (!activeNode.value) return false;
  const text = line.trim();
  const isJs = codeLanguage.value === "js";
  if (activeNode.value.type === "move") {
    return isJs
      ? text === `${activeNode.value.direction}();`
      : text === `${activeNode.value.direction}()`;
  }
  if (activeNode.value.type === "if") {
    return (
      text.startsWith("if ") ||
      text.startsWith("elif ") ||
      text.includes("else if")
    );
  }
  if (activeNode.value.type === "repeat") return text.startsWith("repeat");
  if (activeNode.value.type === "while") return text.startsWith("while");
  if (activeNode.value.type === "call") {
    return isJs
      ? text === `${activeNode.value.name}();`
      : text === `${activeNode.value.name}()`;
  }
  return false;
}

function handleKeydown(event: KeyboardEvent): void {
  if (showSetup.value || showTutorial.value || showSummary.value || practiceSummary.value || showRanking.value || showExitConfirm.value || showPracticePicker.value || practiceStarting.value || status.value !== "playing") return;
  if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
  const keys: Partial<Record<string, Direction>> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    KeyW: "up",
    KeyA: "left",
    KeyS: "down",
    KeyD: "right",
    w: "up",
    a: "left",
    s: "down",
    d: "right",
  };
  // Physical WASD positions also work with a Thai keyboard layout selected.
  const direction = keys[event.code] ?? keys[event.key] ?? keys[event.key.toLowerCase()];
  if (!direction) return;
  event.preventDefault();
  controlMove(direction);
}

// /?set=set-02&level=12 (the review page's "เล่นด่านนี้" link) preselects
// that set and starting level in the setup dialog.
async function applyLevelFromQuery(): Promise<void> {
  const query = useRoute().query;
  const set = allSets.find((item) => item.id === query.set);
  if (set) {
    selectedSetId.value = set.id;
    await nextTick(); // let the set watcher reset the level first
  }
  const level = Number(query.level);
  if (activeLevels.value.some((item) => item.id === level)) {
    selectedMode.value = "campaign";
    selectedLevelDraft.value = level;
  }
}

function formatClock(seconds: number): string {
  const mins = Math.max(0, Math.floor(seconds / 60));
  const secs = Math.max(0, seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// ---- Live ----
// Live Race Room player mode: /?room=CODE. The room code, player id (localStorage) and socket are read on the
// client only (onMounted), so the prerendered "/" stays the normal Home and hydration matches.
// The game itself is the same challenge run; the room supplies the mode, the clock (endAt) and the result.
const router = useRouter();
const nuxtApp = useNuxtApp();
const liveConfig = useLiveConfig();
const liveCode = ref<string | null>(null);
const liveMode = computed(() => liveCode.value !== null);
const liveProfile = ref<PlayerSetupInput | null>(null);
// Prefill for the setup dialog: the last player on this device (after a reload outside a running round).
const liveSetupInitial = ref<PlayerSetupInput | null>(null);
// Reloaded with a saved session: the socket only listens until the first state says whether to rejoin.
const liveResuming = ref(false);
// Secret device id: sent only in `hello`, never compared against broadcast state.
const livePid = ref("");
const liveRoom = shallowRef<LiveRoom | null>(null);
const liveState = computed(() => liveRoom.value?.state.value ?? null);
// Public player id from the server's `you`; this is what the room state lists.
const liveSelfId = computed(() => liveRoom.value?.you.value?.id ?? "");
const liveOffset = computed(() => liveRoom.value?.offset.value ?? 0);
// Last room state seen, kept after "change player" closes the socket so the setup dialog still shows the room's mode.
const liveLastState = ref<RoomState | null>(null);
// The roundId this device started playing; all evidence carries its frozen session identity.
const liveStartedRound = ref<number | null>(null);
const liveNow = ref(Date.now());
let liveTicker: ReturnType<typeof setInterval> | undefined;
let liveRoundToken = 0;
let liveHomeTimer: ReturnType<typeof setTimeout> | undefined;

const liveStage = computed(() => derivePlayerStage({
  enabled: liveConfig.enabled,
  code: liveCode.value,
  hasProfile: liveProfile.value !== null,
  connected: liveRoom.value?.connected.value ?? false,
  notice: liveRoom.value?.notice.value ?? null,
  state: liveState.value,
  selfId: liveSelfId.value,
  offset: liveOffset.value,
  now: liveNow.value,
}));
// Teach the real run without changing accepted keys, score or clocks.
// Practice can start anywhere: reserve guidance for the first two distinct
// levels visited this session, including automatic advances and map choices.
watch(() => practiceActive.value && campaignStarted.value && !practiceStarting.value ? currentLevel.value.id : null, (levelId) => {
  if (levelId !== null && practiceTeachingLevels.value.length < 2 && !practiceTeachingLevels.value.includes(levelId)) {
    practiceTeachingLevels.value = [...practiceTeachingLevels.value, levelId];
  }
}, { flush: 'post' });
const mobileGuidance = computed(() => {
  if (!compactLayout.value || displayLanguage.value !== 'python' || !campaignStarted.value || showSetup.value || showTutorial.value || showSummary.value || practiceSummary.value || showRanking.value) return false;
  if (liveMode.value) return liveStage.value === 'running' && selectedLevelIndex.value < 2;
  if (practiceActive.value) return !practiceStarting.value && practiceTeachingLevels.value.includes(currentLevel.value.id);
  return !!activeChallenge.value && selectedLevelIndex.value < 2;
});
const mobileGuidedMove = computed(() => mobileGuidance.value && canControl.value ? expectedMove.value?.direction ?? null : null);
const followMobileViewports = computed(() => compactLayout.value && campaignStarted.value && !practiceStarting.value &&
  !showSetup.value && !showTutorial.value && !showSummary.value && !practiceSummary.value && !showRanking.value &&
  !showPracticePicker.value && !showExitConfirm.value && ['playing', 'success', 'completed'].includes(status.value) &&
  (!liveMode.value || liveStage.value === 'running'));

// Follow the final cell geometry, not the actor's in-flight hop/slide. Moving
// either scroller never calls the runner or scrolls the surrounding game page.
watch([
  () => player.row, () => player.col, boardRound, followMobileViewports,
  () => boardSpace.value.width, () => boardSpace.value.height,
], async () => {
  cancelBoardFollow();
  const token = boardFollowGeneration;
  if (!followMobileViewports.value) return;
  await nextTick();
  if (token !== boardFollowGeneration) return;
  const area = boardViewportEl.value;
  const board = area?.querySelector<HTMLElement>('.board');
  if (!area?.isConnected || !area.clientWidth || !area.clientHeight || !board) return;
  const style = getComputedStyle(board);
  const cell = parseFloat(style.getPropertyValue('--cell-size'));
  if (!Number.isFinite(cell)) return;
  const map = board.getBoundingClientRect();
  const viewport = area.getBoundingClientRect();
  const left = map.left + board.clientLeft + parseFloat(style.paddingLeft) + player.col * (cell + parseFloat(style.columnGap));
  const top = map.top + board.clientTop + parseFloat(style.paddingTop) + player.row * (cell + parseFloat(style.rowGap));
  const viewportLeft = viewport.left + area.clientLeft;
  const viewportTop = viewport.top + area.clientTop;
  const marginX = Math.min(Math.max(12, cell * .5), area.clientWidth * .2);
  const marginY = Math.min(Math.max(12, cell * .5), area.clientHeight * .2);
  let nextLeft = area.scrollLeft;
  let nextTop = area.scrollTop;
  if (left < viewportLeft + marginX) nextLeft += left - viewportLeft - marginX;
  else if (left + cell > viewportLeft + area.clientWidth - marginX) nextLeft += left + cell - viewportLeft - area.clientWidth + marginX;
  if (top < viewportTop + marginY) nextTop += top - viewportTop - marginY;
  else if (top + cell > viewportTop + area.clientHeight - marginY) nextTop += top + cell - viewportTop - area.clientHeight + marginY;
  boardScroller.to(area, { left: nextLeft, top: nextTop });
}, { flush: 'post' });
const liveSetupMode = computed<ChallengeMode>(() => {
  const room = liveLastState.value;
  const mode = homeConfig.modes.find((item) => item.id === room?.mode) ?? homeConfig.modes[0];
  return room ? { ...mode, timeLimit: room.durationSec } : mode;
});
const livePlaying = computed(() => liveState.value?.players.filter((p) => p.status === "playing") ?? []);
const liveRank = computed(() => {
  if (!liveMode.value) return undefined;
  const place = livePlaying.value.findIndex((p) => p.id === liveSelfId.value) + 1;
  return place > 0 ? `${place}/${livePlaying.value.length}` : undefined;
});
const liveCountdown = computed(() => countdownSec(liveState.value?.startAt ?? null, liveOffset.value, liveNow.value));
const liveQueueRemaining = computed(() => {
  const room = liveState.value;
  return room && (room.phase === "countdown" || room.phase === "running") ? remainingSec(room.endAt, liveOffset.value, liveNow.value) : 0;
});
const liveLateScore = computed(() => liveRoom.value?.syncStatus.value === 'closed');
const liveSyncStatus = computed(() => liveRoom.value?.syncStatus.value ?? 'resync');
const liveCanInput = computed(() => ['ready', 'pending', 'offline'].includes(liveSyncStatus.value));
const liveSyncText = computed(() => t(`live.sync.${liveSyncStatus.value}`));
function liveReload(): void { window.location.reload(); }

function syncLiveCounters(): void {
  const saved = liveRoom.value?.session.value;
  if (!saved) return;
  totalScore.value = saved.totalScore;
  completedLevels.value = saved.levelsCompleted;
  totalInputs.value = saved.checkpoint.inputs;
  comboStreak.value = saved.checkpoint.combo;
  bestCombo.value = saved.checkpoint.bestCombo;
}
function liveRecord() {
  const saved = liveRoom.value?.session.value;
  return saved?.checkpoint.levelKey ? saved.levels[saved.checkpoint.levelKey] : undefined;
}
async function restoreLiveBoard(): Promise<void> {
  if (!campaignStarted.value || !liveCanInput.value) return;
  const saved = liveRoom.value?.session.value;
  if (!saved) return;
  liveNeedsRestore = false;
  clearPendingRunTimers(); clearLevelAdvanceTimer();
  syncLiveCounters();
  const record = liveRecord();
  selectedLevelIndex.value = saved.checkpoint.levelIndex + (record?.completed ? 1 : 0);
  if (selectedLevelIndex.value >= activeLevels.value.length) {
    selectedLevelIndex.value = activeLevels.value.length - 1;
    status.value = 'completed'; expectedMove.value = null; return;
  }
  await beginLevel(record && !record.completed ? record.attemptCursor : undefined);
}
watch(() => liveRoom.value?.scoring.value, message => {
  if (!message?.session) return;
  syncLiveCounters();
  const receipt = message.receipt;
  if (receipt && receipt.delta > 0) {
    showLevelScorePopup({ levelId: receipt.session.levels[receipt.session.checkpoint.levelKey ?? '']?.levelId ?? currentLevel.value.id, points: receipt.delta, stars: receipt.stars });
  }
}, { flush: 'sync' });
let liveNeedsRestore = false;
watch(liveSyncStatus, next => {
  if (next === 'resync' || next === 'closed' || next === 'storage-error' || next === 'reload-required') {
    liveNeedsRestore = true; sessionToken++; clearPendingRunTimers(); clearLevelAdvanceTimer(); expectedMove.value = null;
  }
  if (next === 'ready' && liveNeedsRestore && campaignStarted.value && liveStartedRound.value === liveState.value?.roundId) { liveNeedsRestore = false; void restoreLiveBoard(); }
  if (next === 'ready' && liveStage.value === 'running' && !campaignStarted.value) void liveStartRound();
});

function validLiveProfile(profile: PlayerSetupInput): PlayerSetupInput | null {
  const nickname = profile.nickname.trim();
  if (!nickname || nickname.length > homeConfig.nicknameMaxLength || !homeConfig.ages.includes(profile.age) || !isPlayerAvatarId(profile.avatarId)) return null;
  return { nickname, age: profile.age, avatarId: profile.avatarId };
}

/** onMounted: enters Live mode when the URL carries a valid ?room=. */
function liveEnter(): void {
  // Not useRoute()/location: the prerendered Pages build hydrates `/` with its query-less route and
  // restores `?room=` only after mount, so the first mount uses the search captured at startup.
  liveCode.value = roomCodeFromSearch(takeInitialSearch() ?? window.location.search);
  if (!liveMode.value) return;
  showSetup.value = false; // No Home v2 / reset: the setup dialog for this room comes first.
  livePid.value = livePlayerId();
  liveNow.value = Date.now();
  liveTicker = setInterval(() => { liveNow.value = Date.now(); }, 250);
  // Reload: the same device and room within the last round's time. Rejoin only if a round is under way.
  const saved = loadLiveSession(livePid.value, liveCode.value!, Date.now());
  const player = saved && validLiveProfile(saved);
  if (player) {
    liveSetupInitial.value = player;
    liveConnect(player, true);
  }
}

function liveJoin(profile: PlayerSetupInput): void {
  if (!liveCode.value || liveRoom.value) return;
  const player = validLiveProfile(profile);
  if (!player) return;
  unlockAudio(); // This tap is the gesture; the round itself starts from a socket message.
  liveConnect(player, false);
  liveRemember(player);
}

function liveHello(player: PlayerSetupInput): PlayerHello {
  return { type: "hello", pid: livePid.value, name: player.nickname, avatarId: player.avatarId, age: player.age };
}

/** `resume`: connect without a hello; the first room state decides between rejoining and the setup form. */
function liveConnect(player: PlayerSetupInput, resume: boolean): void {
  const code = liveCode.value;
  if (!code || liveRoom.value) return;
  liveProfile.value = player;
  livePid.value = livePlayerId();
  liveResuming.value = resume;
  // Opened outside setup, so useLiveRoom won't close it on unmount: liveClose()/liveDispose() do.
  liveRoom.value = nuxtApp.runWithContext(() => useLiveRoom({
    code,
    role: "player",
    hello: () => (liveResuming.value ? null : liveHello(player)),
  }));
}

/** Remember this device's player so a reload mid-round rejoins without the form. */
function liveRemember(player: PlayerSetupInput): void {
  if (!liveCode.value || !livePid.value) return;
  saveLiveSession({ pid: livePid.value, room: liveCode.value, ...player, savedAt: Date.now() });
}

watch(liveState, (room) => {
  if (!room) return;
  liveLastState.value = room;
  liveNow.value = Date.now(); // A fresh clock with each state: the countdown opens on 3, not on a stale 4.
  if (!liveResuming.value) return;
  liveResuming.value = false;
  const player = liveProfile.value;
  if (player && (room.phase === "countdown" || room.phase === "running" || room.phase === "finished")) {
    // Mid-round reload: say hello now (and on every reconnect); the server hands back the seat and score.
    liveRoom.value?.send(liveHello(player));
  } else {
    // Lobby or results: maybe a new child at this booth, so ask again with the last player prefilled.
    liveClose();
    liveProfile.value = null;
  }
});

watch(liveStage, (stage) => {
  if (stage === "running") void liveStartRound();
  else if (stage === "results") { if (campaignStarted.value) timeUp(); } // Results follow room timing; grace acknowledgements may still update the totals.
  else if (campaignStarted.value) liveStopGame();
  if (stage === "kicked") {
    clearLiveSession();
    liveRoom.value?.close(); // Keep the room object: its notice drives the kicked screen.
    clearTimeout(liveHomeTimer);
    liveHomeTimer = setTimeout(liveGoHome, 5000);
  }
});

// newRound: the room is back in the lobby with a new roundId. Stop any run; the profile stays.
watch(() => liveState.value?.roundId, (roundId, previous) => {
  if (roundId == null || previous == null || roundId === previous) return;
  liveStopGame();
  liveStartedRound.value = null;
  if (liveStage.value === "running" && liveCanInput.value) void liveStartRound();
});

async function liveStartRound(): Promise<void> {
  const room = liveState.value;
  const profile = liveProfile.value;
  const mode = homeConfig.modes.find((item) => item.id === room?.mode);
  if (!room || !profile || !mode || !liveCanInput.value || liveStartedRound.value === room.roundId) return;
  liveStartedRound.value = room.roundId;
  liveRemember(profile); // Fresh savedAt: a reload any time in this round still rejoins.
  const token = ++liveRoundToken;
  // Same inputs prepareChallenge gives a Home v2 session; the room decides mode and time.
  activeChallenge.value = { ...mode, ...room.round?.config, timeLimit: room.durationSec, levelSetId: room.round?.setId ?? mode.levelSetId };
  selectedSetId.value = room.round?.setId ?? mode.levelSetId;
  selectedMode.value = "timer";
  customMinutes.value = room.durationSec / 60;
  playerNameDraft.value = profile.nickname;
  playerAgeDraft.value = profile.age;
  playerName.value = profile.nickname;
  playerAge.value = profile.age;
  currentAvatarId.value = profile.avatarId;
  selectedLanguageDraft.value = "python";
  debugModeDraft.value = false;
  showExitConfirm.value = false;
  await nextTick(); // The selectedSetId watcher resets the level index first.
  if (token !== liveRoundToken || liveStage.value !== "running") return;
  await startGame();
}

/** Live clock: always derived from the room's endAt (server-adjusted), checked four times a second. */
function liveBeginTimer(): void {
  const tick = () => {
    const room = liveState.value;
    timerRemaining.value = remainingSec(room?.endAt ?? null, liveOffset.value);
    return room;
  };
  tick();
  timerId = setInterval(() => {
    const room = tick();
    if (timerRemaining.value <= 0 || room?.phase === "finished") timeUp();
  }, 250);
}

function liveTimeUp(): void {
  clearPendingRunTimers();
  clearLevelAdvanceTimer();
  campaignStarted.value = false;
  expectedMove.value = null;
  timerRemaining.value = 0;
  status.value = "timeup";
  notificationMessage.value = `${t("summary.score")} ${totalScore.value.toLocaleString("th-TH")}`;
}

function liveStopGame(): void {
  liveRoundToken += 1;
  stopTimer();
  clearPendingRunTimers();
  clearLevelAdvanceTimer();
  clearScorePopupTimer();
  scorePopup.value = null;
  campaignStarted.value = false;
  expectedMove.value = null;
  status.value = "ready";
}

function liveClose(): void {
  liveResuming.value = false;
  clearTimeout(liveHomeTimer);
  liveRoom.value?.close();
  liveRoom.value = null;
}

/** Booth: give up this seat and set up a new player with a new device id. */
function liveChangePlayer(): void {
  liveRoom.value?.send({ type: "leave" });
  liveClose();
  liveStopGame();
  clearLiveSession();
  liveSetupInitial.value = null; // A new player starts from an empty form.
  livePid.value = resetLivePlayerId();
  liveProfile.value = null;
  liveStartedRound.value = null;
}

function liveLeave(): void {
  liveRoom.value?.send({ type: "leave" });
  liveGoHome();
}

/** Kicked, home, setup dialog closed, or Back: close the socket and return to the normal Home. */
function liveGoHome(): void {
  if (!liveMode.value) return;
  pendingPracticeIntro.value = null;
  liveClose();
  liveStopGame();
  clearInterval(liveTicker);
  clearLiveSession();
  liveCode.value = null;
  liveProfile.value = null;
  liveSetupInitial.value = null;
  liveStartedRound.value = null;
  liveLastState.value = null;
  void router.replace({ query: {} });
  resetHomeSession();
}

function liveDispose(): void {
  clearInterval(liveTicker);
  liveClose();
}
// ---- /Live ----

onMounted(async () => {
  // Load facings and the failure pose up front so switching doesn't flash.
  for (const src of [...Object.values(PLAYER_SPRITES), ...Object.values(PLAYER_POSES)]) new Image().src = src;
  refreshStoredScores();
  unsubscribeScores = repositories.scores.subscribe(refreshStoredScores);
  liveEnter();
  if (homeConfig.enabled) {
    if (!liveMode.value) resetHomeSession();
    for (const event of ["pointerdown", "keydown", "input", "focusin"]) window.addEventListener(event, recordInteraction);
    window.addEventListener("popstate", resetAfterBrowserNavigation);
    window.addEventListener("pageshow", resetAfterBrowserNavigation);
    idleTimer = setInterval(() => {
      // No idle policy during gameplay (including level retries and transitions).
      if (!liveMode.value && !homeStarting.value && !scoreSaving.value && (showSetup.value || showTutorial.value || showSummary.value || practiceSummary.value || showRanking.value) && Date.now() - lastInteractionAt >= homeConfig.idleTimeoutMs) backToStart();
    }, 1000);
  } else if (!liveMode.value) {
    await applyLevelFromQuery();
  }
  if (!liveMode.value) {
    try { resumeSessionId.value = repositories.sessions.list().filter(session => session.status === 'active').sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id; }
    catch { homeStorageError.value = t('storage.loadError'); }
  }
  window.addEventListener("keydown", handleKeydown);
  desktopQuery = window.matchMedia("(min-width: 921px) and (min-height: 561px)");
  syncCompactLayout();
  desktopQuery.addEventListener("change", syncCompactLayout);
  if (boardViewportEl.value) {
    boardResizeObserver = new ResizeObserver(() => {
      const area = boardViewportEl.value;
      if (!area) return;
      // Measure only the board's actual viewport, excluding its 6px padding.
      // CSS reserves HUD/code/controls; oversized 24px-cell maps scroll here.
      boardSpace.value = {
        width: Math.max(0, area.clientWidth - 12),
        height: Math.max(0, area.clientHeight - 12),
      };
    });
    boardResizeObserver.observe(boardViewportEl.value);
  }
});

watch(selectedSetId, () => {
  selectedLevelIndex.value = 0;
  selectedLevelDraft.value = 1;
});

onBeforeUnmount(() => {
  cancelBoardFollow();
  desktopQuery?.removeEventListener("change", syncCompactLayout);
  competition.abandon();
  sessionToken += 1;
  practiceLaunchToken += 1;
  clearPendingRunTimers();
  unsubscribeScores?.();
  clearInterval(idleTimer);
  for (const event of ["pointerdown", "keydown", "input", "focusin"]) window.removeEventListener(event, recordInteraction);
  window.removeEventListener("popstate", resetAfterBrowserNavigation);
  window.removeEventListener("pageshow", resetAfterBrowserNavigation);
  window.removeEventListener("keydown", handleKeydown);
  boardResizeObserver?.disconnect();
  liveDispose();
  stopTimer();
  clearLevelAdvanceTimer();
  clearScorePopupTimer();
});
</script>

<style scoped>
.live-sync-note { position: fixed; z-index: 80; left: 50%; top: 12px; transform: translateX(-50%); width: min(90vw, 520px); box-sizing: border-box; padding: 12px 16px; border-radius: 12px; background: #102754; color: #fff; text-align: center; box-shadow: 0 4px 18px #0005; }
.live-sync-note button { margin-left: 8px; min-height: 44px; padding: 8px 12px; color: #102754; background: #ffdc58; border-radius: 8px; }

button,
input {
  font: inherit;
}

input[type="radio"],
input[type="checkbox"] {
  accent-color: var(--cv-blue);
}

button {
  cursor: pointer;
  transition:
    transform 120ms ease,
    box-shadow 120ms ease,
    background-color 120ms ease,
    border-color 120ms ease;
}

button:not(:disabled):active {
  transform: translateY(1px) scale(0.98);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

button:focus-visible,
input:focus-visible,
summary:focus-visible {
  outline: 3px solid var(--cv-yellow);
  outline-offset: 3px;
}

/* ---------- Shell: navy hero background like codeventure.app ---------- */

/* Portrait phones reserve bounded code/board viewports and a separate D-pad.
   Exceptionally short screens can scroll the game instead of clipping it. */
.app-shell {
  height: 100dvh;
  padding: max(8px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left));
  overflow-y: auto;
  background: var(--cv-navy-900) url("~/assets/bg.png") center bottom / cover
    no-repeat;
}

.home-flow-shell {
  overflow-y: auto;
}

/* Kiosk gameplay only: this route owns Home, all modes and native dialogs.
   Keep text editing/selecting inside form fields; team routes are separate. */
.app-shell,
.app-shell :deep(*) {
  -webkit-user-select: none;
  user-select: none;
}
.app-shell :deep(input),
.app-shell :deep(textarea),
.app-shell :deep([contenteditable="true"]),
.app-shell :deep([contenteditable="true"] *) {
  -webkit-user-select: text;
  user-select: text;
}

.game {
  display: grid;
  grid-template-columns: 1fr;
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow-y: auto;
}

.board-panel {
  min-width: 0;
  height: 100%;
  min-height: 620px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  width: 100%;
  max-width: 1640px;
  margin: 0 auto;
  position: relative;
  border: 1px solid var(--cv-glass-border);
  border-radius: 18px;
  background: rgba(6, 26, 56, 0.22);
  box-shadow: var(--cv-shadow-window);
}

/* Wider stacked layout: code, then board/D-pad. Phone overrides below put
   map first, then code, then the full-width D-pad using the same DOM. */
.play-cluster {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  /* The program scrolls at readable size; map dimensions cannot grow either
     row or push the D-pad out of the available game area. */
  grid-template-rows: clamp(136px, 25dvh, 220px) minmax(0, 1fr);
  gap: 8px;
  align-items: stretch;
  justify-content: center;
  width: 100%;
  margin: 0 auto;
}

.play-cluster .code-card {
  order: -1;
  align-self: stretch;
  min-width: 0;
  min-height: 0;
  width: 100%;
}
.play-cluster .code-card :deep(.window-bar) { padding: 8px 14px; }
.play-cluster .code-card :deep(.window-bar h2) { font-size: .8rem; }
.play-cluster .code-card :deep(.code-box) { padding: 10px 0 var(--code-bottom-space, 10px); }
.play-cluster .code-card { overflow: hidden; }

.sound-toggle { display: inline-grid; place-items: center; flex: none; width: 44px; min-height: 44px; padding: 0; border: 1px solid #759bd966; border-radius: 10px; background: #14357499; color: #e4edff; }
.exit-action { color: #c4d9ff; background: #122b5744; border-color: #759bd94d; }
.sound-toggle svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.sound-toggle[aria-pressed="false"] { color: #b6c7e7; background: #102955; }
.board-panel .hud-action { min-height: 44px; min-width: 72px; padding: 0 12px; border-radius: 10px; font-size: .8rem; }
.board-panel .hud-action.sound-toggle { min-width: 44px; width: 44px; padding: 0; }
.board-panel .hud-action.exit-action { color: #c4d9ff; background: #122b5744; border-color: #759bd94d; }
.exit-icon, .live-only-exit { display: none; }
.exit-save-error { flex: none; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px; border: 1px solid #f3bc76; border-radius: 12px; background: #412d36; color: #ffe2c1; font-size: .9rem; }
.board-panel .practice-map-button.soft-button, .board-panel .superhint-button.soft-button { display: inline-flex; justify-content: center; align-items: center; gap: 6px; min-height: 44px; padding: 0 12px; font-size: .85rem; white-space: nowrap; }
.practice-map-button svg, .superhint-button svg { width: 20px; height: 20px; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.board-panel .superhint-button.hint-enabled { background: var(--cv-blue); color: #fff; border-color: #a8c9ff; }
.hint-check { width: 1em; }
.practice-label-short { display: none; }
.practice-map-button:focus-visible, .superhint-button:focus-visible { outline: 3px solid #ffe36b; outline-offset: 3px; }

/* ---------- Typography ---------- */

h1,
h2,
p {
  margin: 0;
}

h1 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: clamp(1.25rem, 1.5vw, 1.65rem);
  font-weight: 800;
  line-height: 1.3;
  letter-spacing: -0.01em;
}


h2 {
  font-size: 1.15rem;
  font-weight: 800;
}

.level-number {
  color: var(--cv-yellow);
}

/* Glass pill with yellow ring, like the hero tagline */
/* Light-surface label, like "Why do so many kids love it?" */
.eyebrow {
  display: inline-block;
  margin: 0 0 6px;
  padding: 3px 10px;
  border-radius: 9999px;
  background: rgba(31, 117, 255, 0.1);
  color: var(--cv-blue);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.board-combo {
  width: 100%;
  min-height: 1.4em;
  margin: 0;
  color: var(--cv-yellow);
  text-align: left;
  font-size: clamp(1rem, 1.4vw, 1.4rem);
  font-weight: 800;
  line-height: 1.4;
}

/* ---------- Board ---------- */

.practice-passed { display: inline-block; color: var(--cv-green); animation: passed-pop 420ms cubic-bezier(.34, 1.56, .64, 1) both; }

/* Combo: each step punches in; from ×5 it runs hot. */
.combo-pop { display: inline-block; transform-origin: left center; animation: combo-punch 360ms cubic-bezier(.34, 1.56, .64, 1); }
.combo-hot { color: #ffb347; text-shadow: 0 0 12px #ff8a3d88, 0 2px 0 #7a2e0a; }
@keyframes combo-punch { 0% { transform: scale(.6); opacity: 0; } 45% { transform: scale(1.3); opacity: 1; } 100% { transform: scale(1); } }
@keyframes passed-pop { from { transform: scale(.5); opacity: 0; } }

/* fitCellSize retains its original 24px tile minimum. If a map cannot fit at
   that size, only its viewport pans; controls are never part of that scroll. */
.board-wrap {
  min-height: 0;
  min-width: 0;
  display: grid;
  place-items: center;
  position: relative;
  justify-self: center;
  width: 100%;
  height: 100%;
}

.board-and-controls { display: grid; grid-template-rows: auto minmax(80px, 1fr) auto; justify-items: center; align-items: center; gap: 12px; width: 100%; height: 100%; min-width: 0; min-height: 0; }
.board-viewport { display: flex; width: 100%; height: 100%; min-width: 0; min-height: 0; padding: 6px; overflow: auto; overscroll-behavior: contain; touch-action: pan-x pan-y pinch-zoom; border-radius: var(--cv-radius-lg); }
/* Auto margins center fitting maps and become zero on an overflowing axis,
   so the first row/column stays reachable from the scroll origin. */
.board-viewport > .board { flex: none; max-width: none; max-height: none; margin: auto; }
.board-viewport:focus-visible { outline: 2px solid var(--cv-yellow); outline-offset: -2px; }
/* Thumb zone: the D-pad alone, centred. Sound/exit live in the HUD here
   (teleported); desktop brings them back beside the D-pad. */
.board-footer { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; align-items: end; width: 100%; }
.game-actions { display: flex; flex-direction: row; align-items: center; gap: 6px; min-width: 0; }
.board-footer .touch-controls { grid-column: 1; justify-self: center; }
#game-hud-system .hud-action.exit-action { min-width: 0; padding: 0 12px; }

.score-popup {
  position: absolute;
  top: 130px;
  left: 50%;
  z-index: 7;
  transform: translateX(-50%);
  display: grid;
  gap: 2px;
  border-radius: var(--cv-radius-lg);
  background: var(--cv-cta);
  color: var(--cv-gray-800);
  padding: 10px 16px;
  text-align: center;
  box-shadow: var(--cv-shadow-xl);
  pointer-events: none;
  min-width: min(320px, calc(100% - 28px));
}

.score-popup strong {
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1;
}

.score-popup span {
  color: rgba(34, 40, 42, 0.8);
  font-size: 0.78rem;
  font-weight: 700;
}

/* ---------- Touch arrows ---------- */

.touch-controls {
  display: grid;
  grid-template-columns: repeat(3, 68px);
  grid-template-areas:
    ". up ."
    "left down right";
  justify-content: center;
  gap: 8px;
  flex: none;
}

.arrow {
  touch-action: manipulation;
  position: relative;
  width: 68px;
  height: 52px;
  border: 1px solid #a8ceff;
  border-radius: 12px;
  background: #fff;
  color: var(--cv-blue);
  font-weight: 800;
  font-size: 1.1rem;
  box-shadow:
    inset 0 -4px 0 rgba(6, 26, 56, 0.12),
    var(--cv-shadow-md);
}

.arrow.guided-arrow:not(:disabled) { background: #ffe36b; outline: 3px solid #87dfff88; outline-offset: 2px; }

.arrow:not(:disabled):hover {
  background: var(--cv-blue-soft);
}

.arrow.up {
  grid-area: up;
}
.arrow.left {
  grid-area: left;
}
.arrow.down {
  grid-area: down;
}
.arrow.right {
  grid-area: right;
}

/* ---------- Debug panel ---------- */

.debug-card {
  min-height: 0;
  padding: 12px;
  border: 1px solid var(--cv-glass-border);
  border-radius: var(--cv-radius-xl);
  background: var(--cv-glass);
  box-shadow: var(--cv-shadow-window);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.debug-card {
  flex: none;
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
}

.metric-grid div {
  border: 1px solid var(--cv-glass-border);
  border-radius: var(--cv-radius);
  background: var(--cv-glass-soft);
  padding: 8px 10px;
}

.metric-grid span {
  display: block;
  color: var(--cv-on-dark-muted);
  font-size: 0.68rem;
  font-weight: 700;
}

.metric-grid strong {
  font-size: 0.92rem;
}

.debug-note {
  margin: 8px 0;
  padding: 8px 10px;
  border: 1px solid var(--cv-glass-border);
  border-radius: var(--cv-radius);
  background: var(--cv-glass-soft);
  color: var(--cv-on-dark-muted);
  line-height: 1.35;
}

.hint-list {
  display: grid;
  gap: 6px;
  margin-top: 8px;
}

.hint-list p {
  border-left: 4px solid var(--cv-yellow);
  border-radius: var(--cv-radius-sm);
  background: var(--cv-glass-soft);
  padding: 7px 10px;
  color: var(--cv-on-dark);
}

/* ---------- Buttons ---------- */

.primary-button,
.soft-button {
  min-height: 44px;
  border: 0;
  border-radius: var(--cv-radius-lg);
  padding: 0 18px;
  font-weight: 800;
}

/* Yellow-orange CTA, like "Try free!" */
.primary-button {
  background: var(--cv-cta);
  color: var(--cv-gray-800);
  box-shadow: var(--cv-shadow-xl);
}

.primary-button:not(:disabled):hover {
  filter: brightness(1.05);
}

/* Outline button on light surfaces, like "Compare all plans" */
.soft-button {
  border: 2px solid var(--cv-blue);
  background: #fff;
  color: var(--cv-blue);
}

.soft-button:not(:disabled):hover {
  background: var(--cv-blue-soft);
}

/* Glass button on the dark game panel */
.board-panel .soft-button {
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.1);
  color: var(--cv-on-dark);
}

.board-panel .soft-button:not(:disabled):hover {
  background: rgba(255, 255, 255, 0.2);
}

.primary-button.small,
.soft-button.small {
  min-height: 38px;
  border-radius: var(--cv-radius);
  padding: 0 14px;
  font-size: 0.9rem;
}

.primary-button.small {
  box-shadow: var(--cv-shadow-md);
}

/* ---------- Notifications ---------- */

.notification {
  position: absolute;
  top: 8px;
  left: 50%;
  z-index: 8;
  transform: translateX(-50%);
  width: min(440px, calc(100% - 24px));
  padding: 12px 16px;
  border: 2px solid #94bcff;
  border-radius: var(--cv-radius-lg);
  background: #102b62;
  color: #fff;
  text-align: center;
  line-height: 1.4;
  box-shadow: 0 8px 24px rgba(3, 10, 40, .45);
  pointer-events: none;
}
.notification { animation: notice-pop 320ms cubic-bezier(.34, 1.56, .64, 1) both; }
@keyframes notice-pop { from { opacity: 0; transform: translateX(-50%) translateY(-10px) scale(.86); } }
.notification strong { display: block; font-size: 1.1rem; font-weight: 800; }
.notification p { margin: 3px 0 0; font-size: .95rem; }
.notification.practice-success-notice { display: none; }
@keyframes practice-notice-pop { from { opacity: 0; transform: translate(-50%, calc(-50% - 10px)) scale(.86); } }

/* Score card slices in skewed from the left, a light blade sweeps across it
   and the points slam down. Sharp ease-outs only, no overshoot. */
.score-pop-enter-active {
  transition:
    opacity 90ms linear,
    transform 260ms cubic-bezier(0.2, 0.9, 0.1, 1);
}

.score-pop-leave-active {
  transition:
    opacity 160ms ease-in,
    transform 160ms ease-in;
}

.score-pop-enter-from {
  opacity: 0;
  transform: translateX(calc(-50% - 48px)) skewX(-14deg);
}

.score-pop-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-12px);
}

.score-popup {
  overflow: hidden;
}

.score-popup::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 35%, rgba(255, 255, 255, 0.75) 50%, transparent 65%);
  transform: translateX(-110%);
  animation: popup-blade 420ms 120ms ease-out both;
  pointer-events: none;
}

.score-popup strong {
  display: inline-block;
  animation: points-slam 200ms 90ms cubic-bezier(0.2, 0.9, 0.1, 1) both;
}

@keyframes popup-blade {
  to {
    transform: translateX(110%);
  }
}

@keyframes points-slam {
  from {
    opacity: 0;
    transform: scale(1.6);
  }
}

.notification-failed,
.status-failed,
.status-timeup {
  background: rgba(255, 107, 107, 0.2);
  border-color: var(--cv-red);
}
.notification-failed { background: #52283d; border-color: #ffa8a0; }
.notification-timeup { background: #523b20; border-color: #ffd479; }

.notification-success,
.notification-completed,
.status-success,
.status-completed {
  background: rgba(50, 213, 131, 0.2);
  border-color: var(--cv-green);
}

.status-playing {
  background: rgba(253, 202, 63, 0.2);
  border-color: var(--cv-yellow);
}

/* ---------- Start screen (landing) ---------- */

.landing {
  height: 100%;
  overflow-y: auto;
  /* Still scrolls (wheel, touch, keys); just no visible scrollbar. */
  scrollbar-width: none;
  display: grid;
  align-content: start;
  gap: 14px;
  padding: 4px 4px 16px;
}

.landing::-webkit-scrollbar {
  display: none;
}

.landing-top {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.landing-brand {
  color: #fff;
  font-size: 1.3rem;
  font-weight: 800;
}

.landing-tagline {
  color: var(--cv-on-dark-muted);
  font-size: 0.85rem;
}

.landing-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.75fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
}

.landing-card,
.ranking-card {
  border: 1px solid var(--cv-border);
  border-radius: var(--cv-radius-xl);
  background: #fff;
  color: var(--cv-text);
  box-shadow: var(--cv-shadow-window);
}

.landing-card {
  padding: clamp(18px, 3vw, 32px);
}

.landing-links {
  color: var(--cv-on-dark-muted);
  font-size: 0.8rem;
  text-align: center;
}

.landing-links a {
  color: #fff;
}

.setup-card {
  display: grid;
  gap: 18px;
}

.setup-hero {
  display: flex;
  align-items: center;
  gap: 18px;
}

.setup-codi {
  width: 76px;
  height: auto;
  flex: none;
  filter: drop-shadow(0 6px 4px rgba(6, 26, 56, 0.25));
}

.setup-hero h2 {
  color: var(--cv-heading);
  font-size: clamp(1.6rem, 3.4vw, 2.3rem);
  font-weight: 800;
  line-height: 1.15;
}

.setup-hero p {
  margin-top: 4px;
  color: var(--cv-text);
}

.field {
  display: grid;
  gap: 8px;
}

.field.narrow {
  max-width: 380px;
}

.field span,
.choice-group legend,
.level-picker legend {
  color: var(--cv-heading);
  font-weight: 700;
}

.field input,
.field select {
  min-height: 50px;
  border: 1px solid var(--cv-border);
  border-radius: var(--cv-radius);
  padding: 0 16px;
  background: #fff;
  color: var(--cv-ink);
  font: inherit;
}

.field input:focus,
.field select:focus {
  border-color: var(--cv-blue);
  outline: none;
  box-shadow: 0 0 0 3px rgba(31, 117, 255, 0.2);
}

.choice-group,
.level-picker {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.choice-group legend,
.level-picker legend {
  margin-bottom: 10px;
  padding: 0;
}

.age-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.age-chip,
.level-chip {
  min-height: 46px;
  border: 1px solid var(--cv-border);
  border-radius: var(--cv-radius);
  background: #fff;
  color: var(--cv-heading);
  font-weight: 700;
  box-shadow: 0 2px 0 rgba(6, 26, 56, 0.06);
}

.age-chip:hover,
.level-chip:hover {
  border-color: var(--cv-blue-light);
}

.age-chip.selected,
.level-chip.selected {
  border-color: var(--cv-blue);
  background: var(--cv-blue);
  color: #fff;
}

.mode-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.mode-card {
  display: grid;
  gap: 4px;
  align-content: start;
  min-height: 80px;
  padding: 14px 16px;
  border: 1px solid var(--cv-border);
  border-radius: var(--cv-radius-lg);
  background: #fff;
  cursor: pointer;
  transition:
    border-color 120ms ease,
    background-color 120ms ease;
}

.mode-card:hover {
  border-color: var(--cv-blue-light);
}

.mode-card.selected {
  border: 2px solid var(--cv-blue);
  background: var(--cv-blue-soft);
  padding: 13px 15px;
}

.mode-card:has(input:focus-visible) {
  outline: 3px solid var(--cv-yellow);
  outline-offset: 2px;
}

.mode-card strong {
  color: var(--cv-heading);
  font-size: 1.05rem;
}

.mode-card small {
  color: var(--cv-muted);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.level-picker-note {
  margin-bottom: 8px;
  color: var(--cv-muted);
  font-size: 0.85rem;
  font-weight: 700;
}

.level-grid {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
  padding: 8px;
  border: 1px solid var(--cv-border);
  border-radius: var(--cv-radius-lg);
  background: var(--cv-surface);
}

.level-chip {
  min-height: 38px;
  font-size: 0.8rem;
}

.more-options {
  border: 1px solid var(--cv-border);
  border-radius: var(--cv-radius-lg);
  padding: 10px 16px;
}

.more-options summary {
  color: var(--cv-heading);
  font-weight: 700;
  cursor: pointer;
}

.more-options-body {
  display: grid;
  gap: 12px;
  margin-top: 12px;
}

.segmented {
  display: inline-flex;
  width: fit-content;
  padding: 3px;
  border-radius: var(--cv-radius);
  background: var(--cv-surface);
  border: 1px solid var(--cv-border);
}

.segmented label {
  padding: 6px 16px;
  border-radius: 9px;
  color: var(--cv-muted);
  font-weight: 700;
  cursor: pointer;
}

.segmented label.selected {
  background: var(--cv-blue);
  color: #fff;
}

.debug-toggle {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
}

.debug-toggle input {
  margin-top: 6px;
}

.debug-toggle span {
  display: grid;
}

.debug-toggle strong {
  color: var(--cv-heading);
}

.debug-toggle small {
  color: var(--cv-muted);
}

.privacy-note {
  color: var(--cv-muted);
  font-size: 0.88rem;
}

.start-row {
  display: grid;
  gap: 8px;
}

.start-hint {
  color: var(--cv-muted);
  font-size: 0.85rem;
}

.start-button {
  min-height: 54px;
  font-size: 1.1rem;
}

/* ---------- End-of-game ranking dialog ---------- */

.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(6, 26, 56, 0.72);
  backdrop-filter: blur(4px);
}

.ranking-card {
  display: grid;
  gap: 18px;
  width: min(560px, 100%);
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  padding: 24px;
}

.ranking-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* Side-by-side cards get narrow here: 2 x 2 mode cards. */
@media (min-width: 1101px) and (max-width: 1360px) {
  .mode-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1100px) {
  .landing-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  /* Setup first on narrow screens; the ranking follows. */
  .landing-ranking {
    order: 2;
  }
}

@media (max-width: 640px) {
  .age-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .mode-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .level-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

/* The phone composition gives the program and map the space removed from
   the verbose level header; values and existing system actions stay visible. */
@media (max-width: 639px), (orientation: landscape) and (max-width: 920px) and (max-height: 560px) {
  .play-cluster .code-card.python-code :deep(.code-box) { font-size: .875rem; }
  .board-panel .practice-map-button.soft-button, .board-panel .superhint-button.soft-button { width: 100%; min-width: 0; height: 44px; min-height: 44px; padding: 2px; gap: 3px; font-size: clamp(10px, 2.7vw, 11px); line-height: 1.2; white-space: nowrap; }
  .practice-map-button svg, .superhint-button svg { display: block; flex: none; width: 14px; height: 14px; }
  .practice-label-full { display: none; }
  .practice-label-short { display: inline; }
  .board-panel:has(.practice-hud) #game-hud-system .hud-action.exit-action { padding: 0; }
  .board-panel:has(.practice-hud) .board-combo { display: none; }
  .notification.practice-success-notice { display: block; position: fixed; top: 50%; width: min(340px, calc(100vw - 40px)); transform: translate(-50%, -50%); background: #123e32; color: #bbf7d0; animation-name: practice-notice-pop; }
}
@media (max-width: 359px) {
  .board-panel .superhint-button svg { display: none; }
}
@media (max-width: 639px) {
  .board-panel { padding: 8px; gap: 6px; }
  .play-cluster { grid-template-rows: clamp(156px, 30dvh, 260px) minmax(0, 1fr); gap: 6px; }
  .play-cluster .code-card :deep(.window-bar) { padding: 4px 10px; gap: 7px; }
  .play-cluster .code-card :deep(.window-bar h2) { font-size: .7rem; line-height: 1.3; }
  .play-cluster .code-card :deep(.window-dots) { gap: 4px; }
  .play-cluster .code-card :deep(.window-dots i) { width: 7px; height: 7px; }
  .play-cluster .code-card :deep(.code-scroll-hint) { font-size: .55rem; }
  .board-and-controls { grid-template-rows: minmax(80px, 1fr) auto; gap: 8px; position: relative; }
  .board-combo { display: none; }
}

/* Wide landscape phones put code and the D-pad beside the board. Narrow
   landscape windows keep the stacked, scrollable layout so tiles have width. */
@media (min-width: 640px) and (orientation: landscape) and (max-height: 560px) {
  .board-panel { min-height: 300px; }
  .play-cluster { grid-template-columns: minmax(0, 1.3fr) minmax(220px, 0.7fr); grid-template-rows: minmax(0, 1fr); }
  .play-cluster .code-card { order: 0; height: 100%; }
  .play-cluster .code-card :deep(.code-box) { max-height: none; }
  .board-and-controls { grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto minmax(0, 1fr); }
  .board-combo { grid-column: 1 / -1; }
  .board-viewport { grid-column: 1; grid-row: 2; }
  .board-footer { grid-column: 2; grid-row: 2; grid-template-columns: auto; justify-items: center; align-self: end; }
  .board-footer .touch-controls { grid-column: 1; grid-row: 1; }
}

/* Desktop: board and D-pad on the left, code on the right. */
@media (min-width: 921px) and (min-height: 561px) {
  .app-shell { padding: max(14px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(14px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left)); overflow: hidden; }
  .board-panel { height: 100%; min-height: 0; gap: 10px; padding: 14px; border-radius: var(--cv-radius-xl); }
  .play-cluster { min-height: 320px; grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr); grid-template-rows: none; gap: 16px; }
  .play-cluster .code-card { order: 0; height: 100%; max-height: 100%; }
  .play-cluster .code-card :deep(.window-bar) { padding: 14px 18px; }
  .play-cluster .code-card :deep(.window-bar h2) { font-size: .9rem; }
  .play-cluster .code-card :deep(.code-box) { max-height: none; padding: 16px 0 var(--code-bottom-space, 16px); }
  .board-wrap { min-height: 0; }
  .board-footer { grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); }
  .game-actions { flex-wrap: wrap; }
  .board-footer .touch-controls { grid-column: 2; justify-self: auto; }
}

@media (hover: none) and (pointer: coarse) {
  .touch-controls {
    grid-template-columns: repeat(3, 74px);
  }

  .arrow {
    width: 74px;
    height: 62px;
    font-size: 1.25rem;
  }
}

/* Small phones (320–359px) and short landscape screens: a tighter D-pad. */
@media (max-width: 359px), (orientation: landscape) and (max-height: 560px) {
  .touch-controls { grid-template-columns: repeat(3, 60px); gap: 6px; }
  .arrow { width: 60px; height: 50px; font-size: 1.1rem; }
}

/* Phone experiment: map above code, with a full-width thumb pad below both.
   Flatten layout wrappers only; the observed scroll viewports and input DOM
   remain the same elements, including the teleported system actions. */
@media (max-width: 639px), (orientation: landscape) and (max-width: 920px) and (max-height: 560px) {
  .board-panel { min-height: 560px; padding: 8px; gap: 6px; }
  .play-cluster { position: relative; grid-template-columns: minmax(0, 1fr); grid-template-rows: clamp(120px, 22dvh, 180px) minmax(180px, 1fr) auto; gap: 8px; }
  .board-wrap, .board-and-controls { display: contents; }
  .board-combo { display: none; }
  .board-viewport { grid-column: 1; grid-row: 1; }
  .play-cluster .code-card { grid-column: 1; grid-row: 2; order: 0; height: 100%; }
  .play-cluster .code-card :deep(.code-box) { max-height: none; }
  .board-footer { grid-column: 1; grid-row: 3; align-self: end; }
  .board-footer .touch-controls { grid-column: 1; grid-row: 1; width: 100%; justify-self: stretch; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-areas: ". up ." "left down right"; gap: 6px; }
  .touch-controls .arrow { width: 100%; min-width: 0; height: 52px; font-size: 1.15rem; }
  .touch-controls :deep(.tap-finger) { right: 6px; bottom: 2px; width: 22px; height: 28px; }
  .board-panel .hud-action.sound-toggle { display: none; }
  .board-panel .hud-action.exit-action { display: inline-grid; place-items: center; width: 40px; min-width: 40px; min-height: 44px; padding: 0; }
  .exit-action .exit-text { display: none; }
  .exit-action .exit-icon { display: block; width: 22px; height: 22px; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
</style>
