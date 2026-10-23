// analysis domain — public surface
export { computeSummary, diagnose, downsample } from './services/metrics'
export { computeClickSummary, diagnoseClicks } from './services/clicks'
export { computeRecoilSummary, diagnoseRecoil } from './services/recoil'
export { buildReport } from './services/report'
export { buildRecoilReport } from './services/recoilReport'
export { ResultsPanel } from './components/ResultsPanel'
export { ClickResultsPanel } from './components/ClickResultsPanel'
export { RecoilResultsPanel } from './components/RecoilResultsPanel'
