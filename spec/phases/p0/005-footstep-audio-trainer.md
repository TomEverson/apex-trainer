# SPEC-005 — Footstep audio trainer

Trains judging the direction and distance of footsteps over **plain stereo headphones** (Logitech G435), and records every trial so improvement across days can be checked. Plain UI; success = useful data.

Lives in the existing app (`hearing` domain, `/hearing` tab). Trials go to D1 (`hearing_trial`) like aim runs; per-device preferences (channel swap, gait, distractor level, level lock) go to localStorage.

## Audio engine (`src/domain/hearing/services/`)

- Modelled on how Respawn describes Apex audio (EA "Audio Update", Oct 2025, still current at Season 30): frequency and gain change with distance; reverb says interior vs exterior and room size; a surface between you and the source filters it by material density; Focused Mix (default) removes teammate steps, narrows the jog/sprint loudness gap and sidechain-ducks loud sounds around the footstep band. No official vertical/HRTF audio and no confirmed in-game 3D audio option.
- Two playback modes (`render`, logged per trial):
  - `stereo` (default): `StereoPannerNode`, like Apex's plain stereo output.
  - `surround`: HRTF `PannerNode` on the horizontal plane, imitating a 7.1 headphone virtualizer (Windows Sonic / Dolby Atmos / HeSuVi) fed by Apex's 7.1 output. Horizontal only, because 7.1 has no height channels.
- Distance = `GainNode` + `BiquadFilterNode` low-pass + `ConvolverNode` room (generated interior / exterior impulses).
- Angle convention: degrees, 0 = front, +90 = right, −90 = left, ±180 = behind. Full 360° by default ("front half only" is an easier option). `pan = sin(angle)`, so 45° and 135° pan the same; the behind cue tells them apart: low-pass and up to −3 dB, scaled by how far behind (−cos angle). `spatialCues()` is the pure mapping.
- Footsteps are synthesized per Apex-style terrain: concrete, metal (ring), wood (hollow knock), dirt, grass, sand (grain crunch). "Mixed" (default) picks a random terrain each trial; the actual terrain is logged. Gaits: walk / sprint / crouch-walk (tempo + loudness + brightness).
- Up/down: no elevation rendering (Apex has none to match). Floors are trained by occlusion instead: `occlusionCues()` gives a density low-pass (concrete 450 Hz, wood 900 Hz, metal 1.6 kHz), a level drop (−10/−7/−6 dB) and a +4–6 dB boom at 150 Hz.
- Gaits: crouch-walk / jog / sprint. Focused mix: jog at 0.8 of sprint loudness (original: 0.62), and distractors duck −9 dB around 1 kHz (wide) for each step.
- User samples: `public/samples/{surface}-{1..8}.{wav|ogg}`, probed at start, stopping at the first missing index. Synthesized steps are the fallback.
- Distractors: ambient hum (brown noise + low tone) and distant gunfire-like volleys at random pans, one level control.
- No Apex Legends game files or audio are used or referenced.

## Headphone check

Tone left, then right, then both. "Reversed" flips a stored `swapChannels` flag, which the engine applies to every pan.

## Modes

| # | Mode | Answer | Score | Status |
|---|---|---|---|---|
| 1 | Direction (+ floors) | click the dial, then same / other floor | angular error °; correct = within tolerance and floor right | done |
| 2 | Distance | near / mid / far (keys 1–3) | correct bucket; error = buckets apart | done |
| 3 | Moving target | keep cursor on source | time-weighted mean error ° | planned |
| 4 | Discrimination | present? which side? | correct | planned |
| 5 | Reaction time | — | sound onset → answer, every mode | done (direction) |

Reaction time is measured from the **scheduled audio onset** mapped to `performance.now()` through `AudioContext.getOutputTimestamp()`, so output latency is included. Answers before onset are ignored.

## Adaptive difficulty

Levels 1–10 (`difficulty.ts`, pure), tracked per drill. 3 accurate answers in a row → level up; a miss → level down. Lockable from the UI. Per level: angle grid (45° → 5°), accuracy tolerance (25° → 10°), steps per sequence (6 → 2), distractor level (0.05 → 0.5, scaled by the user's distractor slider), distance bucket centres (0.1/0.5/0.9 → 0.25/0.45/0.65, ±0.05 jitter), random gait from level 5 (loudness alone stops telling distance).

Floors: 35 % of direction trials (when on) come from above/below through a random floor material. Distance trials pick interior or exterior reverb at random.

## Data

`hearing_trial`: mode, level, locked, true_value, answer, error, correct, reaction_ms, detail_json, created_at. detail_json always has render, mix, surface, terrainSetting, source, steps, distractor, swapped, gait. Direction adds regions, directionOk, floor/occluder/floorAnswer/floorOk; distance adds distance, angle, environment, mixGait. Planned: stats screen (accuracy + mean error over time, L/R/front/back confusion, best streak), CSV export/import/reset.

## Honest limits (shown in the UI)

- Stereo cannot reproduce height, and front/back confusion is expected.
- This trains listening skill; it is not an exact copy of Apex's sound.
