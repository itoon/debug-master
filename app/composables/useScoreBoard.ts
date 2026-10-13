import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";
import type { ScoreRepository } from "../storage/contracts";
import type { Score } from "../types/debug-game";
import type { RankingBoard } from "../utils/ranking";

/** Repository reads only; refreshes on writes, other tabs, and Bangkok midnight. */
export function useScoreBoard(repository: ScoreRepository, board: Ref<RankingBoard>, limit = 10) {
  const rows = ref<Score[]>([]);
  const error = ref(false);
  const loaded = ref(false);
  let unsubscribe: (() => void) | undefined;
  let refreshTimer: ReturnType<typeof setInterval> | undefined;
  let mounted = false;
  function refresh() {
    try {
      rows.value = repository.today(board.value, new Date(), limit);
      error.value = false;
    } catch {
      rows.value = [];
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
  return { rows: computed(() => rows.value), error, loaded, refresh };
}
