# src/content/schemas

Zod schemas that validate everything in `src/content`. A malformed mission must fail a test, never ship.

- `ids.ts` — the id and command-name formats shared by every schema.
- `lesson.ts` — `LessonFrontmatterSchema`: a lesson's frontmatter, strict (unknown keys fail), with the beginner rules (levels 0–1 need an analogy and 5 minutes or less).
- `glossary.ts` — `GlossaryEntrySchema` and `GlossarySchema`.

Rules that span the whole catalog (an id points at something real, prerequisites don't loop) live in `src/content/references.ts` and `src/content/lesson-graph.ts`, and run in tests.

Never import here: anything except `@/content` and `@/sim/types`.
