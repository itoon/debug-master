// Results archive for finished Live rounds (D1, binding RESULTS_DB). Written once per round after
// the LiveRoom's standings are final; the Durable Object stays the only source of truth and the
// archive is never read back by the game. Public data only: never the secret pid, host key hash
// or private scoring ledger.
import { comparePlayers, roundKey, type StoredRoom } from './room-logic'

/** Wait before retrying a failed archive write while the round is still finished. */
export const ARCHIVE_RETRY_MS = 60_000

export type ArchivedRound = {
  roundKey: string
  roomCode: string
  roundId: number
  mode: string
  setId: string
  difficulty: number
  durationSec: number
  scoringStrategy: string
  startAt: number
  endAt: number
  archivedAt: number
}

export type ArchivedPlayer = {
  publicId: string
  rank: number
  name: string
  avatarId: string
  age: number
  score: number
  levelsCompleted: number
  bestCombo: number
}

export type RoundArchive = { round: ArchivedRound; players: ArchivedPlayer[] }

export type ArchiveDb = Pick<D1Database, 'prepare' | 'batch'>

/** The finished round's final standings: round participants only, ranked like the big screen. */
export function buildRoundArchive(room: StoredRoom, now: number): RoundArchive {
  const key = roundKey(room)
  if (key === null || room.startAt === null || room.endAt === null || !room.round) {
    throw new Error('no round to archive')
  }
  const strategy = room.round.config.scoringStrategy
  const players = Object.values(room.players)
    .filter((p) => p.status === 'playing')
    .sort((a, b) => comparePlayers(a, b, strategy))
    .map((p, i) => ({
      publicId: p.id, rank: i + 1, name: p.name, avatarId: p.avatarId, age: p.age,
      score: p.score, levelsCompleted: p.levelsCompleted, bestCombo: p.bestCombo,
    }))
  return {
    round: {
      roundKey: key, roomCode: room.code, roundId: room.roundId, mode: room.mode, setId: room.round.setId,
      difficulty: room.round.config.difficulty, durationSec: room.durationSec, scoringStrategy: strategy,
      startAt: room.startAt, endAt: room.endAt, archivedAt: now,
    },
    players,
  }
}

/** One atomic batch; re-sending the same round (alarm re-fire, retry) changes nothing. */
export async function writeRoundArchive(db: ArchiveDb, { round, players }: RoundArchive): Promise<void> {
  const insertPlayer = db.prepare(
    `INSERT INTO round_players (round_key, public_id, rank, name, avatar_id, age, score, levels_completed, best_combo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
  )
  await db.batch([
    db.prepare(
      `INSERT INTO rounds (round_key, room_code, round_id, mode, set_id, difficulty, duration_sec, scoring_strategy, start_at, end_at, archived_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
    ).bind(round.roundKey, round.roomCode, round.roundId, round.mode, round.setId, round.difficulty,
      round.durationSec, round.scoringStrategy, round.startAt, round.endAt, round.archivedAt),
    ...players.map((p) => insertPlayer.bind(round.roundKey, p.publicId, p.rank, p.name, p.avatarId, p.age,
      p.score, p.levelsCompleted, p.bestCombo)),
  ])
}

/** Retention: delete rounds archived before `before` (epoch ms), players first. */
export async function pruneRoundArchive(db: ArchiveDb, before: number): Promise<void> {
  await db.batch([
    db.prepare(
      'DELETE FROM round_players WHERE round_key IN (SELECT round_key FROM rounds WHERE archived_at < ?)',
    ).bind(before),
    db.prepare('DELETE FROM rounds WHERE archived_at < ?').bind(before),
  ])
}
