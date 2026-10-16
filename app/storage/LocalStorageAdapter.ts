import type { Score } from "../types/debug-game";
import { todayRanking, scorePlayerKey, hasRankingScore, isOnBoard, bangkokDay, type RankingBoard } from "../utils/ranking";
import { CHALLENGE_IDS, type ChallengeId } from "../data/home-config";
import type { ModeSettingsRepository, PlayerProfile, PlayerRepository, ScoreRepository } from "./contracts";

const SCHEMA_VERSION = 1;
const NAMESPACE = "codeventure:debug-master:home-v2:v1:";
const CHANGE_EVENT = `${NAMESPACE}changed`;

/** HTTP LAN pages lack Web Locks. A shared readwrite transaction serializes
 * synchronous localStorage mutations across tabs without changing score storage.
 * Only the coordination store lives in IndexedDB; no profile/score data moves. */
function mutateOnLocalHttp(key: string, operation: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(`${NAMESPACE}mutation-lock`, 1);
    let blocked = false;
    request.onupgradeneeded = () => request.result.createObjectStore("mutations");
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error("Local storage coordination is blocked"));
    };
    request.onsuccess = () => {
      const database = request.result;
      // A delayed open must not write after reporting a blocked operation.
      if (blocked) { database.close(); return; }
      database.onversionchange = () => database.close();
      try {
        const transaction = database.transaction("mutations", "readwrite");
        let operationError: unknown;
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onabort = () => {
          database.close();
          reject(operationError ?? transaction.error ?? new Error("Local storage coordination failed"));
        };
        // This callback runs only after this transaction owns the shared store.
        // Do not await inside it: keep the read/modify/write under the same lock.
        transaction.objectStore("mutations").get(key).onsuccess = () => {
          try { operation(); }
          catch (error) { operationError = error; transaction.abort(); }
        };
      } catch (error) { database.close(); reject(error); }
    };
  });
}

/** The only layer that touches browser storage. Old Dev keys are untouched. */
export class LocalStorageAdapter {
  async mutate(key: string, operation: () => void): Promise<void> {
    // All tabs on a non-secure origin use the same transaction coordinator.
    // Secure origins keep their existing Web Locks path, with no mixed locks.
    if (!window.isSecureContext) {
      await mutateOnLocalHttp(key, operation);
      return;
    }
    // Fail closed if coordination is unavailable; never write without a lock.
    if (!navigator.locks) throw new Error("Web Locks are required for safe local storage updates");
    await navigator.locks.request(NAMESPACE + key, operation);
  }
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
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  subscribe(listener: () => void, key = "scores"): () => void {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === NAMESPACE + key) listener();
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
    (score.challengeId === undefined || ["A", "B", "C"].includes(score.challengeId)) &&
    (score.avatarId === undefined || typeof score.avatarId === "string"),
  );
}

export class LocalPlayerRepository implements PlayerRepository {
  constructor(private readonly adapter: LocalStorageAdapter) {}
  save(player: PlayerProfile): Promise<void> { return this.adapter.mutate("player", () => this.adapter.write("player", player)); }
  clearCurrent(): Promise<void> { return this.adapter.mutate("player", () => this.adapter.remove("player")); }
  clearIfPlayer(playerId: string): Promise<void> {
    return this.adapter.mutate("player", () => {
      const current = this.adapter.read<PlayerProfile | undefined>("player", undefined, (value): value is PlayerProfile | undefined =>
        value === undefined || Boolean(value && typeof value === "object" &&
          typeof (value as PlayerProfile).id === "string" && typeof (value as PlayerProfile).nickname === "string" &&
          Number.isFinite((value as PlayerProfile).age)),
      );
      if (current?.id === playerId) this.adapter.remove("player");
    });
  }
}

export class LocalScoreRepository implements ScoreRepository {
  constructor(private readonly adapter: LocalStorageAdapter) {}
  list(): Score[] { return this.adapter.read("scores", [], validScores); }
  save(score: Score): Promise<void> {
    return this.adapter.mutate("scores", () => {
      // Upsert makes a retry idempotent and never duplicates a finished run.
      const rows = this.list().filter((item) => item.id !== score.id);
      this.adapter.write("scores", [...rows, score]);
    });
  }
  remove(scoreId: string): Promise<void> {
    return this.removeMany([scoreId]);
  }
  removeMany(scoreIds: readonly string[]): Promise<void> {
    if (!scoreIds.length) return Promise.resolve();
    const selected = new Set(scoreIds);
    return this.adapter.mutate("scores", () => {
      const rows = this.list();
      const remaining = rows.filter((score) => !selected.has(score.id));
      if (remaining.length === rows.length) return;
      // Read the current list inside the mutation and write once: no partial batch.
      this.adapter.write("scores", remaining);
    });
  }
  today(board: RankingBoard, now = new Date(), limit = 10): Score[] {
    return todayRanking(this.list(), board, now, limit);
  }
  rank(scoreId: string, board: RankingBoard, now = new Date()): number | undefined {
    const scores = this.list();
    const run = scores.find((item) => item.id === scoreId && isOnBoard(item, board) && bangkokDay(item.createdAt) === bangkokDay(now));
    if (!run || !hasRankingScore(run)) return undefined;
    const index = todayRanking(scores, board, now, Infinity).findIndex((item) =>
      board.challengeId ? scorePlayerKey(item) === scorePlayerKey(run) : item.id === scoreId,
    );
    return index < 0 ? undefined : index + 1;
  }
  subscribe(listener: () => void): () => void { return this.adapter.subscribe(listener); }
}

function validModeIds(value: unknown): value is ChallengeId[] | undefined {
  return value === undefined || (Array.isArray(value) && value.every((id) => CHALLENGE_IDS.includes(id)));
}

export class LocalModeSettingsRepository implements ModeSettingsRepository {
  constructor(private readonly adapter: LocalStorageAdapter) {}
  enabledIds(): ChallengeId[] | undefined { return this.adapter.read("modes", undefined, validModeIds); }
  save(ids: ChallengeId[]): Promise<void> {
    if (!ids.length || !validModeIds(ids)) return Promise.reject(new Error("At least one valid mode must stay enabled"));
    return this.adapter.mutate("modes", () => this.adapter.write("modes", [...new Set(ids)]));
  }
  reset(): Promise<void> { return this.adapter.mutate("modes", () => this.adapter.remove("modes")); }
  subscribe(listener: () => void): () => void { return this.adapter.subscribe(listener, "modes"); }
}

export function createLocalRepositories() {
  const adapter = new LocalStorageAdapter();
  return {
    players: new LocalPlayerRepository(adapter),
    scores: new LocalScoreRepository(adapter),
    modes: new LocalModeSettingsRepository(adapter),
  };
}
