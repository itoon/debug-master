import { describe, expect, it, vi } from 'vitest'
import type { CompetitionSession } from '../../app/types/competition'
import { createCompetitionSession } from '../../app/utils/competition/session'
import {
  centralBoardId, centralScores, createHubProfiles, createScoreboardOutbox, relayOutcome, scoreboardBody, sendViaRelay, type RelayBody,
} from '../../app/utils/scoreboard'
import { newSession, START } from '../competition/fixtures'

// COD-1144: a finished Challenge A/B/C run at 5:00 goes to its Tier's Board on the Codi Arena Scoreboard.
function finished(overrides: Parameters<typeof newSession>[0] = {}, totalScore = 1250): CompetitionSession {
  const s = createCompetitionSession(newSession({ id: 'session-1', playerId: 'player-1', name: 'Ploy', ...overrides }))
  return { ...s, status: 'finished', finishedAt: START + 300_000, totalScore }
}
const hub = { sub: 'abc', nickname: 'Ploy', picture: 'https://hub/p.png', arena_no: 14, arena_test: false }

function memoryStorage() {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v) }, removeItem: (k: string) => { data.delete(k) } }
}

describe('scoreboardBody', () => {
  it('maps Challenge A, B, C to the beginner, intermediate and pro Boards', () => {
    expect(scoreboardBody(finished({ challengeId: 'A' }), undefined)?.board).toBe('beginner')
    expect(scoreboardBody(finished({ challengeId: 'B' }), undefined)?.board).toBe('intermediate')
    expect(scoreboardBody(finished({ challengeId: 'C' }), undefined)?.board).toBe('pro')
  })
  it('sends a Hub player with their sign-in profile, keyed by the session id', () => {
    expect(scoreboardBody(finished(), hub)).toEqual({ score: 1250, board: 'beginner', submissionId: 'session-1', hubUser: hub })
  })
  it('sends a typed player as a Guest whose id is the local player', () => {
    expect(scoreboardBody(finished(), undefined)).toEqual({ score: 1250, board: 'beginner', submissionId: 'session-1', guest: { name: 'Ploy', guestId: 'player-1' } })
  })
  it('skips runs that are not finished 5:00 challenge runs at the default difficulty', () => {
    expect(scoreboardBody(createCompetitionSession(newSession()), undefined)).toBeUndefined()
    expect(scoreboardBody(finished({ challengeId: undefined }), undefined)).toBeUndefined()
    expect(scoreboardBody(finished({ timeLimitSec: 600 }), undefined)).toBeUndefined()
    expect(scoreboardBody(finished({ config: { difficulty: 2 } }), undefined)).toBeUndefined()
  })
})

describe('relayOutcome', () => {
  it('201/200 are sent; retryable codes and network errors stay pending; the rest is final', () => {
    expect(relayOutcome(201)).toBe('sent')
    expect(relayOutcome(200)).toBe('sent')
    for (const code of ['RATE_LIMITED', 'HUB_UNAVAILABLE', 'INTERNAL', 'NETWORK']) expect(relayOutcome(500, code), code).toBe('pending')
    expect(relayOutcome(0)).toBe('pending')
    expect(relayOutcome(409, 'BOOTH_CLOSED')).toBe('closed')
    for (const code of ['INVALID_BODY', 'BOARD_NOT_FOUND', 'SCORE_OUT_OF_RANGE', 'FORBIDDEN_ORIGIN']) expect(relayOutcome(400, code), code).toBe('rejected')
  })
})

describe('sendViaRelay', () => {
  const body = scoreboardBody(finished(), undefined)!
  it('posts to the Worker\'s /scores and reads the Scoreboard\'s code', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: { code: 'BOOTH_CLOSED', message: 'x' } }), { status: 409 }))
    expect(await sendViaRelay('https://live.example/', body, fetchImpl as unknown as typeof fetch)).toBe('closed')
    expect(fetchImpl).toHaveBeenCalledWith('https://live.example/scores', expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }))
  })
  it('a network failure is pending', async () => {
    expect(await sendViaRelay('https://live.example', body, (async () => { throw new TypeError('offline') }) as unknown as typeof fetch)).toBe('pending')
  })
})

describe('scoreboard outbox', () => {
  const run = (id: string): RelayBody => ({ score: 1, board: 'pro', submissionId: id, guest: { name: 'P', guestId: 'p' } })

  it('keeps a pending run and resends it with the same submissionId until it is sent', async () => {
    const storage = memoryStorage()
    const send = vi.fn<(b: RelayBody) => Promise<'sent' | 'pending'>>().mockResolvedValueOnce('pending').mockResolvedValue('sent')
    const outbox = createScoreboardOutbox(storage, send)
    expect(await outbox.submit(run('s-1'))).toBe('pending')
    // A reload builds a new outbox from the same storage.
    const again = createScoreboardOutbox(storage, send)
    expect(again.pending()).toEqual([run('s-1')])
    await again.flush()
    expect(send.mock.calls.map(([b]) => b.submissionId)).toEqual(['s-1', 's-1'])
    expect(again.pending()).toEqual([])
  })

  it('drops runs the Scoreboard refused for good, and never queues one twice', async () => {
    const storage = memoryStorage()
    const outbox = createScoreboardOutbox(storage, async () => 'rejected')
    expect(await outbox.submit(run('s-1'))).toBe('rejected')
    expect(outbox.pending()).toEqual([])
    const pendingBox = createScoreboardOutbox(storage, async () => 'pending')
    await pendingBox.submit(run('s-2'))
    await pendingBox.submit(run('s-2'))
    expect(pendingBox.pending()).toHaveLength(1)
  })

  it('works without storage (private mode): it just sends', async () => {
    const outbox = createScoreboardOutbox(null, async () => 'sent')
    expect(await outbox.submit(run('s-1'))).toBe('sent')
  })
})

describe('Hub profiles', () => {
  it('remembers a badge kid\'s profile for their player, for later runs and reloads', () => {
    const storage = memoryStorage()
    createHubProfiles(storage).remember('player-1', hub)
    expect(createHubProfiles(storage).forPlayer('player-1')).toEqual(hub)
    expect(createHubProfiles(storage).forPlayer('player-2')).toBeUndefined()
  })
})

// COD-1145: challenge rankings come from the central Board; this device's "today" board only when it can't be read.
describe('centralBoardId', () => {
  const board = { challengeId: 'B' as const, setId: 'challenge-intermediate', mode: 'timer' as const, timeLimitSec: 300, difficulty: 1, scoringStrategy: 'BEST' as const }
  it('names the Tier Board for the event\'s challenge setup', () => {
    expect(centralBoardId(board)).toBe('intermediate')
  })
  it('keeps staff setups, practice and other modes on this device', () => {
    expect(centralBoardId({ ...board, timeLimitSec: 600 })).toBeUndefined()
    expect(centralBoardId({ ...board, difficulty: 2 })).toBeUndefined()
    expect(centralBoardId({ ...board, challengeId: undefined })).toBeUndefined()
  })
})

describe('centralScores', () => {
  const entries = [
    { rank: 1, playerType: 'user' as const, displayName: 'Ploy', arenaNo: 14, pictureUrl: 'https://hub/p.png', value: 900, playCount: 3 },
    { rank: 2, playerType: 'guest' as const, displayName: 'Mew', value: 640, playCount: 1 },
  ]
  it('shapes Scoreboard entries as ranking rows with their pictures and play counts', () => {
    const rows = centralScores('pro', entries, {})
    expect(rows.map(r => [r.name, r.score, r.avatarId])).toEqual([['Ploy', 900, 'https://hub/p.png'], ['Mew', 640, 'codi_default.svg']])
    expect(rows[0]!.central).toEqual({ plays: 3, arenaNo: 14 })
    expect(new Set(rows.map(r => r.id)).size).toBe(2)
  })
  it('gives "you" the local player and session, by Hub rank or Guest nickname', () => {
    const you = { playerId: 'player-1', sessionId: 'session-9', nickname: 'mew' }
    const rows = centralScores('pro', entries, you)
    expect(rows[1]).toMatchObject({ id: 'session-9', playerId: 'player-1' })
    expect(rows[0]!.playerId).not.toBe('player-1')
    const hubRows = centralScores('pro', entries, { ...you, meRank: 1, nickname: undefined })
    expect(hubRows[0]).toMatchObject({ id: 'session-9', playerId: 'player-1' })
  })
})
