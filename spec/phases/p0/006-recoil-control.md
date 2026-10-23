---
title: SPEC-006 — Recoil Control
description: Dedicated recoil-control session for Apex Legends Season 30 ARs, SMGs and LMGs — spray a magazine at a dummy, measure how much of each pattern you cancel
type: spec
created: 2026-10-23
status: in progress
---

# SPEC-006 — Recoil Control

## Problem

Everything so far trains aim with no weapon: tracking, flicking. In Apex the fights are won or lost holding a full-auto spray on a body. The player asked for recoil training as its own session (not another scenario), covering every AR, SMG and LMG. Snipers, marksman rifles, pistols and shotguns are out of scope.

## Goals

- The Play tab splits into **Pure Aim** (the existing scenarios, `/`) and **Recoil Control** (`/recoil`).
- One drill per weapon: hold left click to spray a full magazine at a legend-sized pill, pulling against the recoil. 5 sprays per run (fixed). Releasing the trigger or emptying the magazine ends a spray, followed by a 1 s pause that stands in for the reload.
- Options: range (10/20/40/60/100/150/200 m), optic (1x/2x/3x/4x), static or strafing target, magazine tier (sets the size), Barrel Stabilizer tier (scales the pattern), and **ADS multiplier** (Apex's per-optic ADS sensitivity, 1.0 = default).
- Metrics say *how* the spray fails: under- or over-pulling, losing the back half, sideways drift, a bad first bullet, inconsistency between sprays.

## Non-Goals

- Datamining recoil from the game files. Respawn publishes no recoil data; patterns come from community Firing Range captures (below).
- Sniper optics (6x and up), hip-fire spread, visual-only recoil, attachments other than barrel and magazine, hop-ups, Corrupted Attachments.
- Goals integration (follow-up).

## Weapons (Season 30, through Split 2)

AR: R-301, Flatline, Havoc (0.27 s windup), Hemlok Breach AR (slow full-auto since S28), Nemesis (4-round burst). SMG: R-99, Alternator, Volt, C.A.R., Prowler (5-round burst, plus full-auto with the Selectfire Receiver as its own entry). LMG: Devotion (spin-up from 300 to 900 rpm), L-STAR (Care Package; shots until overheat instead of a magazine), Spitfire, Rampage.

Fire rates and magazines follow the patch notes, including S29 (C.A.R. mags) and S30 (Alternator mags, the 30-30/G7 swap, energy stockpiles). Data is in `src/domain/trainer/services/weapons.ts`.

### Pattern sources (checked 2026-10-23)

Patterns are from [metaflow/apex-recoil](https://github.com/metaflow/apex-recoil) (Apache 2.0, `client/specs.json`), converted in `patterns.ts`. Those captures were made in the Firing Range with a full magazine and no attachments, without touching the mouse. Bullet holes were measured against in-game view angles (`cl_showpos`), and each capture was repeated until the results converged. Upstream stores angle ÷ 0.022 with y pointing down the screen, so degrees = x × 0.022 and pitch = −y × 0.022. The capture timing matches the patch-note fire rates (e.g. R-99 55.6 ms → 1080 rpm). Each weapon carries a `confidence`, shown on its card:

| confidence | weapons | why |
|---|---|---|
| measured | R-301, Flatline (2024-09, S22) · Volt (2021, confirmed 2024-09) · C.A.R. (2026-03, S28) | maintained by upstream; no recoil patch found since |
| outdated | R-99 | captured 2024-09; floor R-99 recoil **increased** 2025-02-11 (S24) |
| outdated | Prowler full-auto | captured 2021; recoil **improved** in S28 mid-season |
| outdated | Havoc, Alternator, Devotion, L-STAR, Spitfire, Rampage | 2021 captures that upstream itself marks "(old)" |
| estimate | Hemlok Breach AR, Nemesis, Prowler burst | no capture exists; hand-made shapes |

Barrel scaling (1 / 0.9 / 0.85 / 0.8) and the ±0.05° jitter are still approximations. Where a magazine is longer than the capture (Volt purple by 1, C.A.R. purple by 3), the last step is extrapolated.

## Proposed Solution

**Pattern.** Keypoints `[bullet, yaw°, pitch°]` (every bullet, for captured patterns) give the cumulative offset of each bullet from the first when the mouse doesn't move. `expandPattern` interpolates linearly and keeps the last slope past the end. The barrel multiplies the pattern (1 / 0.9 / 0.85 / 0.8, approximate). A seeded ±0.05° jitter per shot is added. Jitter doesn't accumulate: each kick moves to `pattern[i] + jitter_i`.

**Kick.** After shot *i* the camera is kicked toward bullet *i+1*'s offset, eased in over `min(35 ms, 0.6 × shot gap)`. Before each shot any remaining kick is applied in full, so an untouched mouse reproduces the pattern exactly (unit-tested). Bullets go where the crosshair is.

**Run shell.** `TrainerView` takes a `Drill` (`{ kind: 'scenario' } | { kind: 'recoil' }`). `RunLogic` gains `trigger(down)`, `progress()` (seconds left, or spray n/N) and `done()`. Recoil runs end after the last spray, not on the duration setting.

**Target.** An upright pill, 1.9 m tall with a 0.32 m radius (`PILL` in `common/lib/recoil.ts`). There are no hit zones: hit = the bullet passes within the radius of the pill's spine. The aim point is the centre (0.95 m). A strafing target reuses the `strafe` mover (±3 m, 2.5–3.5 m/s). The floor grid and back wall extend past the target (to range + 20 m, coarser grid past 60 m).

**Optic.** Zoom *z* renders at `2·atan(tan(fov/2)/z)` and draws a circular scope mask for *z* > 1. Turning is divided by *z* (assumed to match Apex at ADS multiplier 1.0), then multiplied by the ADS multiplier. Recoil stays in degrees, so a 4x needs four times the hand movement of a 1x for the same climb.

### Metrics (`computeRecoilSummary`)

Error = bullet − pill centre, in degrees (vert + = above, horiz + = right).

| metric | definition |
|---|---|
| hitRate | bullets on the pill ÷ bullets |
| meanErrDeg, medianErrDeg | angular distance to the pill centre |
| vert/horizBiasDeg, vert/horizSpreadDeg | mean and std dev of the signed error |
| vertComp, horizComp | `1 − Σ(drift·pattern)/Σ(pattern²)`. drift = error − that spray's first-bullet error. 1 = fully cancelled, 0 = no pull, >1 = over-pull. horizComp is null when the RMS sideways pattern is < 0.15° |
| firstShotErrDeg | mean error of each spray's first bullet (aim before firing) |
| phases.early/mid/late | hit rate, error and biases by third of each spray (by position in that spray) |
| avgSpray | mean error per bullet index: the player's average spray |
| consistencyDeg | mean over bullet indices of the error spread across sprays |
| sprayHitRates, thirds | per spray, and by first/middle/last third of sprays |

`diagnoseRecoil` tips: under-pull (< 0.7), over-pull (> 1.25), late drift, horizontal, first shot, inconsistent, fatigue.

The results page plots every bullet, the average spray and the no-pull pattern on the pill's outline.

**Spray guide.** A panel on the left of the drill (toggle with `Tab`, mouse-transparent) shows the spray with no pull next to the mouse path that cancels it. The magazine is split into 3 steps (≤ 20 rounds) or 4, and each step says how far and how hard to pull down and which way to drift, using the real shot timing (`shotTimes`: windup, spin-up, burst pauses). It ends with smoothing tips: be on target before pressing, start pulling with the first bullet for front-loaded patterns, keep each step one constant-speed motion, use the forearm for long pulls, watch the target. `sprayGuide` is pure and tested.

**History.** The History tab switches between Pure Aim and Recoil Control. Recoil has one section per drill variant: a hit-rate chart and the last 10 runs (hit, vertical/horizontal compensation, error, biases, early/late error, first bullet, consistency, °/count). "Copy LLM analysis prompt" copies the report for the view you're on (`buildRecoilReport` for recoil).

## Data Model / Schema

Migration `0006_recoil_session.sql`: `recoil_session` (one row per drill; key metrics as columns, `drill_json` holds the weapon and the exact pattern played, `drill_id` is the variant `weapon@range-x{zoom}-m{mag}-b{barrel}[-strafe]`) and `recoil_shots` (the per-bullet log). Recoil prefs live in `Settings.recoil` (localStorage). `deg_per_count` is stored as played (after the ADS multiplier and optic zoom), and `fov` is the zoomed FOV.

```bash
pnpm wrangler d1 execute aim-trainer --local --command \
  "select drill_id, started_at, hit_rate, vert_comp, horiz_comp, vert_bias_deg, mean_err_deg from recoil_session order by started_at"
```

## Open Questions

- Recapture the outdated and estimated patterns (R-99 after its S24 change, Prowler after S28, the 2021 set, Hemlok Breach, Nemesis) with upstream's method (`docs/capture.md`). When a pattern changes, change its `source` and `confidence` so history can separate old runs from new ones.
- Confirm Apex's ADS turn-speed scaling per optic (the trainer assumes turn speed ÷ zoom at multiplier 1.0), and whether Apex's FOV slider maps directly onto the trainer's horizontal FOV.
