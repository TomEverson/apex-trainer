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
- One drill per weapon: hold left click to spray a full magazine at a legend-sized pill, pulling against the recoil. N sprays per run. Releasing the trigger or emptying the magazine ends a spray, followed by a 1 s pause that stands in for the reload.
- Options: range (10/20/40/60/100/150/200 m), optic (1x/2x/3x/4x), static or strafing target, magazine tier (sets the size), Barrel Stabilizer tier (scales the pattern), sprays per run, and **ADS multiplier** (Apex's per-optic ADS sensitivity, 1.0 = default).
- Metrics say *how* the spray fails: under- or over-pulling, losing the back half, sideways drift, a bad first bullet, inconsistency between sprays.

## Non-Goals

- Exact Apex recoil. Respawn publishes no recoil data and no verified Season 30 pattern charts exist (research 2026-10-23). Patterns are approximations of each gun's known shape (`source: 'approx-s30'`).
- Sniper optics (6x and up), hip-fire spread, visual-only recoil, attachments other than barrel and magazine, hop-ups, Corrupted Attachments.
- Goals and History integration (follow-up).

## Weapons (Season 30, through Split 2)

AR: R-301, Flatline, Havoc (0.27 s windup), Hemlok Breach AR (slow full-auto since S28), Nemesis (4-round burst). SMG: R-99, Alternator, Volt, C.A.R., Prowler (5-round burst, plus full-auto with the Selectfire Receiver as its own entry). LMG: Devotion (spin-up from 300 to 900 rpm), L-STAR (Care Package; shots until overheat instead of a magazine), Spitfire, Rampage.

Fire rates and magazines follow the patch notes, including S29 (C.A.R. mags) and S30 (Alternator mags, the 30-30/G7 swap, energy stockpiles). Data is in `src/domain/trainer/services/weapons.ts`.

## Proposed Solution

**Pattern.** Keypoints `[bullet, yaw°, pitch°]` give the cumulative offset of each bullet from the first when the mouse doesn't move. `expandPattern` interpolates linearly and keeps the last slope past the end. The barrel multiplies the pattern (1 / 0.9 / 0.85 / 0.8, approximate). A seeded ±0.05° jitter per shot is added. Jitter doesn't accumulate: each kick moves to `pattern[i] + jitter_i`.

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

## Data Model / Schema

Migration `0006_recoil_session.sql`: `recoil_session` (one row per drill; key metrics as columns, `drill_json` holds the weapon and the exact pattern played, `drill_id` is the variant `weapon@range-x{zoom}-m{mag}-b{barrel}[-strafe]`) and `recoil_shots` (the per-bullet log). Recoil prefs live in `Settings.recoil` (localStorage). `deg_per_count` is stored as played (after the ADS multiplier and optic zoom), and `fov` is the zoomed FOV.

```bash
pnpm wrangler d1 execute aim-trainer --local --command \
  "select drill_id, started_at, hit_rate, vert_comp, horiz_comp, vert_bias_deg, mean_err_deg from recoil_session order by started_at"
```

## Open Questions

- Calibrate patterns from Firing Range recordings (spray at a wall without touching the mouse, digitise the holes). When a pattern changes, change its `source` so history can separate old runs from new ones.
- Confirm Apex's ADS turn-speed scaling per optic (the trainer assumes turn speed ÷ zoom at multiplier 1.0), and whether Apex's FOV slider maps directly onto the trainer's horizontal FOV.
