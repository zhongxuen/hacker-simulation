# src/content

Declarative learning content: missions, lessons, and campaigns as data, validated by schemas. Adding a mission should need no new React code.

- `lessons/` — Learning Center lessons as MDX (see its README). `missions/` and `campaigns/` arrive in phases 06 and 08.
- `schemas/` — the Zod schemas.
- `glossary.ts` — every glossary term, with `getGlossaryEntry(id)`. Its writing rules are in the file and enforced by `tests/unit/glossary.test.ts`.
- `topics.ts` — the lesson topics and levels, with their display labels.
- `references.ts` — `findDeadReferences`, the cross-link check CI runs over lessons, glossary, missions and commands.
- `lesson-graph.ts` — `buildPrerequisiteGraph`: reading order, prerequisites, dependents and loops.
- `voice.ts` — the banned words from `md-files/voice-and-tone.md`, for content tests.

Never import here: anything except `@/content` and `@/sim/types` (ESLint enforces this). Keep every name fictional and every IP in a reserved range.
