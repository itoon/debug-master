import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from "vue";
import { CHALLENGE_BOARDS, createScoreboardClient, type ChallengeBoard, type Leaderboard } from "../utils/scoreboardClient";
import { scoreboardVersion } from "../utils/scoreboard";

const POLL_MS = 5000;

/** Where one home challenge ranks on the Codi Arena Scoreboard: the game's booth and the challenge's Board. */
export type ScoreboardTarget = { boothId: string; board: ChallengeBoard };

export function useScoreboardConfig(): { baseUrl: string; boothFor: (challengeId: string | undefined) => ScoreboardTarget | null } {
  const config = useRuntimeConfig().public;
  const baseUrl = String(config.scoreboardUrl ?? "").trim();
  const boothId = String(config.scoreboardBoothId ?? "").trim();
  return {
    baseUrl,
    /** The challenge's Board on the game's booth, or null when its board stays on this device. */
    boothFor(challengeId) {
      const board = challengeId ? CHALLENGE_BOARDS[challengeId as keyof typeof CHALLENGE_BOARDS] : undefined;
      return baseUrl && boothId && board ? { boothId, board } : null;
    },
  };
}

/** Public leaderboard of one Board. Keeps the last good board while the hub is unreachable. */
export function useHubLeaderboard(target: ScoreboardTarget, limit: number, userId: Ref<string | undefined> = ref()) {
  const { baseUrl } = useScoreboardConfig();
  const client = createScoreboardClient({ baseUrl, boothId: target.boothId });
  const board = shallowRef<Leaderboard | null>(null);
  const failed = ref(false);
  const loaded = ref(false);
  let timer: ReturnType<typeof setInterval> | undefined;
  let token = 0;
  async function refresh() {
    const current = ++token;
    try {
      const next = await client.getLeaderboard({ board: target.board, limit: Math.min(50, Math.max(1, Number.isFinite(limit) ? limit : 50)), userId: userId.value });
      if (current !== token) return;
      board.value = next;
      failed.value = false;
    } catch {
      if (current === token) failed.value = true;
    } finally {
      if (current === token) loaded.value = true;
    }
  }
  onMounted(() => {
    void refresh();
    timer = setInterval(refresh, POLL_MS);
  });
  watch([scoreboardVersion, userId], () => void refresh());
  onBeforeUnmount(() => {
    token++;
    clearInterval(timer);
  });
  return {
    board,
    entries: computed(() => board.value?.entries ?? []),
    me: computed(() => board.value?.me ?? null),
    /** Only when there is nothing to show; a stale board stays on screen. */
    error: computed(() => failed.value && !board.value),
    loaded,
    refresh,
  };
}
