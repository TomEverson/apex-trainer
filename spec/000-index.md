# Aim Trainer — Spec Index

A personal aim trainer built for **tracking**. KovaaK's-style scenarios plus much finer analysis than one score per run: lag vs. lead, speed matching, reaction to direction changes, left/right asymmetry and more. Every run is stored so progress can be analyzed later, including by an LLM.

> **Stack.** TanStack Start + React 19 on Cloudflare Workers (Vite 7 + `@cloudflare/vite-plugin`). D1 + Kysely for session rows and raw per-frame samples. Zod v4, Tailwind v4, TypeScript, pnpm, ESLint.

## Folder layout

```
spec/
├── 000-index.md                        ← you are here
└── phases/
    └── p0/                             ← playable trainer + persistence
        ├── 001-tracking-trainer.md
        ├── 002-session-storage.md
        ├── 003-tile-frenzy.md
        ├── 004-goals-and-averages.md
        ├── 005-footstep-audio-trainer.md
        └── 006-recoil-control.md
```

## Phase plan

| Phase | Scope | Status |
|---|---|---|
| p0 | Tracking scenarios, metrics, D1 storage, history, LLM report export | in progress |
| p1 | better-auth (required before any public deploy), in-app LLM analysis | planned |

## Specs

| ID | Title | Phase | Status |
|---|---|---|---|
| SPEC-001 | [Aim trainer: tracking scenarios & metrics](phases/p0/001-tracking-trainer.md) | p0 | in progress |
| SPEC-002 | [Session storage, history & report](phases/p0/002-session-storage.md) | p0 | in progress |
| SPEC-003 | [Tile Frenzy (clicking scenario)](phases/p0/003-tile-frenzy.md) | p0 | done |
| SPEC-004 | [Weekly goals & averages](phases/p0/004-goals-and-averages.md) | p0 | in progress |
| SPEC-005 | [Footstep audio trainer](phases/p0/005-footstep-audio-trainer.md) | p0 | in progress |
| SPEC-006 | [Recoil Control (Apex S30 ARs, SMGs, LMGs)](phases/p0/006-recoil-control.md) | p0 | in progress |
