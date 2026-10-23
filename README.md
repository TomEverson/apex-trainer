# Apex Trainer

A browser-based aim trainer for Apex Legends players who have plateaued. It covers tracking, recoil control and footstep hearing. Every run is stored with detailed metrics, so you can see *why* you miss, not just *how often*, and hand the data to an LLM for coaching.

It runs on Cloudflare Workers with a D1 database: one small app, one database, free tier friendly.

## What's inside

### Pure Aim

KovaaK's-style scenarios with per-frame tracking analysis:

| Scenario | Trains |
|---|---|
| Strafe · Steady / Reactive | speed matching; reaction to ADAD direction changes |
| Sweep 90 / 180 | constant-speed arm tracking through centre |
| Smooth Bot | smoothness while the target speeds up and slows down |
| Air Strafe | combined horizontal + vertical tracking (jumping target) |
| Close Rush / Far Precision | high angular speed; fine control on small targets |
| Reacquire | getting back on target after it teleports |
| Tile Frenzy | flicking (clicking) |

Metrics include on-target accuracy, **lag vs. lead**, speed matching, reaction and re-acquire time after direction changes, overshoot, left/right asymmetry, jitter and fatigue across the run. Physics runs at a fixed 1/480 s step, so motion is identical at any frame rate.

### Recoil Control

Spray full magazines at a legend-sized target and pull against the recoil. Each run is 5 sprays.

- **Weapons:** the Season 30 ARs, SMGs and LMGs: R-301, Flatline, Havoc, Hemlok, Nemesis, R-99, Alternator, Volt, C.A.R., Prowler (burst and full-auto), Devotion, L-STAR, Spitfire, Rampage.
- **Options:** range up to 200 m, 1x–4x optics (zoomed view and ADS-scaled turning), magazine and barrel tiers, and a static or strafing target.
- **Spray guide:** a side panel shows the pattern, the mouse path that cancels it and step-by-step pull instructions. `Tab` toggles it.
- **Analysis:** how much of the vertical and horizontal recoil you cancelled (100% = perfect, >100% = over-pulling), error in the early, middle and late part of each spray, first-bullet aim, and consistency between sprays. Results include a spray plot of your average spray against the no-pull pattern.

### Hearing

A footstep audio trainer using stereo Web Audio: judge the direction and distance of synthesized footsteps, with distractors and adaptive difficulty.

### Goals and History

- Weekly goals per scenario, stored in D1 so they sync across devices.
- History with a trend chart and recent-run tables, split into Pure Aim and Recoil Control.
- **Copy LLM analysis prompt** exports your data as a Markdown report with metric definitions, ready to paste into Claude or another LLM.

### Sensitivity

Sensitivity is set per game (Apex, Valorant, CS2, Overwatch, Fortnite) or as a custom cm/360 + DPI. Movement uses the same degrees-per-count your game does, with raw input where the browser supports it. A mouse check detects OS acceleration or scaling.

## Recoil pattern data

Respawn doesn't publish recoil data. The patterns come from in-game Firing Range captures by [metaflow/apex-recoil](https://github.com/metaflow/apex-recoil) (Apache License 2.0). Each pattern was recorded with a full magazine and no attachments, without touching the mouse, measured against in-game view angles and averaged over repeated captures. They're converted to degrees in `src/domain/trainer/services/patterns.ts`.

Patterns change with balance patches, so every weapon card says how far to trust its pattern:

- **Measured:** a capture with no known recoil change since (R-301, Flatline, Volt, C.A.R.).
- **May be outdated:** the capture predates a recoil patch, or its source marks it old (R-99, Prowler full-auto, Havoc, Alternator, Devotion, L-STAR, Spitfire, Rampage).
- **Estimated:** no capture exists; the shape is a guess (Hemlok Breach, Nemesis, Prowler burst).

Barrel-stabilizer scaling is an approximation. Each run stores the exact pattern it was played with, so recapturing a weapon never rewrites history. Recaptures are very welcome: see the [capture method](https://github.com/metaflow/apex-recoil/blob/main/docs/capture.md) and `spec/phases/p0/006-recoil-control.md`.

## Stack

- [TanStack Start](https://tanstack.com/start) + React 19, Vite 7, `@cloudflare/vite-plugin`
- Cloudflare Workers + D1, queried with [Kysely](https://kysely.dev)
- Zod v4 (stored JSON is always parsed through schemas), Tailwind CSS v4
- Canvas 2D renderer with pointer lock; no game engine

## Getting started

Requires Node.js and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm db:migrate:local   # create the local D1 database (Miniflare)
pnpm dev                # http://localhost:5173
```

Click the canvas to lock the mouse. `R` restarts, `F` toggles fullscreen and `Esc` leaves. Local runs are stored in `.wrangler/`, which is git-ignored.

```bash
pnpm verify             # typecheck + lint + unit tests — run before every commit
pnpm db:types           # regenerate kysely-types.ts after adding a migration
```

## Deploying your own

1. Create a D1 database: `pnpm wrangler d1 create aim-trainer`.
2. Put the returned id in `wrangler.toml` as `database_id`.
3. Apply the migrations and deploy:

   ```bash
   pnpm db:migrate:prod
   pnpm run deploy
   ```

> **There is no authentication yet.** Anyone who can reach your deployment can read your runs and save new ones. Put it behind [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/) (free for small teams) on the workers.dev route, or keep the URL private, until auth lands.

## Project layout

```
src/
├── domain/              # one folder per domain; domains never import each other
│   ├── trainer/         # scenarios, weapons + patterns, renderer, run logic, TrainerView
│   ├── analysis/        # pure metric/summary/report functions, results panels
│   ├── sessions/        # server functions (D1), History views
│   ├── goals/           # weekly goals
│   ├── settings/        # sensitivity, FOV, per-device prefs (localStorage)
│   └── hearing/         # footstep audio trainer
├── common/lib/          # cross-domain Zod schemas and types
├── routes/              # TanStack Router file routes (compose the domains)
└── server/              # D1 / env access
migrations/              # D1 SQL migrations
spec/                    # design specs — start at spec/000-index.md
```

Metric definitions are in the specs and in the LLM report's metric guide (`src/domain/analysis/services/report.ts`, `recoilReport.ts`).

## Disclaimer

Apex Trainer is a fan-made practice tool. It is not affiliated with, endorsed by or sponsored by Electronic Arts Inc. or Respawn Entertainment. Apex Legends and weapon names are trademarks of their respective owners. This project contains no game files or assets and does not interact with the game.
