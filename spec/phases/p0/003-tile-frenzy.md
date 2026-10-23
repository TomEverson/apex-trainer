---
title: SPEC-003 — Tile Frenzy (clicking scenario)
description: First clicking scenario — static grid targets, click to destroy — with flick metrics that connect to the tracking overshoot findings
type: spec
created: 2026-10-19
status: done
---

# SPEC-003 — Tile Frenzy (clicking scenario)

## Problem

All scenarios so far are tracking. The player asked for a KovaaK's-style Tile Frenzy as a warm-up and to train fast target acquisition. The tracking analysis also found a consistent **overshoot** habit on predictable reversals (Sweep 90, ~4° past the target), so a clicking scenario should show whether flicks overshoot too.

## Goals

- **Tile Frenzy:** a grid of tile positions on a wall, N targets visible at once. Clicking one destroys it and spawns a new one in a random free tile (never the tile just cleared).
- Clicking metrics: kills, kills/s, hit rate, time per kill split by flick distance, and **miss direction** (past / short / to the side of the target, relative to the flick).
- Same run shell as tracking (pointer lock, countdown, R/F/Esc, HUD, fullscreen), same storage, history and report.

## Non-Goals

- A faithful clone of KovaaK's exact Tile Frenzy parameters (grid size, timing). It's "inspired by".
- Other clicking scenarios (1w4ts, gridshot variants). The run-logic split makes these easy later.

## Proposed Solution

**Run logic split.** `TrainerView` becomes a shell (lock, countdown, HUD, keys, loop, finish). Per-mode behaviour lives in a `RunLogic` (`start`, `frame`, `click`, `draw`, `hud`, `data`):
- `createTrackingLogic`: the existing mover + per-frame samples.
- `createTileLogic`: grid targets + shot log.

The mode `tiles` picks the tile logic. `RunResult.run` is a discriminated union: `{ kind: 'tracking', samples } | { kind: 'clicking', shots }`.

**Grid.** `cols × rows` tile directions, `spacingDeg` apart, centred straight ahead at eye level, all at distance `dist` from the eye (equal angular size). Targets aren't highlighted on hover (no free "on target" cue when clicking). The target speed multiplier doesn't apply.

**Shot log** (columnar): `t, hit, cYaw, cPitch, tYaw, tPitch, angR`, plus `startYaw/startPitch`. For a hit, `t*` is the target hit. For a miss, it's the nearest live target.

### Metrics (`computeClickSummary`)

| metric | definition |
|---|---|
| kills, shots, accuracy | hits, clicks, hits ÷ clicks |
| kps | kills ÷ duration |
| medianKillMs | time between consecutive kills (first: from run start) |
| medianFlickDeg | angle from the crosshair at the previous kill to the next target killed |
| killMsShort / killMsLong | median kill time for flicks below / at-or-above the run's median flick |
| misses.over / under / side | per miss, relative to the flick direction (previous kill → nearest target): along > 0 = past it, < 0 = short, \|perp\| > \|along\| = side |
| thirds, timeline | kills per run third / per 5 s |

`diagnoseClicks` tips: low hit rate, flick overshoot, flick undershoot, long flicks costing much more than short ones, fatigue.

## Data Model / Schema

No migration. `session.accuracy` = hit rate for clicking runs, and the tracking-only columns are NULL. `summary_json` holds a `ClickSummary` and `session_samples.samples_json` holds the shot log. A row's kind comes from `scenario_json.mode === 'tiles'`.

## API / Interface

- `saveSessionSchema.run`: discriminated union by `kind`.
- `SessionRow`: union `{ kind: 'tracking', summary: Summary } | { kind: 'clicking', summary: ClickSummary }`.
- `ClickResultsPanel`. The history chart plots accuracy for tracking and kills for clicking.

## Domain Placement

- `trainer`: `services/logic.ts` (both logics), `TrainerView` shell, scenario `tile-frenzy`
- `analysis`: `services/clicks.ts`, `components/ClickResultsPanel.tsx`, report section
- `sessions`: validators/service union, history table per kind
- shared schemas: `common/lib/tracking.ts`

## Task Breakdown

- [x] Schemas (mode, tiles params, shots, click summary, SessionRow union)
- [x] RunLogic split + tile logic + scenario
- [x] computeClickSummary + diagnoseClicks + simulation check
- [x] Results panel, history, report, save/read
- [x] Deploy

## Open Questions

- Grid size and spacing are guesses (5×4 tiles, 5° apart, 3 live targets). Tune after real runs.
