-- Codi Arena login has no age. Keep older rows, and allow a round result without one.
CREATE TABLE round_players_next (
  round_key TEXT NOT NULL REFERENCES rounds (round_key) ON DELETE CASCADE,
  public_id TEXT NOT NULL,
  rank INTEGER NOT NULL,
  name TEXT NOT NULL,
  avatar_id TEXT NOT NULL,
  age INTEGER,
  score INTEGER NOT NULL,
  levels_completed INTEGER NOT NULL,
  best_combo INTEGER NOT NULL,
  PRIMARY KEY (round_key, public_id)
);

INSERT INTO round_players_next (round_key, public_id, rank, name, avatar_id, age, score, levels_completed, best_combo)
SELECT round_key, public_id, rank, name, avatar_id, age, score, levels_completed, best_combo FROM round_players;

DROP TABLE round_players;
ALTER TABLE round_players_next RENAME TO round_players;
