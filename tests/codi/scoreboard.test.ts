import { describe, expect, it, vi } from "vitest";
import { avatarIdFromPhotoUrl } from "../../app/data/player-avatars";
import { challengeRound, flushRounds, loginScoreTicket, queueRound, readPending, rememberScoreTicket, roundStatus, scoreTicketFor, scoreboardVersion } from "../../app/utils/scoreboard";

function memory(): Pick<Storage, "getItem" | "setItem"> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
}

describe("challengeRound", () => {
  const base = { challengeId: "C" as const, sessionId: "3f0c9c1e-6a4b-4c1e-9d0a-2b9f0d1c7e55", score: 420, playerId: "7b5d1c2e-0f3a-4a8b-9c6d-1e2f3a4b5c6d", name: " มะลิ " };

  it("names a badge player by ticket and a typed player as a guest", () => {
    expect(challengeRound({ ...base, ticket: "t.s", codiLinked: true, now: 1 })).toEqual({ challengeId: "C", submissionId: base.sessionId, score: 420, createdAt: 1, ticket: "t.s" });
    expect(challengeRound({ ...base, codiLinked: false, now: 1 })).toEqual({ challengeId: "C", submissionId: base.sessionId, score: 420, createdAt: 1, guest: { name: "มะลิ", guestId: base.playerId } });
  });

  it("sends a walk-in's avatar but never a badge player's", () => {
    const photoUrl = "https://itoon.github.io/debug-master/student-avatar/art-toy/06-sun_glassed.svg";
    expect(challengeRound({ ...base, codiLinked: false, photoUrl })?.photoUrl).toBe(photoUrl);
    expect(challengeRound({ ...base, ticket: "t.s", codiLinked: true, photoUrl })?.photoUrl).toBeUndefined();
    expect(challengeRound({ ...base, codiLinked: false, photoUrl: "http://localhost:3002/student-avatar/x.svg" })?.photoUrl).toBeUndefined();
  });

  it("maps a board photo back to the game's own avatar", () => {
    expect(avatarIdFromPhotoUrl("https://itoon.github.io/debug-master/student-avatar/art-toy/06-sun_glassed.svg")).toBe("art-toy/06-sun_glassed.svg");
    expect(avatarIdFromPhotoUrl("https://itoon.github.io/debug-master/student-avatar/codi_default.svg")).toBe("codi_default.svg");
    expect(avatarIdFromPhotoUrl("https://example.test/photo.png")).toBeUndefined();
    expect(avatarIdFromPhotoUrl(undefined)).toBeUndefined();
  });

  it("skips a badge player without a ticket and bad ids", () => {
    expect(challengeRound({ ...base, codiLinked: true })).toBeNull();
    expect(challengeRound({ ...base, sessionId: "bad id!", codiLinked: false })).toBeNull();
  });
});

describe("score tickets", () => {
  it("takes the ticket only from the same badge's login", () => {
    expect(loginScoreTicket("kid", { sub: "kid", scoreTicket: "t" })).toBe("t");
    expect(loginScoreTicket("kid", { sub: "other", scoreTicket: "t" })).toBeUndefined();
    // A typed-name player: no codiSub and no Codi result must not throw.
    expect(loginScoreTicket(undefined, undefined)).toBeUndefined();
    expect(loginScoreTicket(undefined, { sub: "kid", scoreTicket: "t" })).toBeUndefined();
  });

  it("remembers the latest ticket per player", () => {
    const storage = memory();
    rememberScoreTicket("p1", "a", storage);
    rememberScoreTicket("p2", "b", storage);
    rememberScoreTicket("p1", "c", storage);
    expect(scoreTicketFor("p1", storage)).toBe("c");
    expect(scoreTicketFor("p2", storage)).toBe("b");
    expect(scoreTicketFor("p3", storage)).toBeUndefined();
  });
});

describe("queue", () => {
  it("keeps a round on a retryable failure and sends it again with the same submissionId", async () => {
    vi.useFakeTimers();
    const storage = memory();
    const bodies: unknown[] = [];
    let fail = true;
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return fail
        ? new Response(JSON.stringify({ ok: false, code: "INTERNAL", retryable: true }), { status: 500 })
        : new Response(JSON.stringify({ ok: true, duplicate: false, entry: { value: 9, playCount: 1, improved: true } }), { status: 200 });
    }) as typeof fetch;
    // Queued before rounds carried a challengeId: sent as Beginner.
    const round = { submissionId: "round-1", score: 9, createdAt: Date.now(), guest: { name: "เอ" } };
    // queueRound flushes with the global fetch; drive the flush with ours instead.
    storage.setItem("debug-master:scoreboard-pending", JSON.stringify([round]));
    await flushRounds("http://worker.test", storage, fetchImpl);
    expect(readPending(storage)).toHaveLength(1);
    expect(roundStatus["round-1"]).toBe("pending");
    const before = scoreboardVersion.value;
    fail = false;
    await vi.advanceTimersByTimeAsync(2000);
    await flushRounds("http://worker.test", storage, fetchImpl);
    expect(readPending(storage)).toHaveLength(0);
    expect(roundStatus["round-1"]).toBe("recorded");
    expect(scoreboardVersion.value).toBe(before + 1);
    const sent = { challengeId: "A", submissionId: "round-1", score: 9, guest: { name: "เอ" } };
    expect(bodies).toEqual([sent, sent]);
    vi.useRealTimers();
  });

  it("sends a round queued while another is in flight", async () => {
    const storage = memory();
    const sent: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      const id = JSON.parse(String(init.body)).submissionId as string;
      sent.push(id);
      if (id === "overlap-1") await gate;
      return new Response(JSON.stringify({ ok: true, duplicate: false, entry: { value: 1, playCount: 1, improved: true } }), { status: 200 });
    }) as typeof fetch;
    vi.stubGlobal("fetch", fetchImpl);
    const first = queueRound({ challengeId: "A", submissionId: "overlap-1", score: 1, createdAt: Date.now(), guest: { name: "a" } }, "http://worker.test", storage);
    await Promise.resolve();
    const second = queueRound({ challengeId: "A", submissionId: "overlap-2", score: 2, createdAt: Date.now(), guest: { name: "b" } }, "http://worker.test", storage);
    release();
    await Promise.all([first, second]);
    vi.unstubAllGlobals();
    expect(sent).toEqual(["overlap-1", "overlap-2"]);
    expect(readPending(storage)).toHaveLength(0);
  });

  it("keeps sending other rounds while one has to wait", async () => {
    vi.useFakeTimers();
    const storage = memory();
    const sent: string[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      sent.push(body.submissionId);
      return body.challengeId === "B"
        ? new Response(JSON.stringify({ ok: false, code: "SCOREBOARD_OFF", retryable: false }), { status: 503 })
        : new Response(JSON.stringify({ ok: true, duplicate: false, entry: { value: 1, playCount: 1, improved: true } }), { status: 200 });
    }) as typeof fetch;
    storage.setItem("debug-master:scoreboard-pending", JSON.stringify([
      { challengeId: "B", submissionId: "wait-b", score: 1, createdAt: Date.now(), guest: { name: "a" } },
      { challengeId: "A", submissionId: "send-a", score: 1, createdAt: Date.now(), guest: { name: "a" } },
    ]));
    await flushRounds("http://worker.test", storage, fetchImpl);
    expect(sent).toEqual(["wait-b", "send-a"]);
    expect(readPending(storage).map((round) => round.submissionId)).toEqual(["wait-b"]);
    expect(roundStatus["wait-b"]).toBe("pending");
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("still sends a round when storage is full", async () => {
    const full = { getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); } };
    const sent: string[] = [];
    vi.stubGlobal("fetch", (async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)).submissionId);
      return new Response(JSON.stringify({ ok: true, duplicate: false, entry: { value: 1, playCount: 1, improved: true } }), { status: 200 });
    }) as typeof fetch);
    await queueRound({ challengeId: "A", submissionId: "full-1", score: 1, createdAt: Date.now(), guest: { name: "a" } }, "http://worker.test", full);
    vi.unstubAllGlobals();
    expect(sent).toEqual(["full-1"]);
    expect(roundStatus["full-1"]).toBe("recorded");
    expect(readPending(full)).toHaveLength(0);
  });

  it("drops a round the hub will never take and does not queue the same id twice", async () => {
    const storage = memory();
    const fetchImpl = (async () => new Response(JSON.stringify({ ok: false, code: "SCORE_OUT_OF_RANGE", retryable: false }), { status: 422 })) as typeof fetch;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    storage.setItem("debug-master:scoreboard-pending", JSON.stringify([{ submissionId: "round-2", score: -1, createdAt: Date.now(), guest: { name: "a" } }]));
    await flushRounds("http://worker.test", storage, fetchImpl);
    expect(readPending(storage)).toHaveLength(0);
    expect(roundStatus["round-2"]).toBe("dropped");
    void queueRound({ challengeId: "B", submissionId: "round-3", score: 1, createdAt: Date.now(), guest: { name: "a" } }, "", storage);
    void queueRound({ challengeId: "B", submissionId: "round-3", score: 1, createdAt: Date.now(), guest: { name: "a" } }, "", storage);
    expect(readPending(storage).map((item) => item.submissionId)).toEqual(["round-3"]);
  });
});
