import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";
import type { ScoreRepository } from "../storage/contracts";
import type { Score } from "../types/debug-game";
import type { RankingBoard } from "../utils/ranking";
import { useCentralBoard } from "./useCentralBoard";

/**
 * Repository reads only; refreshes on writes, other tabs, and Bangkok midnight. A challenge ranking with the event's
 * setup shows the Codi Arena Scoreboard's Board instead whenever it can be read (`central`, COD-1145).
 */
export function useScoreBoard(repository: ScoreRepository, board: Ref<RankingBoard>, limit = 10) {
  const localRows = ref<Score[]>([]);
  const centralBoard = useCentralBoard(board);
  const rows = computed(() => {
    const central = centralBoard.rows.value;
    return central ? (Number.isFinite(limit) ? central.slice(0, limit) : central) : localRows.value;
  });
  const error = ref(false);
  const loaded = ref(false);
  let unsubscribe: (() => void) | undefined;
  let refreshTimer: ReturnType<typeof setInterval> | undefined;
  let mounted = false;
  function refresh() {
    try {
      localRows.value = repository.today(board.value, new Date(), limit);
      error.value = false;
    } catch {
      localRows.value = [];
      error.value = true;
    } finally {
      loaded.value = true;
    }
  }
  onMounted(() => {
    mounted = true;
    refresh();
    unsubscribe = repository.subscribe(refresh);
    refreshTimer = setInterval(refresh, 15_000);
  });
  watch(board, () => { if (mounted) refresh(); });
  onBeforeUnmount(() => {
    unsubscribe?.();
    clearInterval(refreshTimer);
  });
  function selectedSession(sessionId: string): Score | undefined {
    return rows.value.find(score => score.id === sessionId);
  }
  function rankOf(sessionId: string): number | undefined {
    const index = rows.value.findIndex(score => score.id === sessionId);
    return index < 0 ? undefined : index + 1;
  }
  return {
    rows, error, loaded, refresh, selectedSession, rankOf,
    /** Rows are the central Board's; `wanted` without `central` = it can't be read, so this device's board shows. */
    central: computed(() => Boolean(centralBoard.rows.value)),
    centralWanted: centralBoard.wanted,
    me: centralBoard.me,
  };
}
