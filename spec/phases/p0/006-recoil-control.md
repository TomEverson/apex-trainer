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

## Recoil Strafe (A/D)

The Recoil Control page has two categories: **Recoil Pure** (mouse only) and **Recoil Strafe** (`prefs.mode = 'strafe'`, drill id suffix `-ad`).

**Data.** The strafe patterns are from [apexrecoilstrafing.com](https://www.apexrecoilstrafing.com/) ("up to date with Season 28.1"), read from the site's pattern data on 2026-10-23 (`strafes.ts`). They are ahn99's patterns as kept current by the site; ahn99's own doc (last updated 2025-09-06) is older, and differs for the Alternator and Prowler burst. Each phase is `[direction, ms]` from the trigger press; 'shoot' steps (e.g. the Havoc's 350 ms windup) become 'none'. `strafeTimeline` (in `common/lib/recoil.ts`) runs the phases back to back, cuts them off when the magazine empties, stretches the last over a longer one, and finds the bullets in each phase with the shared `shotTimes` for the guide. The site's total durations agree with our fire rates and purple magazines, e.g. R-301 2.21 s = 31 rounds at 810 rpm; the L-STAR's 2.70 s means 40 shots at ~867 rpm. Havoc's windup is 0.35 s. The patterns match the measured drift: strafe the way the spray drifts.

**Drill.** A cue bar at the bottom shows the phases, a playhead, and the key to hold now (green when right). Optional beeps play on each switch, panned and pitched by side.

**Strafe effect ("recoil smoothing").** Apex reduces recoil while your character or crosshair moves horizontally, a global engine behaviour the community calls recoil smoothing. The most careful source (apexaimtrainer.com) says it "cancels most horizontal drift and reduces vertical climb", and that no datamine or capture tool has ever measured either amount. The trainer models only the part the sources agree on: a shot fired while holding the key the pattern calls for gets **no sideways kick**. No key or the wrong key leaves all of it. **Vertical climb is left at 100%**: the game reduces it too, but the amount is unknown, so in game you may need to pull a little less. Stored `oYaw` stays the full pattern, so `horizComp` shows how much the strafe plus the mouse took out.

**Movement (option B, real).** A/D move the player at the weapon class's ADS strafe speed (`ADS_STRAFE_SPEED`). Apex walks at 173.5 hu/s with a weapon out (1 hu ≈ 1 inch) times the class's ADS move multiplier (AR 0.5, SMG 0.75, LMG 0.4; Apex Legends Wiki, matching the Apex Movement wiki's measured 86.75 / 130.12 hu/s). That gives AR 2.20, SMG 3.31 and LMG 1.76 m/s. Acceleration was **measured in game** from two Firing Range clips with `cl_showpos` (2026-10-23; ~28 fps Flatline, ~20 fps Prowler). Every frame's velocity readout was decoded with each frame's exact timestamp:

| | AR (Flatline) | SMG (Prowler) |
|---|---|---|
| Steady ADS speed | 86.75 hu/s (= wiki) | 130.12 hu/s (= wiki) |
| Key held: standing → full speed | 0 → 35.14 → 86.75 over **~0.04 s** | 0 → 130.12 within one **0.038 s** frame |
| Key held: A↔D reversal | 2,022 · 2,493 hu/s² (≈ 86.75 / 0.04 s) | 2,446 · 2,771 · 2,967 hu/s² (~15% under 130.12 / 0.04 s; 20 fps clip) |
| No key: coast to a stop | ≥ ~1,000 (2 frames) | **1,260 hu/s²** (1,248 / 1,240 / 1,317 / 1,250, from 173.5 hu/s hip-fire) |

Both measured classes reach full speed from standing in ~0.04 s, so `STRAFE_REACH_S = 0.04` for every class and `STRAFE_ACCEL` = top speed ÷ 0.04, as in Source-style movement (AR 2,169, SMG 3,253, LMG 1,735 hu/s²). A full reversal takes 0.08 s, and letting go (no key or both, `STRAFE_COAST_DECEL`) stops you in ~0.07 s (AR) / ~0.10 s (SMG). The LMG was not measured; it follows the same 0.04 s. At this frame rate the values are good to roughly ±15%. Movement stays within ±6 m. The target stays fixed in the world, so the strafe slides it across the screen (e.g. ~6°/s for an AR at 20 m) and it has to be tracked, as in game. Option A (target carried along with the player) was tried and dropped: the target visibly strafed with you.

**Log & score.** `shots.strafe` holds the trigger press and spray end per spray, plus every A/D direction change during a spray. `computeStrafeSummary` samples every 5 ms and reports: timing (share of time on the expected key), wrong key, no key, per-phase timing, and switches. A switch counts if made from 250 ms early to 400 ms late; anything later is missed. Median and mean |lag| are reported too. Tips: strafe-wrong, strafe-missed, strafe-late, strafe-early.

## Data Model / Schema

Migration `0006_recoil_session.sql`: `recoil_session` (one row per drill; key metrics as columns, `drill_json` holds the weapon and the exact pattern played, `drill_id` is the variant `weapon@range-x{zoom}-m{mag}-b{barrel}[-strafe]`) and `recoil_shots` (the per-bullet log). Recoil prefs live in `Settings.recoil` (localStorage). `deg_per_count` is stored as played (after the ADS multiplier and optic zoom), and `fov` is the zoomed FOV.

```bash
pnpm wrangler d1 execute aim-trainer --local --command \
  "select drill_id, started_at, hit_rate, vert_comp, horiz_comp, vert_bias_deg, mean_err_deg from recoil_session order by started_at"
```

## Open Questions

- Recapture the outdated and estimated patterns (R-99 after its S24 change, Prowler after S28, the 2021 set, Hemlok Breach, Nemesis) with upstream's method (`docs/capture.md`). When a pattern changes, change its `source` and `confidence` so history can separate old runs from new ones.
- Confirm Apex's ADS turn-speed scaling per optic (the trainer assumes turn speed ÷ zoom at multiplier 1.0), and whether Apex's FOV slider maps directly onto the trainer's horizontal FOV.
