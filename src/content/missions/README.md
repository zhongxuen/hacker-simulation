# src/content/missions

The full authoring guide is `md-files/authoring-missions.md`: `pnpm mission:new <id>` scaffolds a mission that already validates and plays, `pnpm mission:validate` checks them, and `pnpm mission:play <id>` plays one headlessly. Chapter 1 is `intro-01`, `linux-01` and `net-01` (md-files/story-bible.md).

One YAML file per mission, named after its id: `linux-01` lives in `linux-01.yaml` (the extension is `.yaml`, never `.yml`). A mission is data, never React code: story beats, the scenario that seeds the engine, objectives with declarative checks, three hint tiers per objective, and a debrief with an ethics note. The schema is `src/content/schemas/mission.ts`; the loader in `src/features/missions` validates every file, and a malformed one fails `pnpm test` and `pnpm build` with a readable error such as `objectives[find-note].why: Missing: add one line on why this step matters.` (list items are named by their id, other positions count from 1).

Top-level fields: `id`, `slug`, `version`, `title`, `difficulty` (`intro` ≤ 10 min, `easy` ≤ 15, `medium` ≤ 25, `hard` ≤ 30), `estimatedMinutes`, `skills` (from `src/content/skills.ts`), `prerequisites` (mission ids, "Best after" only), `hook` (one line), `learningGoals` (2–4), `concepts` (lesson ids), `briefing` (`scenario`, `role`, `authorization`, all required), `story`, `scenario`, `objectives` (3–6 main ones), `hints`, `debrief` (`summary`, `whatYouLearned` with one line per learning goal, `ethicsNote`, `defensiveTakeaway`, `nextTease`, `furtherReading`), and `guidedTour` (starts the terminal's first-run tour).

- **Story beats**: `on` is `start`, `complete`, `{ objective: <id> }`, or `{ event: host.discovered, match: { hostId: backup-01 } }`. `speaker` is a cast id from `src/content/cast.ts`.
- **Bonus objectives and secrets**: `optional: true` or `hidden: true`, each with a playful `name` of 1–3 words (`name: Curious Cat`). Main objectives have no name.
- **Playthroughs**: `playthroughs/<id>.yaml` scripts a run of the mission (`run`, `answer` + `objective`, `reset` steps, with optional `ticks` and `accepted` checks). CI plays every one, so every mission needs one, and no mission may keep a `TODO` from the template.
- **Checks**: `event` (with optional `match`), `answer` (`accept`, and optional `choices` with `reply` lines for the choices that aren't accepted), `fileState` (`path`, optional `host`, and a `predicate`), `commandRun` (a regular expression searched in each command's line as the engine records it: one line per command in a pipeline, after `$VARIABLES`, `~` and wildcards are filled in, with any argument containing spaces wrapped in single quotes, so `grep 'Failed password' auth.log`; add `anyExitCode: true` to count failed commands), and `all` / `any` with `of`.
- **Scenario**: the engine's scenario spec plus a `seed`. Every address is in a reserved range (`10.x`, `192.168.x`) and every domain ends in `.example`. The engine checks the rest when the loader builds it.
- **Put modes and version numbers in quotes**: `mode: "600"`, `modeExcludes: "044"`, `version: "9.6"`. YAML reads `044` as the number 44 and `1.10` as 1.1.
- Copy follows `md-files/voice-and-tone.md`; a test checks every learner-facing string for banned words.

Never import here: React, features, or engine internals. Only `@/content` and `@/sim/types`.
