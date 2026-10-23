---
title: SPEC-001 — Aim trainer: tracking scenarios & metrics
description: Playable 3D tracking scenarios with input matched to game sensitivity, plus per-run tracking metrics and instant feedback
type: spec
created: 2026-10-19
status: in-progress
---

# SPEC-001 — Aim trainer: tracking scenarios & metrics

App name: **Aim Trainer** (renamed from "Tracking Trainer" once non-strafe scenarios like Reacquire were added).

## Problem

KovaaK's tracking scores have plateaued and its single score doesn't say *why*. A run at 62% could come from lagging behind, over-correcting after reversals, being weak on one side, or tiring out, and each needs different practice. Without that breakdown, practice is guesswork.

## Goals

- Tracking scenarios that feel like an FPS: first-person camera, perspective, real angular target speeds.
- Mouse input matched to the player's game. Presets (Valorant, CS2, Apex, Overwatch, Fortnite) need only the in-game sensitivity: degrees per count = game yaw × sens, the same formula the game uses, so DPI is irrelevant. **Custom cm/360** also needs the mouse DPI, because the browser can't read DPI and cm → counts requires it. Plus horizontal FOV and raw input where the browser supports it.
- Per-run metrics that isolate *causes* of lost accuracy (see Metrics).
- Instant rule-based feedback on the results screen.
- Deterministic target motion from a stored seed, so a run can be replayed later.

## Non-Goals

- Clicking or flicking scenarios. This spec covers tracking; clicking is SPEC-003 (Tile Frenzy).
- WebGL or 3D models. Spheres projected on a 2D canvas give correct angular behaviour without any engine.
- Replay viewer (p1+; the seed and samples are stored so it can be built).

## Proposed Solution

**Camera & input.** The camera sits at a fixed eye position with yaw/pitch in degrees. Pointer Lock is requested with `unadjustedMovement: true`; if that's rejected, fall back to normal lock and record `rawInput: false`. Degrees per mouse count = `YAW[game] * sens` for presets, `360 / ((cm360 / 2.54) * dpi)` for custom.

**Target speed.** A global `targetSpeed` multiplier (0.5×–1.5×, default 1×) scales every scenario's horizontal speed range before a run (jump height and timing are unchanged). A scaled run gets id `<id>@<mult>x` and name `<name> (<mult>×)`, so history and the report track each speed separately instead of mixing them into one trend. Scenario cards show approximate angular speed (`speed / dist` in °/s) at the current multiplier.

**Input calibration.** `movementX` only equals raw mouse counts when `unadjustedMovement` is honoured. On macOS (and other setups where it isn't) the browser reports cursor units after OS tracking-speed scaling and possibly acceleration, so a correct formula still produces the wrong cm/360. Settings has a **Mouse check**: lock the pointer, move exactly 10 cm along a ruler, press Space. `inputScale = reportedUnits / (dpi × 10 / 2.54)`. The trainer turns `degPerCount / inputScale` per reported unit, so physical cm/360 is exact again. A second pass at a different hand speed detects acceleration (> 5% difference → warn to turn off macOS Pointer acceleration). `deg_per_count` stored per run stays the true per-count value, so runs remain comparable.

**Rendering.** Canvas 2D: floor grid and back wall (depth cues), target sphere drawn as a perspective-projected circle with a floor shadow, and a crosshair. Line segments are clipped against the near plane.

**Scenarios.** Data-driven (`dist`, `radius`, `speed`, `interval`, `box`, motion `mode`). Motion uses a fixed physics step (1/480 s) driven by a seeded RNG (mulberry32):

| id | mode | trains |
|---|---|---|
| strafe-steady | strafe | speed matching & smoothness |
| strafe-reactive | strafe | reaction to direction changes |
| sweep-180 | sweep (constant-speed arc, ±90° around the player, starting at centre moving right, reverses at each edge) | long smooth tracking at constant speed, arm control across a full 180° |
| reacquire-hp | reacquire with **health bar**: the target has 1.0 s of on-target health; when it's empty the target jumps 5–12° and refills | switching to a new spot as soon as you've killed one |
| ~~reacquire~~ | (retired 2026-10-21) jumps on a random 1.2–2.2 s timer | old runs keep this id |
| sweep-90 | sweep, ±45°, starting at centre moving right | constant-speed tracking through the centre: right 45°, back, left 45°, back |
| smooth-bot | smooth (eased 2D velocity) | smoothness with changing speed |
| air-strafe | jump (gravity) | vertical control |
| close-rush | strafe3d | high angular speed |
| far-precision | strafe3d | fine control on small targets |

`sweep` targets move on a circle of radius `dist` around the eye at constant speed (so constant angular speed), covering `arcDeg` of yaw and reversing only at the edges. It starts at `sweepStartDeg` (default: the left edge) moving right. The mover reports each deliberate direction change ("turn") so reaction metrics can be computed.

**Health (reacquire-hp).** `reacquire.healthS` = seconds of on-target time to empty the bar. While the crosshair is on the target the bar drains; at 0 the tracking logic calls `mover.jump()` (sampled as `turn = 2`) and refills. With `healthS` set there are no timer jumps. A bar above the target shows the remaining health.

**Sampling.** Every animation frame records `t, tYaw, tPitch, cYaw, cPitch, angR, on, turn`. `turn` is 0 (none), 1 (direction change) or 2 (teleport jump, reacquire mode only). On jump frames the target velocity is carried over from the previous frame, so the teleport doesn't distort lag, speed match or jitter. Jumps also open the 350 ms turn window. Metrics are computed on full-rate data. Storage downsamples to 60 Hz but keeps every turn frame.

### Metrics (all angles in degrees)

| metric | definition |
|---|---|
| accuracy | time-weighted fraction on target |
| steady / turn accuracy | accuracy outside / inside the 350 ms after a turn |
| lag (+ lagRadii) | mean error along the target's travel direction. + = behind, − = ahead |
| crossTrack | mean abs error perpendicular to travel |
| velocityMatch | crosshair velocity projected on the target direction ÷ target speed |
| reaction | after a > 60° turn: ms until the crosshair's velocity has changed by ≥ 75% of the target's velocity change (Δv = v_after − v_before), measured along Δv (capped at 600 ms, else "missed"). For an ADAD reversal this is the same as "moving the new way at ≥ 50% of target speed". Unlike the original definition, it can't fire instantly on partial direction changes (strafe3d / reacquire), where the old motion already points partly along the new direction. *(Revised 2026-10-21.)* |
| recovery | ms after a turn until on target for ≥ 100 ms continuously, **counting only holds that start after the reaction**. A lagging crosshair that the reversing target passes back over doesn't count. Turns that don't recover before the next turn or the 1.5 s cap count as unrecovered: `recovered` = count, and the median treats unrecovered turns as ∞ (null if more than half don't recover). *(Revised 2026-10-21; earlier runs over-reported fast recoveries.)* |
| overshoot | max crosshair-ahead error within 400 ms after a turn |
| horiz / vert error | mean abs per axis |
| dirAccuracy | accuracy while the target moves left / right / up / down |
| speedAccuracy | accuracy in slow / mid / fast terciles of target angular speed |
| thirds, timeline | accuracy by run third and by 5 s bucket |
| jitter | RMS of (30 ms-smoothed − 120 ms-smoothed crosshair velocity) |
| reacquire (optional) | after each jump: **acquire** = ms until first on target, **settle** = ms until on target for ≥ 100 ms continuously (capped at 1.5 s, else counted as missed). settle − acquire = time lost overshooting and correcting |

`diagnose(summary)` turns threshold breaches into tips, each with a stable `key` stored alongside the run.

## Data Model / Schema

None in this spec (pure client and domain logic). Persistence is covered by SPEC-002.

## API / Interface

- `trainer`: `SCENARIOS`, `getScenario(id)`, `<TrainerView scenario settings onFinish />`, where `onFinish({ samples, seed, startedAt, endedAt, environment })`.
- `analysis`: `computeSummary(samples): Summary | null`, `diagnose(summary): Tip[]`, `downsample(samples, hz)`, `<ResultsPanel />`.
- `settings`: `useSettings()`, `degPerCount(settings)`, `<SettingsForm />`.

## Domain Placement

- `src/domain/trainer/` — scenarios, mover, camera/projection, renderer, `TrainerView`
- `src/domain/analysis/` — metrics, diagnosis, report builder, `ResultsPanel`
- `src/domain/settings/` — sensitivity math, persisted settings (localStorage, per device)
- Shared types (`Samples`, `Summary`, `Scenario`, `Settings`) in `src/common/lib/tracking.ts`. Routes compose the domains, and domains never import each other.

## Open Questions

- Should metrics require mouse-held "firing" like KovaaK's? v1: no. Pure tracking, always counted.
- Do thresholds in `diagnose` need tuning per scenario? Revisit once there are about 50 runs of real data.

## Task Breakdown

- [x] Scenario definitions + seeded mover
- [x] Camera, projection, renderer
- [x] Pointer lock with raw input fallback, countdown, abort on unlock
- [x] `computeSummary` + `diagnose`
- [x] Results panel
- [x] Settings form + sensitivity conversion (presets: game + sens; custom: cm/360 + DPI)
- [x] Mouse check: measure inputScale, detect raw input + acceleration
- [x] Target speed multiplier + °/s on scenario cards
- [x] Reacquire scenario + acquire/settle metrics
- [x] Reaction/recovery definitions fixed (2026-10-21); zero-depth bounce bug in reacquire motion fixed (it flagged a turn every physics step)
- [x] Reacquire health bar (reacquire-hp), goal moved to the new id

## Rollout / Migration Notes

Runs locally with `pnpm dev`. No migration in this spec.
