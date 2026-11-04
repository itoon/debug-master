import { describe, expect, it } from "vitest";
import { CHALLENGE_BOARDS, createScoreboardClient } from "../../app/utils/scoreboardClient";

// The game is one Codi Arena booth; home challenges A, B, C are its Beginner, Intermediate and Pro Boards.
function recorder(status: number, body: unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

describe("Codi Arena Scoreboard client", () => {
  it("maps challenges A, B, C to the beginner, intermediate and pro Boards", () => {
    expect(CHALLENGE_BOARDS).toEqual({ A: "beginner", B: "intermediate", C: "pro" });
  });

  it("reads one Board of the booth", async () => {
    const { calls, fetchImpl } = recorder(200, { booth: { id: "debug-master" }, board: { id: "pro", name: "Pro" }, entries: [], me: null });
    const client = createScoreboardClient({ baseUrl: "http://hub.test/", boothId: "debug-master", fetch: fetchImpl });
    const board = await client.getLeaderboard({ board: "pro", limit: 10, userId: "kid" });
    expect(calls[0]!.url).toBe("http://hub.test/api/booths/debug-master/leaderboard?board=pro&limit=10&userId=kid");
    expect(board.board).toEqual({ id: "pro", name: "Pro" });
  });

  it("names the Board in a submit", async () => {
    const { calls, fetchImpl } = recorder(201, { scoreId: "s", entry: { value: 9, playCount: 1, improved: true } });
    const client = createScoreboardClient({ baseUrl: "http://hub.test", boothId: "debug-master", auth: "bk_x", maxAttempts: 1, fetch: fetchImpl });
    const result = await client.submitScore({ score: 9, board: "intermediate", submissionId: "round-1", guest: { name: "a" } });
    expect(result.ok).toBe(true);
    expect(JSON.parse(String(calls[0]!.init!.body))).toEqual({ score: 9, board: "intermediate", submissionId: "round-1", guest: { name: "a" } });
  });
});
