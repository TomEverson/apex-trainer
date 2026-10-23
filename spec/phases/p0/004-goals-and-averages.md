---
title: SPEC-004 — Weekly goals & averages
description: Per-scenario weekly score goals stored in D1 with progress tracking, plus averages on scenario cards and history
type: spec
created: 2026-10-19
status: in-progress
---

# SPEC-004 — Weekly goals & averages

## Problem

The player gets per-scenario targets from analysis ("Smooth Bot 80% at 1× this week") but the app doesn't show them anywhere, and it doesn't show averages, only best and last-5. Without targets and averages in view, it's hard to tell during practice whether you're on track.

## Goals

- **Averages:** scenario cards show average · best · run count for the speed variant currently selected. History headers add the all-runs average.
- **Goals tab:** weekly goals (Monday–Sunday, the player's local week) per scenario *variant* (e.g. `strafe-reactive@0.7x`), stored in D1 so they're the same on every device.
- **Progress per goal:** runs this week, best, average of the last 3 runs this week, progress bar (last-3 average ÷ target), and **achieved** once 3 consecutive runs this week are ≥ target (the same rule as "move up a speed").
- Add / edit target / delete goals in the UI. Scenario cards show the goal for their variant.

## Non-Goals

- Automatic goal suggestions in the app (goals come from analysis and are entered or seeded).
- Recurring goals that roll over automatically. Each week's goals are separate rows.

## Data Model / Schema

`migrations/0004_goal.sql`:

| column | type | notes |
|---|---|---|
| id | TEXT PK | ULID |
| scenario_id | TEXT NOT NULL | variant id incl. speed suffix |
| target | REAL NOT NULL | tracking: accuracy 0–1; clicking: kills |
| week_start | TEXT NOT NULL | `YYYY-MM-DD`, the Monday (player's local date) |
| created_at / updated_at | TEXT NOT NULL | ISO-8601 |

`UNIQUE(scenario_id, week_start)`, so setting a goal again for the same variant and week updates it.

## API / Interface

- `listGoalsFn({ weekStart })`, `saveGoalFn({ scenarioId, target, weekStart })` (upsert), `deleteGoalFn({ id })`
- `goalProgress(goal, sessions, weekStart)`: pure. Picks sessions with `scenario.id === goal.scenarioId` whose local start date falls in the week, and returns runs, best, last3Avg, achieved.
- `/goals` route: client-rendered (`ssr: false`), because "this week" depends on the browser's time zone.

## Domain Placement

`src/domain/goals/{services,validators,types,components}`. Shared score helpers (`scoreOf`, `formatScore`) stay in `common/lib/tracking.ts`, and scenario names and variants are passed in by routes.

## Task Breakdown

- [x] Migration 0004 + types
- [x] Goals server fns + validators
- [x] goalProgress + GoalsPage (list, add, edit, delete) + nav tab
- [x] Averages on cards + history, goal on cards
- [ ] Seed week of 2026-10-19 in production from the analysis targets
- [ ] Deploy (migrate prod first)
