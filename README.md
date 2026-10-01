# Minesweeper

[![CI](https://github.com/AchillesKal/minesweeper/actions/workflows/ci.yml/badge.svg)](https://github.com/AchillesKal/minesweeper/actions/workflows/ci.yml)

A from-scratch rewrite of my 2020 Phaser experiment. It uses TypeScript and Vite, has no runtime dependencies, can be installed as an app, and works offline.

## Features

- **No-guess boards (on by default).** A solver checks that every board can be cleared by logic alone.
- **Daily puzzle.** Everyone gets the same seeded board each day.
- **Shared boards.** `?level=expert&seed=anything` gives everyone the same board and opening.
- **Safe opening.** Your first dig always opens an area.
- **Controls.** Chording works. Flag with right-click or long-press, or switch on flag mode. Full keyboard play.
- **Sound and effects.** Synthesized sound, particles, chain explosions and confetti. Reduced-motion settings are respected.
- **Board generation runs in a Web Worker,** so a slow Expert search never blocks input.
- **Expert stands upright on portrait phones.**

## Getting started

Requires Node 24 (see `.nvmrc`).

```bash
npm install            # also installs git hooks
npm run dev            # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run check` | lint + typecheck + unit tests with coverage (what CI runs) |
| `npm test` / `test:watch` | Vitest unit tests |
| `npm run test:e2e` | Playwright against the production build |
| `npm run lint` / `format` | Biome lint and format |
| `npm run build` | installable PWA in `dist/` |
| `npm run build:single` | one self-contained HTML file in `dist-single/` |

## Architecture

```
src/
  core/   Pure game logic. No DOM, no timers, fully unit-tested.
    board.ts      rules: reveal, flood fill, chord, flags, win/lose
    game.ts       one round as a state machine: clock, hints, typed events
    generate.ts   mine placement, no-guess retries, seeded plans
    solver.ts     human-level logic solver used by no-guess mode
    rng.ts grid.ts levels.ts
  app/    Glue: App controller, worker-backed planner, settings, stats, storage
  ui/     Rendering and input: board view, pointer/keyboard, sound, particles
tests/
  unit/   Vitest (core + app logic, coverage thresholds enforced)
  e2e/    Playwright (real browser, real build)
```

Data flows one way. Input calls `Game`. `Game` mutates the `Board` and emits events. `App` renders those events through `BoardView`, `Sound` and `Particles`. The UI never changes game state directly.

The solver is deliberately human-level. It uses single-cell rules, pairwise overlap rules and the global mine count, with no brute-force search. "Solvable" therefore means a good player can deduce every move.

## Quality gates

- **TypeScript.** `strict` plus `noUncheckedIndexedAccess`, `verbatimModuleSyntax` and `noImplicitOverride`.
- **Biome** for linting, formatting and import sorting. A pre-commit hook runs it on staged files.
- **Pre-push hook** runs the typecheck and unit tests.
- **CI on every push and PR** runs lint, typecheck, unit tests with coverage thresholds, build, and e2e.
- **Deploys with AWS Amplify Hosting** from `main` to [minesweeper.achilleskal.com](https://minesweeper.achilleskal.com). The build is defined in `amplify.yml`: Node from `.nvmrc`, `npm ci` without git hooks, `npm run build`, and cache headers that keep `sw.js` and `index.html` fresh while hashed `assets/` are cached forever. The app's build image must be **Amazon Linux 2023**. "Redeploy this version" in the Amplify console can't rebuild commits from before the repo was replaced; push a new commit instead.
- **Dependabot** opens grouped weekly npm updates and monthly Actions updates.
