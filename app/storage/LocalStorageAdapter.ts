import type { Score } from "../types/debug-game";
import { CompetitionSessionRepository } from "./CompetitionSessionRepository";
import { toScore } from "../utils/competition/session";
import { todayRanking, type RankingBoard } from "../utils/ranking";
import { CHALLENGE_IDS, isCompetitionTime, isLoginMethod, type ChallengeId, type LoginMethod, type ModeScoringStrategies } from "../data/home-config";
import type { ScoringStrategy } from "../types/competition";
import type { ModeSettingsRepository, PlayerProfile, PlayerRepository, ScoreRepository } from "./contracts";

const SCHEMA_VERSION = 1;
const NAMESPACE = "codeventure:debug-master:home-v2:v1:";
const CHANGE_EVENT = `${NAMESPACE}changed`;

/** HTTP LAN pages lack Web Locks. A shared readwrite transaction serializes
 * synchronous localStorage mutations across tabs without changing score storage.
 * Only the coordination store lives in IndexedDB; no profile/score data moves. */
function mutateOnLocalHttp<T>(key: string, operation: () => T): Promise<T> {
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
        let result: T;
        transaction.oncomplete = () => { database.close(); resolve(result); };
        transaction.onabort = () => {
          database.close();
          reject(operationError ?? transaction.error ?? new Error("Local storage coordination failed"));
        };
        // This callback runs only after this transaction owns the shared store.
        // Do not await inside it: keep the read/modify/write under the same lock.
        transaction.objectStore("mutations").get(key).onsuccess = () => {
          try { result = operation(); }
          catch (error) { operationError = error; transaction.abort(); }
        };
      } catch (error) { database.close(); reject(error); }
    };
  });
}

/** The only layer that touches browser storage. Old Dev keys are untouched. */
export class LocalStorageAdapter {
  async mutate<T>(key: string, operation: () => T): Promise<T> {
    // Preserve the generic receipt result on both secure and LAN origins.
    if (!window.isSecureContext) return await mutateOnLocalHttp(key, operation);
    // Fail closed if coordination is unavailable; never write without a lock.
    if (!navigator.locks) throw new Error("Web Locks are required for safe local storage updates");
    return await navigator.locks.request(NAMESPACE + key, operation);
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

  subscribe(listener: () => void, key: string | readonly string[] = "scores"): () => void {
    const keys = (typeof key === "string" ? [key] : key).map(item => NAMESPACE + item);
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || keys.includes(event.key)) listener();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGE_EVENT, listener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHANGE_EVENT, listener);
    };
  }
}

function isStoredPlayer(value: unknown): value is PlayerProfile | undefined {
  if (value === undefined) return true;
  if (!value || typeof value !== "object") return false;
  const player = value as PlayerProfile;
  return typeof player.id === "string" && typeof player.nickname === "string" && (player.age === undefined || Number.isFinite(player.age));
}

function isCodiSub(value: string): boolean {
  return value.length > 0 && value.length <= 200 && value !== "__proto__" && value !== "constructor" && value !== "prototype";
}

function isCodiLinks(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(([sub, playerId]) => isCodiSub(sub) && typeof playerId === "string" && playerId.length > 0 && playerId.length <= 80);
}

export class LocalPlayerRepository implements PlayerRepository {
  constructor(private readonly adapter: LocalStorageAdapter) {}
  save(player: PlayerProfile): Promise<void> { return this.adapter.mutate("player", () => this.adapter.write("player", player)); }
  clearCurrent(): Promise<void> { return this.adapter.mutate("player", () => this.adapter.remove("player")); }
  clearIfPlayer(playerId: string): Promise<void> {
    return this.adapter.mutate("player", () => {
      const current = this.adapter.read<PlayerProfile | undefined>("player", undefined, isStoredPlayer);
      if (current?.id === playerId) this.adapter.remove("player");
    });
  }
  codiLinks(): Record<string, string> {
    try { return this.adapter.read("codi-links", {}, isCodiLinks); }
    catch { return {}; }
  }
  rememberCodi(sub: string, playerId: string): Promise<void> {
    if (!isCodiSub(sub) || playerId.length === 0 || playerId.length > 80) return Promise.reject(new Error("Invalid Codi player link"));
    return this.adapter.mutate("codi-links", () => {
      const links = Object.create(null) as Record<string, string>;
      for (const [key, value] of Object.entries(this.codiLinks())) links[key] = value;
      if (links[sub] === playerId) return;
      links[sub] = playerId;
      this.adapter.write("codi-links", links);
    });
  }
}

export class LocalScoreRepository implements ScoreRepository {
  constructor(private readonly sessions: CompetitionSessionRepository) {}
  list(): Score[] { return this.sessions.list().filter(session => session.status === "finished").map(toScore); }
  /** Transitional caller adapter: finish the existing session, never accept a copied total. */
  async save(score: Score): Promise<void> {
    const session = this.sessions.get(score.id);
    if (!session) throw new Error("Competition session not found");
    if (session.status === "finished") return;
    await this.sessions.apply(session.id, {
      id: `score-save:${session.id}`, type: "finish", expectedRevision: session.revision,
      at: Math.max(session.updatedAt, session.startedAt + score.elapsedMs),
    });
  }
  remove(scoreId: string): Promise<void> { return this.removeMany([scoreId]); }
  removeMany(scoreIds: readonly string[]): Promise<void> { return this.sessions.removeMany(scoreIds); }
  today(board: RankingBoard, now = new Date(), limit = 10): Score[] {
    return todayRanking(this.list(), board, now, limit);
  }
  rank(scoreId: string, board: RankingBoard, now = new Date()): number | undefined {
    const index = todayRanking(this.list(), board, now, Infinity).findIndex(item => item.id === scoreId);
    return index < 0 ? undefined : index + 1;
  }
  subscribe(listener: () => void): () => void { return this.sessions.subscribe(listener); }
}

function validModeIds(value: unknown): value is ChallengeId[] | undefined {
  return value === undefined || (Array.isArray(value) && value.every((id) => CHALLENGE_IDS.includes(id)));
}

function validModeStrategies(value: unknown): value is ModeScoringStrategies {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) &&
    Object.entries(value).every(([id, strategy]) => CHALLENGE_IDS.includes(id as ChallengeId) && (strategy === "BEST" || strategy === "LATEST")));
}

export class LocalModeSettingsRepository implements ModeSettingsRepository {
  constructor(private readonly adapter: LocalStorageAdapter) {}
  enabledIds(): ChallengeId[] | undefined { return this.adapter.read("modes", undefined, validModeIds); }
  scoringStrategies(): ModeScoringStrategies { return this.adapter.read("mode-scoring", {}, validModeStrategies); }
  durationSec(): number | undefined {
    return this.adapter.read<number | undefined>('mode-duration', undefined, (value): value is number | undefined => value === undefined || isCompetitionTime(value));
  }
  save(ids: ChallengeId[]): Promise<void> {
    if (!ids.length || !validModeIds(ids)) return Promise.reject(new Error("At least one valid mode must stay enabled"));
    return this.adapter.mutate("modes", () => this.adapter.write("modes", [...new Set(ids)]));
  }
  setScoringStrategy(id: ChallengeId, strategy: ScoringStrategy): Promise<void> {
    if (!CHALLENGE_IDS.includes(id) || (strategy !== "BEST" && strategy !== "LATEST")) return Promise.reject(new Error("Invalid mode scoring strategy"));
    return this.adapter.mutate("modes", () => {
      this.adapter.write("mode-scoring", { ...this.scoringStrategies(), [id]: strategy });
    });
  }
  saveDuration(seconds: number): Promise<void> {
    if (!isCompetitionTime(seconds)) return Promise.reject(new Error('Competition time must be whole minutes within the configured range'));
    return this.adapter.mutate('modes', () => this.adapter.write('mode-duration', seconds));
  }
  loginMethod(): LoginMethod | undefined {
    return this.adapter.read<LoginMethod | undefined>('login-method', undefined, (value): value is LoginMethod | undefined => value === undefined || isLoginMethod(value));
  }
  setLoginMethod(method: LoginMethod): Promise<void> {
    if (!isLoginMethod(method)) return Promise.reject(new Error('Login method must be manual or oauth'));
    return this.adapter.mutate('modes', () => this.adapter.write('login-method', method));
  }
  reset(): Promise<void> {
    return this.adapter.mutate('modes', () => {
      this.adapter.remove('mode-scoring');
      this.adapter.remove('mode-duration');
      this.adapter.remove('modes');
      this.adapter.remove('login-method');
    });
  }
  subscribe(listener: () => void): () => void { return this.adapter.subscribe(listener, ['modes', 'mode-duration', 'mode-scoring', 'login-method']); }
}

export function createLocalRepositories() {
  const adapter = new LocalStorageAdapter();
  const sessions = new CompetitionSessionRepository(adapter);
  return {
    players: new LocalPlayerRepository(adapter),
    scores: new LocalScoreRepository(sessions),
    sessions,
    modes: new LocalModeSettingsRepository(adapter),
  };
}
