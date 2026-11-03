import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, type Ref } from "vue";
import type { Score } from "../types/debug-game";
import type { RankingBoard } from "../utils/ranking";
import { centralBoardId, centralScores, fetchCentralBoard, type CentralLeaderboard, type CentralYou } from "../utils/scoreboard";

// The Codi Arena Scoreboard's Board for a challenge ranking (COD-1145), read straight from the browser (the
// leaderboard is public and CORS-open). Every ranking showing the same Board shares one read every 5 s at most.
// `rows` is null while the Board can't be read: the ranking then shows this device's "today" board.

/** Who is playing here, set when a run starts and finishes; marks "you" on the central Board. */
export const centralYou = reactive<CentralYou & { sub?: string }>({});

const POLL_MS = 5000;
type Cached = { data: CentralLeaderboard | null; at: number; inflight?: Promise<void>; key: string };
const cache = new Map<string, Cached>();
const subscribers = new Map<string, Set<() => void>>();

function scoreboardConfig(): { url: string; boothId: string } | null {
  try {
    const pub = useRuntimeConfig().public as { scoreboardUrl?: string; scoreboardBoothId?: string };
    const url = String(pub.scoreboardUrl ?? "").trim();
    const boothId = String(pub.scoreboardBoothId ?? "").trim();
    return url && boothId ? { url, boothId } : null;
  } catch {
    return null; // outside Nuxt (unit tests): local boards only
  }
}

async function load(boardId: string, config: { url: string; boothId: string }): Promise<void> {
  const key = `${boardId}|${centralYou.sub ?? ""}`;
  const entry = cache.get(boardId);
  if (entry?.inflight || (entry && entry.key === key && Date.now() - entry.at < POLL_MS - 500)) return entry?.inflight;
  const next: Cached = entry ?? { data: null, at: 0, key };
  next.inflight = fetchCentralBoard(config, boardId, centralYou.sub)
    .then((data) => { next.data = data; }, () => { next.data = null; })
    .finally(() => { next.at = Date.now(); next.key = key; next.inflight = undefined; subscribers.get(boardId)?.forEach((fn) => fn()); });
  cache.set(boardId, next);
  return next.inflight;
}

export function useCentralBoard(board: Ref<RankingBoard>) {
  const config = scoreboardConfig();
  const boardId = computed(() => (config ? centralBoardId(board.value) : undefined));
  const data = ref<CentralLeaderboard | null>(null);
  const sync = () => { data.value = boardId.value ? cache.get(boardId.value)?.data ?? null : null; };
  let timer: ReturnType<typeof setInterval> | undefined;
  let subscribed: string | undefined;

  function follow(id: string | undefined) {
    if (subscribed) subscribers.get(subscribed)?.delete(sync);
    subscribed = id;
    if (!id) { sync(); return; }
    if (!subscribers.has(id)) subscribers.set(id, new Set());
    subscribers.get(id)!.add(sync);
    sync();
    void load(id, config!);
  }
  onMounted(() => {
    follow(boardId.value);
    if (config) timer = setInterval(() => { if (boardId.value) void load(boardId.value, config); }, POLL_MS);
  });
  watch(boardId, (id) => follow(id));
  watch(() => centralYou.sub, () => { if (boardId.value && config) void load(boardId.value, config); });
  onBeforeUnmount(() => { clearInterval(timer); follow(undefined); });

  /** The central Board as ranking rows, or null (not a challenge board, not set up, or unreachable). */
  const rows = computed<Score[] | null>(() => {
    if (!boardId.value || !data.value) return null;
    return centralScores(boardId.value, data.value.entries, { ...centralYou, meRank: centralYou.sub ? data.value.me?.rank : undefined });
  });
  /** The signed-in kid's place, even outside the list. */
  const me = computed(() => (centralYou.sub ? data.value?.me ?? null : null));
  /** This ranking would come from the Scoreboard if it could be read. */
  const wanted = computed(() => Boolean(boardId.value));
  return { rows, me, wanted, refresh: () => (boardId.value && config ? load(boardId.value, config) : Promise.resolve()) };
}
