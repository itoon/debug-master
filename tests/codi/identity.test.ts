import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCodiPlayer } from "../../app/utils/codiIdentity";
import { createLocalRepositories } from "../../app/storage/LocalStorageAdapter";
import { createCompetitionSession } from "../../app/utils/competition/session";
import { newSession, operation } from "../competition/fixtures";

const badge = "HTt1UMt9AmnCvTl0sm0yRQ";

describe("Codi Arena returning player", () => {
  it("starts a new local player when the badge name is free", () => {
    expect(resolveCodiPlayer(badge, "ทดสอบมะลิ", [], {})).toEqual({ status: "new" });
  });

  it("continues the same player when that badge already played", () => {
    expect(resolveCodiPlayer(badge, "ทดสอบมะลิ", [{ name: "ทดสอบมะลิ", playerId: "player-1" }], { [badge]: "player-1" })).toEqual({ status: "same", playerId: "player-1" });
  });

  it("recognizes a badge that played before the link was stored", () => {
    expect(resolveCodiPlayer(badge, " ทดสอบมะลิ ", [{ name: "ทดสอบมะลิ", playerId: "player-1" }], {})).toEqual({ status: "same", playerId: "player-1" });
  });

  it("keeps another person's name taken", () => {
    expect(resolveCodiPlayer(badge, "ทดสอบมะลิ", [{ name: "ทดสอบมะลิ", playerId: "player-2" }], { other: "player-2" })).toEqual({ status: "taken" });
    expect(resolveCodiPlayer(badge, "ทดสอบมะลิ", [{ name: "ทดสอบมะลิ", playerId: "player-2" }], { [badge]: "player-1" })).toEqual({ status: "taken" });
  });
});

describe("Codi link stored with a finished run", () => {
  const memory = new Map<string, string>();
  beforeEach(() => {
    memory.clear();
    const events = new EventTarget();
    vi.stubGlobal("window", Object.assign(events, {
      isSecureContext: true,
      localStorage: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => memory.set(key, value),
        removeItem: (key: string) => memory.delete(key),
      },
    }));
    const queues = new Map<string, Promise<unknown>>();
    vi.stubGlobal("navigator", { locks: { request: <T>(key: string, run: () => T) => {
      const next = (queues.get(key) ?? Promise.resolve()).then(run);
      queues.set(key, next.catch(() => undefined));
      return next;
    } } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("lets the same badge continue the player saved before a link existed", async () => {
    const repos = createLocalRepositories();
    await repos.sessions.create(createCompetitionSession(newSession({ name: "ทดสอบมะลิ", playerId: "player-1", mode: "timer" })));
    await repos.sessions.apply("session-1", operation("finish", 0, 1));
    const scores = repos.scores.list();
    expect(resolveCodiPlayer(badge, "ทดสอบมะลิ", scores, repos.players.codiLinks())).toEqual({ status: "same", playerId: "player-1" });
    await repos.players.rememberCodi(badge, "player-1");
    expect(repos.players.codiLinks()).toEqual({ [badge]: "player-1" });
    expect(resolveCodiPlayer("someone-else", "ทดสอบมะลิ", scores, repos.players.codiLinks())).toEqual({ status: "taken" });
  });
});
