-- SPEC-006 — Recoil Control drills. One row per finished drill; the per-bullet
-- shot log lives in recoil_shots so listing never reads it. drill_json holds
-- the weapon and the exact pattern played (patterns are approximate and may be
-- recalibrated), drill_id is the variant: weapon + range + optic + mag + barrel + target.
CREATE TABLE recoil_session (
  id               TEXT PRIMARY KEY,           -- ULID
  drill_id         TEXT NOT NULL,              -- e.g. r-301@100m-x3-m2-b0
  weapon_id        TEXT NOT NULL,
  drill_json       TEXT NOT NULL,
  seed             INTEGER NOT NULL,
  started_at       TEXT NOT NULL,
  ended_at         TEXT NOT NULL,
  deg_per_count    REAL NOT NULL,              -- while aiming: after ADS multiplier and optic zoom
  fov              REAL NOT NULL,              -- rendered (zoomed) horizontal FOV
  settings_json    TEXT NOT NULL,
  environment_json TEXT NOT NULL,
  sprays           INTEGER NOT NULL,
  shots            INTEGER NOT NULL,
  hit_rate         REAL,
  mean_err_deg     REAL,
  vert_bias_deg    REAL,                       -- + = bullets above the aim point
  horiz_bias_deg   REAL,                       -- + = right
  vert_comp        REAL,                       -- share of vertical recoil cancelled
  horiz_comp       REAL,
  summary_json     TEXT NOT NULL,
  tips_json        TEXT NOT NULL,
  created_at       TEXT NOT NULL
);

CREATE INDEX idx_recoil_session_drill_started ON recoil_session (drill_id, started_at);
CREATE INDEX idx_recoil_session_weapon_started ON recoil_session (weapon_id, started_at);

CREATE TABLE recoil_shots (
  session_id  TEXT PRIMARY KEY REFERENCES recoil_session(id) ON DELETE CASCADE,
  shots_json  TEXT NOT NULL
);
