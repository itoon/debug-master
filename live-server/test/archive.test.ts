import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { GRACE_MS, type PlayerHello } from '../../app/utils/live/protocol'
import { buildRoundArchive, pruneRoundArchive, writeRoundArchive, type ArchiveDb } from '../src/archive'
import {
  advanceClock,
  applyHostCommand,
  archiveDueAt,
  createRoom,
  isArchiveDue,
  joinPlayer,
  roundKey,
  type StoredRoom,
} from '../src/room-logic'

const hello = (pid: string, name: string): PlayerHello => ({ type: 'hello', pid, name, avatarId: 'codi_default.svg', age: 9 })
const PIDS = ['p-secret-a', 'p-secret-b', 'p-secret-c']
const all = new Set([...PIDS, 'p-secret-late'])

/** Three players race from t=0 (startAt 3000, endAt 303000); a fourth joins mid-round and is queued. */
function finishedRoom(): StoredRoom {
  const r = createRoom('CODI-1', 0)
  PIDS.forEach((pid, i) => joinPlayer(r, hello(pid, `P${i}`), all, 0))
  applyHostCommand(r, { type: 'start' }, all, 0)
  advanceClock(r, 3000)
  joinPlayer(r, hello('p-secret-late', 'Late'), all, 4000)
  const [a, b, c] = PIDS.map((pid) => r.players[pid])
  a.score = 1200; a.levelsCompleted = 2; a.scoring!.session.updatedAt = 50_000
  b.score = 2500; b.levelsCompleted = 3; b.scoring!.session.updatedAt = 90_000
  c.score = 1200; c.levelsCompleted = 2; c.scoring!.session.updatedAt = 70_000
  advanceClock(r, 303_000)
  return r
}

/** D1's prepare/bind/batch over Node's SQLite; a batch is one transaction, as in D1. */
function sqliteDb(): { db: ArchiveDb; sql: DatabaseSync } {
  const sql = new DatabaseSync(':memory:')
  sql.exec('PRAGMA foreign_keys = ON')
  sql.exec(readFileSync(new URL('../migrations/0001_round_results.sql', import.meta.url), 'utf8'))
  const prepare = (query: string) => ({ bind: (...values: unknown[]) => ({ query, values }) })
  const batch = async (statements: { query: string; values: unknown[] }[]) => {
    sql.exec('BEGIN')
    try {
      for (const s of statements) sql.prepare(s.query).run(...s.values)
      sql.exec('COMMIT')
    } catch (err) {
      sql.exec('ROLLBACK')
      throw err
    }
    return []
  }
  return { db: { prepare, batch } as unknown as ArchiveDb, sql }
}

describe('buildRoundArchive', () => {
  it('ranks round participants like the big screen and never includes the secret pid', () => {
    const r = finishedRoom()
    const archive = buildRoundArchive(r, 400_000)
    expect(archive.round).toMatchObject({
      roundKey: 'CODI-1:3000', roomCode: 'CODI-1', roundId: 1, mode: 'A', startAt: 3000, endAt: 303_000,
      durationSec: r.durationSec, setId: r.round!.setId, archivedAt: 400_000,
    })
    // BEST (default): the tie on score and levels goes to the earlier update.
    expect(archive.players.map((p) => [p.rank, p.name, p.score])).toEqual([[1, 'P1', 2500], [2, 'P0', 1200], [3, 'P2', 1200]])
    expect(archive.players.some((p) => p.name === 'Late')).toBe(false) // queued, not in the round
    const json = JSON.stringify(archive)
    for (const pid of all) expect(json).not.toContain(pid)
    expect(archive.players[0].publicId).toBe(r.players['p-secret-b'].id)
  })

  it('follows the round\'s LATEST strategy on ties', () => {
    const r = finishedRoom()
    r.round!.config.scoringStrategy = 'LATEST'
    expect(buildRoundArchive(r, 400_000).players.map((p) => p.name)).toEqual(['P1', 'P2', 'P0'])
  })

  it('refuses a room that never started a round', () => {
    expect(() => buildRoundArchive(createRoom('CODI-1', 0), 0)).toThrow()
  })
})

describe('archive timing', () => {
  it('is due only after the late-input grace of a finished, unarchived round', () => {
    const r = finishedRoom()
    expect(archiveDueAt(r)).toBe(303_000 + GRACE_MS)
    expect(isArchiveDue(r, 303_000 + GRACE_MS - 1)).toBe(false)
    expect(isArchiveDue(r, 303_000 + GRACE_MS)).toBe(true)
    r.archivedRoundKey = roundKey(r)!
    expect(archiveDueAt(r)).toBeNull()
  })

  it('is never due before the round finishes', () => {
    const r = createRoom('CODI-1', 0)
    expect(archiveDueAt(r)).toBeNull()
    joinPlayer(r, hello('p-secret-a', 'P0'), all, 0)
    applyHostCommand(r, { type: 'start' }, all, 0)
    expect(archiveDueAt(r)).toBeNull()
    advanceClock(r, 3000)
    expect(archiveDueAt(r)).toBeNull()
  })

  it('uses the shortened end of an early-ended round', () => {
    const r = createRoom('CODI-1', 0)
    joinPlayer(r, hello('p-secret-a', 'P0'), all, 0)
    applyHostCommand(r, { type: 'start' }, all, 0)
    advanceClock(r, 3000)
    applyHostCommand(r, { type: 'endEarly' }, all, 10_000)
    expect(archiveDueAt(r)).toBe(10_000 + GRACE_MS)
  })

  it('waits for the retry time after a failed write, and a new round starts clean', () => {
    const r = finishedRoom()
    r.archiveRetryAt = 400_000
    expect(archiveDueAt(r)).toBe(400_000)
    applyHostCommand(r, { type: 'newRound' }, all, 401_000)
    expect(r.archiveRetryAt).toBeUndefined()
    expect(archiveDueAt(r)).toBeNull()
  })

  it('gives a reused room code a new key', () => {
    const first = finishedRoom()
    const reused = createRoom('CODI-1', 10_000_000) // wiped and recreated: roundId restarts at 1
    joinPlayer(reused, hello('p-secret-a', 'P0'), all, 10_000_000)
    applyHostCommand(reused, { type: 'start' }, all, 10_000_000)
    expect(reused.roundId).toBe(first.roundId)
    expect(roundKey(reused)).not.toBe(roundKey(first))
  })
})

describe('D1 writes', () => {
  it('writes the round once, however often it is re-sent', async () => {
    const { db, sql } = sqliteDb()
    const archive = buildRoundArchive(finishedRoom(), 400_000)
    await writeRoundArchive(db, archive)
    await writeRoundArchive(db, { ...archive, round: { ...archive.round, archivedAt: 999_999 } })
    expect(sql.prepare('SELECT round_key, archived_at FROM rounds').all()).toEqual([{ round_key: 'CODI-1:3000', archived_at: 400_000 }])
    expect(sql.prepare('SELECT rank, name, score FROM round_players ORDER BY rank').all()).toEqual([
      { rank: 1, name: 'P1', score: 2500 }, { rank: 2, name: 'P0', score: 1200 }, { rank: 3, name: 'P2', score: 1200 },
    ])
  })

  it('writes nothing when any row fails', async () => {
    const { db, sql } = sqliteDb()
    const archive = buildRoundArchive(finishedRoom(), 400_000)
    archive.players[2].name = null as unknown as string // NOT NULL violation in the last statement
    await expect(writeRoundArchive(db, archive)).rejects.toThrow()
    expect(sql.prepare('SELECT * FROM rounds').all()).toEqual([])
    expect(sql.prepare('SELECT * FROM round_players').all()).toEqual([])
  })

  it('prunes only rounds archived before the cutoff', async () => {
    const { db, sql } = sqliteDb()
    const old = buildRoundArchive(finishedRoom(), 1_000)
    const recent = buildRoundArchive(finishedRoom(), 5_000)
    recent.round.roundKey = 'CODI-2:3000'
    await writeRoundArchive(db, old)
    await writeRoundArchive(db, recent)
    await pruneRoundArchive(db, 2_000)
    expect(sql.prepare('SELECT round_key FROM rounds').all()).toEqual([{ round_key: 'CODI-2:3000' }])
    expect(sql.prepare('SELECT DISTINCT round_key FROM round_players').all()).toEqual([{ round_key: 'CODI-2:3000' }])
  })
})
