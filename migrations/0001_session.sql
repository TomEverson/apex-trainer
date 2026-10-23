-- SPEC-002 — one row per finished tracking run. Raw per-frame samples live
-- in R2 (samples_key); the most-queried metrics are real columns so trends
-- can be analysed with plain SQL, the full summary is in summary_json.
CREATE TABLE session (
  id               TEXT PRIMARY KEY,           -- ULID
  scenario_id      TEXT NOT NULL,
  scenario_name    TEXT NOT NULL,
  scenario_json    TEXT NOT NULL,
  seed             INTEGER NOT NULL,
  started_at       TEXT NOT NULL,
  ended_at         TEXT NOT NULL,
  duration_s       REAL NOT NULL,
  cm360            REAL NOT NULL,
  dpi              REAL NOT NULL,
  fov              REAL NOT NULL,
  settings_json    TEXT NOT NULL,
  environment_json TEXT NOT NULL,
  accuracy         REAL,
  steady_accuracy  REAL,
  turn_accuracy    REAL,
  lag_deg          REAL,
  velocity_match   REAL,
  reaction_ms      REAL,
  jitter_deg_s     REAL,
  summary_json     TEXT NOT NULL,
  tips_json        TEXT NOT NULL,
  samples_key      TEXT NOT NULL,
  created_at       TEXT NOT NULL
);

CREATE INDEX idx_session_scenario_started ON session (scenario_id, started_at);
CREATE INDEX idx_session_started ON session (started_at);
