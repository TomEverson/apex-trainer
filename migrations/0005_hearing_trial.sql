-- SPEC-005 — footstep audio trainer. One row per trial, every mode.
-- true_value/answer are text so each mode can store its own kind of value
-- (direction: degrees, distance: near|mid|far, ...).
CREATE TABLE hearing_trial (
  id          TEXT PRIMARY KEY,           -- ULID
  mode        TEXT NOT NULL,              -- direction | distance | moving | discrimination
  level       INTEGER NOT NULL,           -- difficulty 1–10 when the trial ran
  locked      INTEGER NOT NULL,           -- 1 when the level was locked manually
  true_value  TEXT NOT NULL,
  answer      TEXT NOT NULL,
  error       REAL NOT NULL,              -- degrees for direction/moving, 0|1 otherwise
  correct     INTEGER NOT NULL,
  reaction_ms REAL,                       -- audio onset → answer
  detail_json TEXT NOT NULL,              -- mode-specific cues (gait, surface, distractor level, ...)
  created_at  TEXT NOT NULL
);

CREATE INDEX idx_hearing_trial_mode_created ON hearing_trial (mode, created_at);
