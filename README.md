# Hacker Simulation

A story game that teaches cybersecurity from absolute zero. **Play it at https://hacker-simulation.vercel.app**: no sign-up, nothing to install.

## What is this?

Hacker Simulation is for **complete beginners**: people who've never studied security, networking or Linux, and may never have opened a terminal (the window where you type commands to a computer instead of clicking).

You join Candlewright Security, a small fictional team of good-guy hackers, as its newest recruit. Organisations ask the team to find their weak spots before anyone else does, and always sign a letter first saying exactly what may be tested. In short story missions you:

- **type real commands** in a practice terminal, and see what they do;
- **map a network** as you explore it, watching computers light up one by one;
- **make the calls a professional makes**, like waiting for permission when a teammate suggests a shortcut;
- **ask your mentor, Noor**, for a hint or to explain anything on your screen. Hints are free and never cost you anything.

**Everything is simulated.** The terminal, the computers, the networks and the tools are all make-believe, running in your browser. Nothing here touches a real computer, and the tools have their own names (`netscan`, not a real scanner) so nobody mistakes them for the real thing.

**Nothing about you is kept.** There are no accounts and no database. Your settings stay in your own browser, and that's all. If you choose to, the app sends anonymous counts (like "a mission was started") so we can find the parts that are too hard; there's an off switch, and a browser set to "Do Not Track" sends nothing. The "What we store" page says exactly what happens.

## What's in it

- **Campaign**: Chapter 1, "First shift", three missions of 8–15 minutes: _Welcome to the team_ (your first commands, and why permission comes first), _Reading the machine_ (files, passwords and permissions on a server), and _Mapping the network_ (finding every computer on a small bakery's network, and the one door that shouldn't be open). Every mission is open from the start, with bonus objectives and hidden secrets for the curious.
- **Sandbox**: three practice machines with no goals: break anything, then press Reset.
- **Terminal**: a practice computer with a one-minute tour.
- **Learning Center**: 28 short lessons in plain words (a Start Here track, Linux, networking, the web, security ideas, ethics and the law), each with quizzes or a practice terminal; a glossary of 117 words, and a manual page for every command.
- **Noor, your mentor**: an AI mentor who gives hints (never answers), explains lines and errors, and looks back at a finished mission with you. With no AI available, she answers from notes written ahead of time.
- **Made for everyone**: everything works with a keyboard alone, controls are labelled for screen readers, "reduce motion" is respected, colours are contrast-checked, and every page is checked with an automated accessibility scanner (axe) on every change.

## Running it yourself

You need [Node.js](https://nodejs.org) 22 or newer and [pnpm](https://pnpm.io) (the version is pinned in `package.json`).

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

The mentor works without any setup: with no API key, every hint and explanation is the one written ahead of time. To try the live mentor, put `ANTHROPIC_API_KEY=...` in `.env.local` (never commit it).

| Command                                                               | What it does                                                                                                                                                                       |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                                            | The app, with fast refresh                                                                                                                                                         |
| `pnpm build` / `pnpm start`                                           | A production build, and serving it                                                                                                                                                 |
| `pnpm lint` / `pnpm typecheck` / `pnpm format`                        | Checks and formatting                                                                                                                                                              |
| `pnpm test`                                                           | Every Vitest project: unit, content, integration (the mentor routes, AI mocked) and components                                                                                     |
| `pnpm test:unit`, `test:content`, `test:integration`, `test:coverage` | One layer at a time; coverage fails if the engine and key modules drop below their gates                                                                                           |
| `pnpm test:e2e`                                                       | Playwright, against a production build (run `pnpm build` first): every module's happy path, the first five minutes, a whole mission, accessibility on every page, security headers |
| `pnpm bundle:check` / `pnpm security:bundle`                          | After a build: the 200 KB JavaScript budget per page, and a scan proving no secret reached the browser                                                                             |
| `pnpm mission:new <id>` / `mission:validate` / `mission:play <id>`    | Write, check and play missions (guide in `md-files/authoring-missions.md`, kept locally)                                                                                           |

## How it's built

Next.js 16 (App Router) with React 19, TypeScript and Tailwind CSS 4, deployed on Vercel. Almost everything is static; the only server code is the mentor's three routes, which call Claude (Haiku 4.5) through the Anthropic SDK with a key that never leaves the server.

- `src/sim/` — the simulation engine: a pure, deterministic, headless model of computers, files, users, networks and tools. Same seed and same commands, same output, every time.
- `src/content/` — missions (YAML), lessons (MDX), the glossary, the campaign and the terminal themes, all data validated by Zod schemas. A new mission is a new file, not new code.
- `src/features/` — the terminal, missions, network map, Learning Center and mentor, each with one public entry point.
- `src/app/` — the pages and the mentor routes. `tests/` — unit, content, integration, component and end-to-end tests.

Module boundaries (the engine imports nothing outside itself; content imports only content) are enforced by ESLint and tests. `CLAUDE.md` is the full architecture guide.

## Safety and ethics

The platform never provides real attack tools: every "hack" is simulated, every mission states its written permission in the story, and every mission ends with what the technique is used for defensively, when it's illegal, and what real authorization looks like. The story is fictional throughout: no real people, companies or addresses (only reserved ranges like `10.x` and `example` domains).

Found a security problem in the app itself? Please report it privately (GitHub → the repository's Security tab → "Report a vulnerability") rather than in a public issue.
