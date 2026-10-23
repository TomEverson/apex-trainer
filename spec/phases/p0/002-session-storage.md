---
title: SPEC-002 — Session storage, history & report
description: Persist every run (summary + raw samples) in D1, show per-scenario history, and export an LLM-ready report
type: spec
created: 2026-10-19
status: in-progress
---

# SPEC-002 — Session storage, history & report

## Problem

Improvement, or a plateau, only shows up across many runs. Each run's metrics and raw data need to be kept in a form that's easy to chart, query with SQL, and hand to an LLM for coaching.

## Goals

- Save every finished run automatically.
- History page: per-scenario accuracy trend with hover details, and a table of recent runs.
- One-click "Copy LLM analysis prompt": a compact Markdown report with metric definitions and recent runs per scenario.
- Key metrics as real columns so they can be queried directly (`wrangler d1 execute aim-trainer --local --command "..."`).

## Non-Goals

- Auth / multi-user (p1, and **required before deploying publicly**: the save endpoint is otherwise open).
- Calling an LLM from the app (p1).

## Proposed Solution

- `saveSessionFn` (POST server fn): Zod-validates the payload and inserts a `session` row plus a `session_samples` row (raw 60 Hz samples JSON, ~130 KB per 60 s run; D1's row limit is 2 MB) in one batch. Everything lives in D1, with no R2 bucket. (Changed in 0003: samples originally went to R2.)
- `listSessionsFn`: returns all session rows (no samples), mapped to `SessionRow` without `as` casts.
- `getSessionSamplesFn({ id })`: reads the samples back from `session_samples` (for future replay and deep analysis).
- `buildReport(sessions)` (analysis domain, no side effects) produces the Markdown. The history route composes the two.

## Data Model / Schema

`migrations/0001_session.sql`, `0002_deg_per_count.sql`, `0003_samples_in_d1.sql`

| column | type | notes |
|---|---|---|
| id | TEXT PK | ULID |
| scenario_id | TEXT NOT NULL | indexed with started_at |
| scenario_name | TEXT NOT NULL | snapshot |
| scenario_json | TEXT NOT NULL | full scenario params at run time |
| seed | INTEGER NOT NULL | replay |
| started_at / ended_at | TEXT NOT NULL | ISO-8601 |
| duration_s | REAL NOT NULL | |
| deg_per_count | REAL NOT NULL | effective sensitivity, comparable across games (added in 0002, replaces cm360/dpi) |
| fov | REAL NOT NULL | |
| settings_json, environment_json | TEXT NOT NULL | full snapshot (game, sens, rawInput, fps, screen) |
| accuracy, steady_accuracy, turn_accuracy | REAL | |
| lag_deg, velocity_match, reaction_ms, jitter_deg_s | REAL | most-used metrics, as columns |
| summary_json | TEXT NOT NULL | full `Summary` |
| tips_json | TEXT NOT NULL | array of tip keys |
| created_at | TEXT NOT NULL | |

`session_samples` (0003): `session_id TEXT PK REFERENCES session(id) ON DELETE CASCADE`, `samples_json TEXT NOT NULL`. Kept in a separate table so listing sessions never reads the large blobs.

## API / Interface

- `saveSessionFn({ data: SaveSessionInput }) → { id }`
- `listSessionsFn() → SessionRow[]`
- `getSessionSamplesFn({ data: { id } }) → Samples`
- `buildReport(sessions: SessionRow[]) → string`
- `<HistoryPage sessions />`, `<AccuracyChart runs />`

## Domain Placement

- `src/domain/sessions/{services,validators,types,components}`
- `buildReport` in `src/domain/analysis/services/report.ts`

## Open Questions

- Should samples be deleted after N days? v1 keeps everything. A 60 s run is roughly 150 KB.

## Task Breakdown

- [x] Migration `0001_session.sql`, `kysely-types.ts` codegen
- [x] Zod schemas for samples, summary, save payload
- [x] Server fns: save, list, get samples
- [x] History page + accuracy chart
- [x] Report builder + copy button

## Rollout / Migration Notes

`pnpm db:migrate:local` before first `pnpm dev`. Deploy: `wrangler d1 create aim-trainer` (id into `wrangler.toml`), `pnpm db:migrate:prod`, `pnpm run deploy`. Until p1 auth ships, protect the workers.dev URL with Cloudflare Access (dashboard toggle, no code).
