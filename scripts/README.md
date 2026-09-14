# scripts

Command-line tools for content authors, run with `tsx` through `package.json` scripts. They use the same loaders, schemas, terminal session and run reducer as the app, so what they report matches what a learner sees.

- `mission-new.ts` — `pnpm mission:new <id>`: writes `src/content/missions/<id>.yaml` (valid and playable as it is, with every piece of copy marked TODO) and its playthrough. The templates are in `lib/mission-template.ts`, tested by `tests/unit/mission-toolkit.test.ts`.
- `mission-validate.ts` — `pnpm mission:validate [id...]`: every problem in one, several or all missions, with where it is and what to change: schema, scenario, catalog, lesson links, banned words, the playthrough, and TODOs left.
- `mission-play.ts` — `pnpm mission:play <id>`: plays the mission's playthrough headlessly and prints the transcript. `--run "<command>"`, `--answer <objective>=<text>` and `--reset` play ad-hoc steps instead.

The guide for all of it is `md-files/authoring-missions.md`. Scripts run as CommonJS under tsx, so they don't import the MDX lesson compiler, which only loads as an ES module.

Never import here: a feature's internals. Use `@/features/<name>` and `@/features/<name>/server`.
