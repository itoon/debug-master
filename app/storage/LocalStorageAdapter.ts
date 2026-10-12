import type { Score } from "../types/debug-game";
import { todayRanking, type RankingBoard } from "../utils/ranking";
import type { PlayerProfile, PlayerRepository, ScoreRepository } from "./contracts";

const SCHEMA_VERSION = 1;
const NAMESPACE = "codeventure:debug-master:home-v2:v1:";
const CHANGE_EVENT = `${NAMESPACE}changed`;

/** The only layer that touches browser storage. Old Dev keys are untouched. */
export class LocalStorageAdapter {
  read<T>(key: string, fallback: T, valid: (value: unknown) => value is T): T {
    const raw = window.localStorage.getItem(NAMESPACE + key);
    if (raw === null) return fallback;
    const envelope = JSON.parse(raw);
    if (envelope?.schemaVersion !== SCHEMA_VERSION || !valid(envelope.data)) {
      throw new Error("Invalid or unsupported Debug Master storage schema");
    }
    return envelope.data;
  }

  write<T>(key: string, data: T): void {
    window.localStorage.setItem(NAMESPACE + key, JSON.stringify({ schemaVersion: SCHEMA_VERSION, data }));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  remove(key: string): void {
    window.localStorage.removeItem(NAMESPACE + key);
  }

  subscribe(listener: () => void): () => void {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === NAMESPACE + "scores") listener();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGE_EVENT, listener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHANGE_EVENT, listener);
    };
  }
}

function validScores(value: unknown): value is Score[] {
  return Array.isArray(value) && value.every((score) =>
    score && typeof score.id === "string" && typeof score.name === "string" &&
    typeof score.setId === "string" &&
    ["campaign", "timer", "ranking", "dead"].includes(score.mode) &&
    Number.isFinite(score.score) && Number.isFinite(score.elapsedMs) && score.elapsedMs >= 0 &&
    typeof score.createdAt === "string" && Number.isFinite(Date.parse(score.createdAt)) &&
    (score.challengeId === undefined || ["A", "B", "C"].includes(score.challengeId)),
  );
}

export class LocalPlayerRepository implements PlayerRepository {
  constructor(private readonly adapter: LocalStorageAdapter) {}
  save(player: PlayerProfile): void { this.adapter.write("player", player); }
  clearCurrent(): void { this.adapter.remove("player"); }
}

export class LocalScoreRepository implements ScoreRepository {
  constructor(private readonly adapter: LocalStorageAdapter) {}
  list(): Score[] { return this.adapter.read("scores", [], validScores); }
  save(score: Score): void {
    // Upsert makes a retry idempotent and never duplicates a finished run.
    const rows = this.list().filter((item) => item.id !== score.id);
    this.adapter.write("scores", [...rows, score]);
  }
  today(board: RankingBoard, now = new Date(), limit = 10): Score[] {
    return todayRanking(this.list(), board, now, limit);
  }
  rank(scoreId: string, board: RankingBoard, now = new Date()): number | undefined {
    const index = this.today(board, now, Infinity).findIndex((item) => item.id === scoreId);
    return index < 0 ? undefined : index + 1;
  }
  subscribe(listener: () => void): () => void { return this.adapter.subscribe(listener); }
}

export function createLocalRepositories() {
  const adapter = new LocalStorageAdapter();
  return { players: new LocalPlayerRepository(adapter), scores: new LocalScoreRepository(adapter) };
}
