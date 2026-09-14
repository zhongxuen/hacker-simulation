# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project status

Phase 01 (project foundation) is done: a Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind CSS 4 app, managed with pnpm, with the folder architecture below and ESLint-enforced module boundaries. Phase 02 (design system and app shell) is built: semantic colour tokens and motion tokens in `src/styles/`, the UI primitives and celebration components in `src/components/ui/`, and the app shell (`src/components/shell/`, rendered by `src/app/(app)/layout.tsx`: sidebar with "Start here", top bar with a mission-progress slot and the SIMULATED marker, and a ⌘K / Ctrl+K command palette) around placeholder pages for Campaign, Missions, Sandbox, Terminal, Network, Learn, and Settings, plus `/missions/intro-01` as the "Start here" target. `/styleguide` (dev only, a 404 in production builds) shows every component in every state and both motion modes, a sample lesson rendered through the lesson pipeline, the type and spacing scales, and a contrast audit of the tokens that `tests/unit/contrast-audit.test.ts` enforces. Phase 03 (app state and privacy) is done: settings live in `src/lib/settings/` (Zod-validated, one `localStorage` key `hacker-simulation:settings`, safe when storage is blocked, synced across tabs, applied to `<html>` before first paint by `SettingsBootScript`), `/settings` lists them in plain words with a Reset button, and `/privacy` ("What we store") explains what is kept. Mission runs live in memory only, and while one is in progress the shell asks "Leave this mission?" before in-app navigation and turns on the browser's leave-page prompt (`src/components/shell/leave-guard.tsx`). Phase 04 (simulation engine core) is done: `src/sim/` is the pure engine (`step(state, cmd, ctx)`, seeded RNG, injected clock, a virtual filesystem with POSIX permissions, a network model with explicit firewall rules, discovery state kept apart from ground truth, the simulated tools `netscan`, `webprobe`, `logview` and `hashid`, versioned snapshots, and run replay with golden tests). Phase 05 (terminal) is done: the engine runs parsed command lines (`src/sim/shell/`: pipes, redirection, `&&`/`||`/`;`, variables, `~`, wildcards, history) and the Linux command set (`src/sim/tools/commands/`, one file per command, each with a man page); `src/features/terminal/` holds the parser, the session bridge (`useTerminalSession`), the `Terminal` component (ANSI colour, history, Tab completion, ghost text, Ctrl+R/A/E/K/U/L/C, copy transcript, Reset machine, an `aria-live` summary of each command) and beginner mode (explainer lines for every error code, "did you mean", command chips, "What just happened?", a whoami → ls → cat guided tour, and the `beginnerMode` setting). `/sandbox` runs it on three practice machines from `src/content/sandbox/` with a cheat sheet and, on the network machine, the map; `/terminal` is a single-machine terminal with the tour. Phase 06 (mission system) is done: the mission schema (`src/content/schemas/mission.ts`, YAML files in `src/content/missions/`, the cast and skills), the loader (`@/features/missions/server`, so a bad mission fails the build), the pure evaluator (`evaluateObjectives`), the pure run reducer (`missionRunReducer`, held in memory by `useMissionRun`), the generic runner UI (`MissionRunner`: briefing, then a workspace with the team chat, terminal, map and objectives with free hints, then the debrief) at `/missions` and `/missions/[slug]`, the three Chapter 1 missions (`intro-01`, `linux-01`, `net-01`, each with a playthrough in `src/content/missions/playthroughs/` that CI plays end to end), and the authoring toolkit (`pnpm mission:new`, `mission:validate`, `mission:play`, and the guide `md-files/authoring-missions.md`). Phase 07 prompts 07.1–07.2 are done: `selectTopology` (discovered-only topology, no ground-truth leakage) and the SVG `TopologyGraph` with a deterministic layout (`src/features/network-visualizer/`); the inspector, live mission wiring, table view and export are 07.3–07.5. Phase 09 prompts 09.1–09.4 are done: the lesson pipeline (MDX in `src/content/lessons/` with validated frontmatter, a loader and prerequisite graph, highlighted code, a table of contents, and `/learn/[lessonId]`), the interactive lesson components (`<Quiz>`, `<MiniTerminal>` on the real engine, `<PacketDiagram>`, `<Annotated>`, `<TryIt>`, all shown on `/styleguide`), the glossary (`src/content/glossary.ts`, the `<Term>` definition card, and `/learn/glossary`), and 28 lessons: the six-lesson Start Here track (`src/content/tracks.ts`), Linux, networking, the web, security fundamentals, and ethics and law. Search and the in-mission reference drawer are 09.5. The story bible for phase 08 is written (`md-files/story-bible.md`); every mission's story beats must use its cast ids. There is no database, no accounts, and no saved progress (standing decision in `md-files/00-overview-and-improvements.md`). Deployed on Vercel (project `hacker-simulation`, https://hacker-simulation.vercel.app). The Vercel project's framework preset was "Other", so `vercel.json` pins `"framework": "nextjs"`.

Note: `md-files/` is listed in `.gitignore`, so its contents are local-only and not tracked in git. It holds the vision doc (`md-files/hacker-simulation.md`, summarized below), the engineering plan and proposed improvements (`md-files/00-overview-and-improvements.md`), one file per build phase (`md-files/01-…` through `md-files/11-…`), the copy rules (`md-files/voice-and-tone.md`), and the story bible (`md-files/story-bible.md`: premise, cast with stable speaker ids, tone, and the Chapter 1 arc).

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
- `pnpm mission:new <id>` — scaffold a mission (valid and playable, copy marked TODO) and its playthrough
- `pnpm mission:validate [id...]` — check one, several or all missions, with readable errors (schema, scenario, lesson links, banned words, playthrough, TODOs)
- `pnpm mission:play <id>` — play a mission headlessly from its playthrough and print the transcript (`--run "<command>"`, `--answer <objective>=<text>` and `--reset` for ad-hoc steps)

Playwright is installed with a config stub (`playwright.config.ts`, tests in `tests/e2e/`), but there are no e2e tests or `test:e2e` script until phase 11.

## Tech stack

- Frontend: Next.js 16 (App Router), React 19, TypeScript 5 (strict, `noUncheckedIndexedAccess`, `noImplicitOverride`), Tailwind CSS 4 (CSS-first config in `src/styles/globals.css`)
- Content: Zod 4 schemas; lessons are MDX compiled on the server with `@mdx-js/mdx` (not `@next/mdx`), plus `remark-gfm`, Shiki (JavaScript regex engine, CSS-variables theme) for highlighting, and `yaml` for frontmatter
- Tooling: pnpm, ESLint 9 flat config (`eslint-config-next` + boundary rules), Prettier, Vitest (Node environment, no jsdom), Playwright (stub), `tsx` for the scripts in `scripts/`
- Deployment: Vercel
- No database, auth, or cookies (standing decision; `tests/unit/no-database.test.ts` enforces it). Later: Docker, virtual machines, local lab support

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

- `src/app/` — routes only, kept thin. `(marketing)/` holds public pages (the landing page and `/privacy`, with a footer from `(marketing)/layout.tsx`), `(app)/` the product surface (including `/learn`, `/learn/[lessonId]`, which is statically generated from the lesson files, `/learn/glossary`, `/sandbox` and `/terminal`, whose client components sit next to their pages, and `/missions` and `/missions/[slug]`, generated from the mission files, with the runner put in the shell by `mission-screen.tsx`), `(dev)/` developer-only pages that call `notFound()` in production (`/styleguide`), `api/` server-only route handlers. The root layout is `src/app/layout.tsx`.
- `src/sim/` — the pure, headless, deterministic simulation engine (`core/`, `fs/`, `net/`, `shell/`, `tools/`, `types.ts`). Same seed + same commands must give identical output. Import it from `@/sim` (runtime) or `@/sim/types` (types plus the `SIM_EVENT_TYPES` and `SIM_ERROR_CODES` lists). The only entry point is `step`, which returns `{ state, output, events, exitCode }`; a command is `exec` (one tool and its arguments, used by tests) or `shell` (a command line the terminal has parsed into data, which `shell/` runs: the engine never re-reads shell syntax or evaluates text). Everything else integrates through `SimEvent`s (`file.changed` included), and expected failures are typed errors with stable codes that the terminal maps to beginner copy. Scenarios (`ScenarioSpec`: hosts, services, firewall rules, users, files) are declarative data. Adding a tool is one file in `src/sim/tools/` plus one line in `src/sim/tools/index.ts` (Linux commands: `src/sim/tools/commands/` and its `index.ts`). `listTools()` (from `@/sim`) lists every registered tool's name, help one-liner and category without running anything. Tools only colour output (ANSI codes) when it goes straight to the screen (`ToolContext.tty`), so tests and golden files stay plain. `selectTopology(state)` is the only network data the map may render. Golden snapshots live in `src/sim/__fixtures__/golden/`: after an intentional output change, delete them, rerun `pnpm test`, and review the diff.
- `src/content/` — declarative learning content (`missions/`, `lessons/`, `campaigns/`, `sandbox/`) validated by Zod schemas in `schemas/`. New missions are data, not new React code: one YAML file per mission in `missions/` (id = file name), validated by `schemas/mission.ts` (story beats use the cast ids in `cast.ts`; skills come from `skills.ts`). `tests/unit/missions.schema.test.ts` validates every mission file. Lessons are `lessons/<id>.mdx` with YAML frontmatter (format and house rules in `src/content/lessons/README.md`). `mini-terminals.ts` holds the practice machines behind `<MiniTerminal>`, `tracks.ts` the Start Here track, `missions/playthroughs/` a scripted run per mission, `glossary.ts` holds every glossary term (a one-sentence `short` definition with no other jargon, checked by `tests/unit/glossary.test.ts`), `topics.ts` the lesson topics and levels, `references.ts` the dead-link check, and `lesson-graph.ts` the prerequisite graph. `tests/unit/content-references.test.ts` fails CI on any dead lesson prerequisite, related mission or command, glossary term (in frontmatter or `<Term>`), glossary cross-link, or mission `concepts` entry, and builds and renders every lesson.
- `src/features/<name>/` — self-contained feature modules (`terminal`, `network-visualizer`, `missions`, `learning`, `achievements`, `mentor`), each with a public `index.ts`, and optionally a server-only `server.ts`. `learning` exports `Term` and `GlossaryBrowser` from `index.ts`, and the lesson loader and renderer (`getLesson`, `listLessons`, `getPrerequisiteGraph`, `renderLesson`, `LessonArticle`) from `server.ts`, because they read files; its MDX components validate their props while a lesson renders (`src/content/schemas/lesson-components.ts`). `terminal` exports the parser, `useTerminalSession`, `Terminal`, `CommandCheatSheet` and the beginner layer; its components import nothing from `@/sim` at runtime (`tests/unit/terminal-beginner.test.ts` checks), and every engine and parse error code must have explainer copy in `beginner/explain-error.ts` (test-enforced). `missions` exports the evaluator, the run reducer and store, headless play, and the runner UI from `index.ts`, and the mission and playthrough loaders from `server.ts`; nothing in it names a particular mission (`tests/unit/mission-run.test.ts` checks). `network-visualizer` exports `TopologyGraph`, which renders a `DiscoveredTopology` passed in.
- `src/components/ui/` (design-system primitives: semantic tokens only, one component per file), `src/components/shell/` (the app shell: sidebar, drawer, top bar, "Start here" button, command palette, `SettingsBootScript`), `src/components/settings/` (the `/settings` controls), `src/lib/` (cross-cutting helpers, including the section list in `app-sections.ts`, the "Start here" target in `next-step.ts`, and `settings/`, the only code allowed to touch browser storage), `src/hooks/` (shared hooks, including `useReducedMotion`), `src/styles/` (global CSS, colour tokens, `motion.css`: all motion scales by `--motion-scale`, 0 under reduced motion, and only loading indicators and the terminal cursor may loop, and `code.css`: syntax-highlighting colours mapped onto audited tokens).
- `tests/unit/` (Vitest) and `tests/e2e/` (Playwright). Engine tests may also sit next to their code as `src/**/*.test.ts`.
- `scripts/` — the mission authoring CLI (`mission-new.ts`, `mission-validate.ts`, `mission-play.ts`), run with `tsx`. Scripts run as CommonJS, so they must not import the MDX lesson compiler.

### Enforced import boundaries

Rules 1–4 are ESLint errors (`eslint.config.mjs`), not conventions, and `tests/unit/module-boundaries.test.ts` proves the sim and content rules still fire:

1. `src/sim/**` may only import from `src/sim`. No `react`, `react-dom`, `next`, or Node I/O modules (`node:*`, `fs`, `net`, `http`, `dns`, `child_process`, …), and no browser globals (`fetch`, `window`, `localStorage`, …).
2. `src/sim/**` must stay deterministic: no `Math.random()`, `Date.now()`, `performance.now()`, or argument-less `new Date()`. Inject a seeded RNG and a clock instead.
3. `src/content/**` may only import from `@/content` and `@/sim/types` (npm packages such as Zod are allowed).
4. Code outside a feature may only import it through `@/features/<name>` (its `index.ts`) or `@/features/<name>/server` (its `server.ts`, server-only), never its internals. The feature list is read from the folder at lint time, so new features are covered automatically.
5. Only `src/lib/settings/**` may reference `localStorage`, `sessionStorage`, `indexedDB`, or `document.cookie`. This one is a test, not a lint rule: `tests/unit/storage-guard.test.ts` walks the syntax tree, so comments may mention them.

TypeScript `any` is also a lint error (`@typescript-eslint/no-explicit-any`).

## Architectural intent

- Keep these concerns separated at the folder level: learning content, simulation logic, AI, UI, terminal emulation, and networking. Simulation logic in particular should stay isolated from the rest of the app.
- There is no database (standing decision, 2026-09-11). A run is fully described by mission id + seed + command list, so saved progress, if ever wanted, is a new phase rather than a rewrite.
- The platform must never provide real-world attack functionality — all "hacking" is simulated. Clearly distinguish simulated tools/output from real ones, validate all inputs, and protect user data.

## Working conventions in this repo

- Implement one learning module at a time; don't spread a change across unrelated modules.
- Never modify files unrelated to the current task.
- Educational value and safety/legality take priority over feature scope — introduce complexity only after the underlying concept is taught.
- Keep the story fictional: no real people, companies, brands, domains, or routable IPs in content — use reserved ranges (`10.x`, `192.168.x`, `example.*`).
