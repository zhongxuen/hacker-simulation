# src/content

Declarative learning content: missions, lessons, and campaigns as data, validated by schemas. Adding a mission should need no new React code.

- `lessons/` — Learning Center lessons as MDX (see its README). `missions/` — one YAML file per mission, plus `missions/playthroughs/` (see its README). `campaigns/` — the campaign: chapters, story framing and the recommended mission order, with its pure helpers (see its README).
- `themes/` — the terminal's colour themes, prompt styles and cursor styles, all free from the start. Every colour theme is contrast-audited by `tests/unit/terminal-themes.test.ts`; the default must match the `--term-*` tokens in `src/styles/tokens.css`.
- `mini-terminals.ts` — the tiny practice machines behind a lesson's `<MiniTerminal scenario="…">`: real engine scenarios on the Range.
- `tracks.ts` — ordered lesson tracks, starting with the six-lesson Start Here track. A recommendation, never a gate.
- `sandbox/` — the sandbox's practice machines on the Range: engine scenarios with a title, a beginner description and a few commands to try (see its README).
- `schemas/` — the Zod schemas, including `mission.ts`.
- `cast.ts` — the story's speakers from `md-files/story-bible.md` (id, name, pronouns, role, initials, speech-bubble tone), and `MENTOR`. Mission story beats and campaign lines may only use these ids.
- `skills.ts` — the fixed skill taxonomy missions are tagged with (`linux`, `networking`, `web`, `crypto`, `forensics`, `blue-team`), with each skill's display name, one-line description and icon.
- `mission-copy.ts` — `missionCopy`: every learner-facing string in a mission with its path, for the voice-and-tone check.
- `glossary.ts` — every glossary term, with `getGlossaryEntry(id)`. Its writing rules are in the file and enforced by `tests/unit/glossary.test.ts`.
- `topics.ts` — the lesson topics and levels, with their display labels.
- `references.ts` — `findDeadReferences`, the cross-link check CI runs over lessons, glossary, missions and commands.
- `lesson-graph.ts` — `buildPrerequisiteGraph`: reading order, prerequisites, dependents and loops.
- `voice.ts` — the banned words from `md-files/voice-and-tone.md`, for content tests.

Never import here: anything except `@/content` and `@/sim/types` (ESLint enforces this). Keep every name fictional and every IP in a reserved range.
