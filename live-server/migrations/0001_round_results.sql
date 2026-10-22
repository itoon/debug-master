-- Final results of each Live round, written once by the LiveRoom after the round closes.
-- Public data only: no secret pid, host key hash or private scoring ledger.
-- round_key = `${room_code}:${start_at}`; round_id alone restarts at 1 when a wiped room code is reused.
CREATE TABLE rounds (
  round_key TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  round_id INTEGER NOT NULL,
  mode TEXT NOT NULL,
  set_id TEXT NOT NULL,
  difficulty INTEGER NOT NULL,
  duration_sec INTEGER NOT NULL,
  scoring_strategy TEXT NOT NULL,
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  archived_at INTEGER NOT NULL
);

CREATE INDEX rounds_archived_at ON rounds (archived_at);

CREATE TABLE round_players (
  round_key TEXT NOT NULL REFERENCES rounds (round_key) ON DELETE CASCADE,
  public_id TEXT NOT NULL,
  rank INTEGER NOT NULL,
  name TEXT NOT NULL,
  avatar_id TEXT NOT NULL,
  age INTEGER NOT NULL,
  score INTEGER NOT NULL,
  levels_completed INTEGER NOT NULL,
  best_combo INTEGER NOT NULL,
  PRIMARY KEY (round_key, public_id)
);
