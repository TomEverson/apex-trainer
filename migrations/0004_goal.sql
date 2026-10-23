-- SPEC-004 — weekly per-scenario-variant goals. target is accuracy (0–1) for
-- tracking scenarios and kills for clicking ones. week_start is the Monday of
-- the player's local week (YYYY-MM-DD).
CREATE TABLE goal (
  id          TEXT PRIMARY KEY,           -- ULID
  scenario_id TEXT NOT NULL,              -- variant id, e.g. strafe-reactive@0.7x
  target      REAL NOT NULL,
  week_start  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (scenario_id, week_start)
);

CREATE INDEX idx_goal_week ON goal (week_start);
