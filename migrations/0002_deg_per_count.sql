-- SPEC-001/002 — sensitivity is now game yaw × sens for presets (no DPI);
-- cm/360 + DPI only exist for custom and stay in settings_json. Degrees per
-- mouse count is the one measure comparable across every game.
ALTER TABLE session ADD COLUMN deg_per_count REAL NOT NULL DEFAULT 0;
ALTER TABLE session DROP COLUMN cm360;
ALTER TABLE session DROP COLUMN dpi;
