import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from "vue";
import { createScoreboardClient, type Leaderboard } from "../utils/scoreboardClient";
import { scoreboardVersion } from "../utils/scoreboard";

const POLL_MS = 5000;

export function useScoreboardConfig(): { baseUrl: string; boothFor: (challengeId: string | undefined) => string | null } {
  const config = useRuntimeConfig().public;
  const baseUrl = String(config.scoreboardUrl ?? "").trim();
  const booths = (config.scoreboardBooths ?? {}) as Record<string, unknown>;
  return {
    baseUrl,
    /** The challenge's Codi Arena booth, or null when its board stays on this device. */
    boothFor(challengeId) {
      const boothId = challengeId ? booths[challengeId] : undefined;
      return baseUrl && typeof boothId === "string" && boothId.trim() ? boothId.trim() : null;
    },
  };
}

/** Public Codi Arena booth leaderboard. Keeps the last good board while the hub is unreachable. */
export function useHubLeaderboard(boothId: string, limit: number, userId: Ref<string | undefined> = ref()) {
  const { baseUrl } = useScoreboardConfig();
  const client = createScoreboardClient({ baseUrl, boothId });
  const board = shallowRef<Leaderboard | null>(null);
  const failed = ref(false);
  const loaded = ref(false);
  let timer: ReturnType<typeof setInterval> | undefined;
  let token = 0;
  async function refresh() {
    const current = ++token;
    try {
      const next = await client.getLeaderboard({ limit: Math.min(50, Math.max(1, Number.isFinite(limit) ? limit : 50)), userId: userId.value });
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
