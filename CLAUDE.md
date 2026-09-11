# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project status

Phase 01 (project foundation) is done: a Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind CSS 4 app, managed with pnpm, with the folder architecture below and ESLint-enforced module boundaries. The only route is a placeholder landing page at `/`. There is no design system, database, auth, or simulation logic yet; those arrive in phases 02–11. Deployed on Vercel (project `hacker-simulation`, https://hacker-simulation.vercel.app). The Vercel project's framework preset was "Other", so `vercel.json` pins `"framework": "nextjs"`.

Note: `md-files/` is listed in `.gitignore`, so its contents are local-only and not tracked in git. It holds the vision doc (`md-files/hacker-simulation.md`, summarized below), the engineering plan and proposed improvements (`md-files/00-overview-and-improvements.md`), and one file per build phase (`md-files/01-…` through `md-files/11-…`).

## What this project is

Hacker Simulation is a planned educational cybersecurity platform that teaches ethical hacking, networking, Linux, web security, and system design through realistic but fully simulated scenarios — no interaction with real-world systems or targets.

Core principles: beginner-first, fun, educational, ethical, safe, realistic, modular, expandable. When they conflict, safe and ethical win, then beginner-first.

## Target audience and experience

The primary audience is **complete beginners**: people with no cybersecurity, networking, or Linux background, who may never have opened a terminal. Every feature must be **fun**, **engaging**, and **a great learning experience** for them.

- Assume zero prior knowledge. Define jargon on first use; teach a concept before a mission needs it.
- Get a first-time visitor to a first win within 2 minutes, with no sign-up wall (guest mode is the default).
- Game-like: a story with a fictional white-hat team and a mentor character, XP, levels, rank titles, achievements, cosmetic rewards, and a fog-of-war network map.
- Mistakes are safe and reversible, with friendly error explanations. Hints are free and never cost XP.
- No dark patterns: no losing earned progress, no lives/energy, no punishing daily streaks, no guilt notifications, no speed leaderboards, nothing purchasable that affects progress.
- UI copy is plain, encouraging, and never condescending (no "simply", "just", "obviously").
- The quick test for any screen or piece of content: _would a complete beginner understand this and want to keep going?_

## Commands

Use pnpm (pinned via `packageManager` in `package.json`).

- `pnpm install` — install dependencies
- `pnpm dev` — dev server at http://localhost:3000 (Turbopack)
- `pnpm build` — production build; also type-checks
- `pnpm start` — serve the production build (run `pnpm build` first)
- `pnpm lint` — ESLint, including the module-boundary rules
- `pnpm typecheck` — generate Next.js route types (`next typegen`), then `tsc --noEmit`. Plain `tsc` fails without the typegen step because `LayoutProps`/`PageProps` are generated globals.
- `pnpm test` — Vitest, run once; `pnpm test:watch` to watch
- `pnpm test tests/unit/environment.test.ts` — run a single test file (add `-t "<name>"` to filter by test name)
- `pnpm format` / `pnpm format:check` — Prettier (with Tailwind class sorting)

Playwright is installed with a config stub (`playwright.config.ts`, tests in `tests/e2e/`), but there are no e2e tests or `test:e2e` script until phase 11.

## Tech stack

- Frontend: Next.js 16 (App Router), React 19, TypeScript 5 (strict, `noUncheckedIndexedAccess`, `noImplicitOverride`), Tailwind CSS 4 (CSS-first config in `src/styles/globals.css`)
- Tooling: pnpm, ESLint 9 flat config (`eslint-config-next` + boundary rules), Prettier, Vitest (Node environment, no jsdom), Playwright (stub)
- Deployment: Vercel
- Planned: Supabase (PostgreSQL) for auth and progress (phase 03); later Docker, virtual machines, local lab support

## Planned core modules

- **Campaign** — story-driven, progressively harder learning path starting from absolute zero
- **Sandbox** — safe virtual environments, no external system interaction
- **Missions** — short (5–20 min) story episodes, e.g. password security, Linux basics, network discovery, web security, digital forensics, log analysis, malware investigation
- **Terminal** — browser-based Linux terminal simulator, with a beginner mode (guided first run, friendly errors, suggestions)
- **Network Visualizer** — interactive network topology (hosts/services) that reveals only what the learner has discovered
- **Learning Center** — plain-language concept explanations, a "Start Here" track, interactive tutorials, reference material
- **Achievements** — tracks completed missions, skills, progress, statistics; XP, levels, and cosmetic rewards
- **AI Mentor** — a friendly in-story character; explains concepts/mistakes/best practices; gives hints, not answers

## Architecture

Every folder under `src/` and `tests/` has a short `README.md` saying what belongs there and what it must never import.

- `src/app/` — routes only, kept thin. `(marketing)/` holds public pages (the landing page is `(marketing)/page.tsx`), `(app)/` the product surface, `api/` server-only route handlers. The root layout is `src/app/layout.tsx`.
- `src/sim/` — the pure, headless, deterministic simulation engine (`core/`, `fs/`, `net/`, `tools/`, `types.ts`). Same seed + same commands must give identical output.
- `src/content/` — declarative learning content (`missions/`, `lessons/`, `campaigns/`) validated by Zod schemas in `schemas/`. New missions are data, not new React code.
- `src/features/<name>/` — self-contained feature modules (`terminal`, `network-visualizer`, `missions`, `learning`, `achievements`, `mentor`), each with a public `index.ts`.
- `src/components/ui/` (design-system primitives), `src/lib/` (cross-cutting helpers), `src/hooks/` (shared hooks), `src/styles/` (global CSS and theme tokens).
- `tests/unit/` (Vitest) and `tests/e2e/` (Playwright). Engine tests may also sit next to their code as `src/**/*.test.ts`.

### Enforced import boundaries

These are ESLint errors (`eslint.config.mjs`), not conventions, and `tests/unit/module-boundaries.test.ts` proves the sim and content rules still fire:

1. `src/sim/**` may only import from `src/sim`. No `react`, `react-dom`, `next`, or Node I/O modules (`node:*`, `fs`, `net`, `http`, `dns`, `child_process`, …), and no browser globals (`fetch`, `window`, `localStorage`, …).
2. `src/sim/**` must stay deterministic: no `Math.random()`, `Date.now()`, `performance.now()`, or argument-less `new Date()`. Inject a seeded RNG and a clock instead.
3. `src/content/**` may only import from `@/content` and `@/sim/types` (npm packages such as Zod are allowed).
4. Code outside a feature may only import it through `@/features/<name>` (its `index.ts`), never its internals. The feature list is read from the folder at lint time, so new features are covered automatically.

TypeScript `any` is also a lint error (`@typescript-eslint/no-explicit-any`).

## Architectural intent

- Keep these concerns separated at the folder level: learning content, simulation logic, AI, UI, terminal emulation, and networking. Simulation logic in particular should stay isolated from the rest of the app.
- Database should model users, progress, missions, achievements, and statistics, with future leaderboards in mind.
- The platform must never provide real-world attack functionality — all "hacking" is simulated. Clearly distinguish simulated tools/output from real ones, validate all inputs, and protect user data.

## Working conventions in this repo

- Implement one learning module at a time; don't spread a change across unrelated modules.
- Never modify files unrelated to the current task.
- Educational value and safety/legality take priority over feature scope — introduce complexity only after the underlying concept is taught.
- Keep the story fictional: no real people, companies, brands, domains, or routable IPs in content — use reserved ranges (`10.x`, `192.168.x`, `example.*`).
