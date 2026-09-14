# scripts

Command-line tools for content authors, run with `tsx` through `package.json` scripts. They use the same loaders, schemas, terminal session and run reducer as the app, so what they report matches what a learner sees.

- `mission-new.ts` — `pnpm mission:new <id>`: writes `src/content/missions/<id>.yaml` (valid and playable as it is, with every piece of copy marked TODO) and its playthrough. The templates are in `lib/mission-template.ts`, tested by `tests/unit/mission-toolkit.test.ts`.
- `mission-validate.ts` — `pnpm mission:validate [id...]`: every problem in one, several or all missions, with where it is and what to change: schema, scenario, catalog, lesson links, banned words, the playthrough, and TODOs left.
- `mission-play.ts` — `pnpm mission:play <id>`: plays the mission's playthrough headlessly and prints the transcript. `--run "<command>"`, `--answer <objective>=<text>` and `--reset` play ad-hoc steps instead.

Checks on a production build (phase 11), run by CI after `pnpm build`:

- `bundle-size.ts` — `pnpm bundle:check`: the initial JavaScript each pre-rendered page downloads, gzipped, against the 200 KB budget and the committed baseline (`bundle-baseline.json`; a page may grow by at most 2 KB without `--update`). It also fails if a page loads the terminal, the network map, the simulation engine or the full Zod build up front: they load on demand.
- `check-client-bundle.ts` — `pnpm security:bundle`: every file a browser can download is scanned for secrets and server-only code (the API key's name or value, `sk-ant-` keys, the Anthropic API or SDK).
- `measure-vitals.ts` — `pnpm perf:vitals [--base URL] [--runs N] [--no-throttle]`: LCP, INP, CLS and initial JS on the four budgeted pages, in Chromium with a phone-like CPU and connection. Run it against `pnpm start`, never `pnpm dev`. Lab numbers from one machine; real learners' numbers are in Vercel Speed Insights.

The guide for the mission tools is `md-files/authoring-missions.md`. Scripts run as CommonJS under tsx, so they don't import the MDX lesson compiler, which only loads as an ES module.

Never import here: a feature's internals. Use `@/features/<name>` and `@/features/<name>/server`.
