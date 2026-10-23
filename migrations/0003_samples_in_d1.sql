-- SPEC-002 — raw per-frame samples move from R2 into D1 so the whole app runs
-- on one database. Separate table so listing sessions never reads the blobs.
-- Samples of runs saved before this migration stayed in R2 and are not migrated.
CREATE TABLE session_samples (
  session_id   TEXT PRIMARY KEY REFERENCES session(id) ON DELETE CASCADE,
  samples_json TEXT NOT NULL
);

ALTER TABLE session DROP COLUMN samples_key;
