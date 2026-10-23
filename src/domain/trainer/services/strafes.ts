// Recoil Strafe patterns (SPEC-006): per weapon, which way to strafe and for
// how long, from the trigger press. [direction, milliseconds]; 'none' = fire
// without strafing (e.g. the Havoc windup).
//
// Source: https://www.apexrecoilstrafing.com/ ("up to date with Season 28.1"),
// read from the site's pattern data on 2026-10-23. The patterns are ahn99's,
// kept current by the site. Consecutive steps in the same direction are merged.
// These are a pro player's timings, not game telemetry; they match the
// horizontal drift of the captured spray patterns.
import type { Weapon } from '../../../common/lib/recoil'

type Strafe = NonNullable<Weapon['strafe']>
const SOURCE = 'apexrecoilstrafing.com (S28.1)'
const s = (phases: Strafe['phases']): Strafe => ({ phases, source: SOURCE })

export const STRAFES: Record<string, Strafe> = {
  'r-301': s([['right', 800], ['left', 530], ['right', 880]]),
  flatline: s([['left', 600], ['right', 500], ['left', 1100], ['right', 610]]),
  // "normal" (no Turbocharger): the first 350 ms is the windup.
  havoc: s([['none', 350], ['right', 370], ['left', 350], ['right', 630], ['left', 1150]]),
  hemlok: s([['left', 1310], ['right', 660], ['left', 650], ['right', 660], ['left', 390]]),
  // The site only has the charged Nemesis.
  nemesis: s([['right', 330], ['left', 660], ['right', 330], ['left', 660], ['right', 330], ['left', 330]]),
  'r-99': s([['right', 390], ['left', 270], ['right', 290], ['left', 220], ['right', 280]]),
  alternator: s([['left', 600], ['right', 700], ['left', 800], ['right', 710]]),
  volt: s([['right', 750], ['left', 420], ['right', 250], ['left', 750]]),
  car: s([['left', 470], ['right', 380], ['left', 250], ['right', 330], ['left', 320]]),
  prowler: s([['left', 1280], ['right', 1050], ['left', 410]]),
  'prowler-auto': s([['left', 990], ['right', 660], ['left', 380], ['right', 530]]),
  devotion: s([['right', 500], ['left', 1190], ['right', 1450], ['left', 530]]),
  'l-star': s([['left', 300], ['right', 2400]]),
  spitfire: s([['left', 430], ['right', 670], ['left', 1110], ['right', 1440], ['left', 1330], ['right', 460]]),
  rampage: s([['left', 620], ['right', 1230], ['left', 6100]]),
}
