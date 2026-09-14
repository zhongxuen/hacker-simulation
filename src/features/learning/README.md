# src/features/learning

The Learning Center: the lesson pipeline, the interactive lesson components, the glossary UI, and (later) search and the in-mission reference drawer (md-files/09-learning-center.md).

Two public entry points:

- `index.ts` — safe anywhere, client or server: `Term`, `GlossaryBrowser`, `GlossaryText`.
- `server.ts` — server only, because it reads files: `getLesson`, `listLessons`, `getPrerequisiteGraph`, `loadLessonCatalog`, `renderLesson`, `compileLessonBody` (it also collects the `<Term>` and `<TryIt>` ids for the dead-link check), `LessonArticle` (with an optional track position: "Start here, 3 of 6"), `TableOfContents`. Import it from server components, `generateStaticParams`, and tests, never from a `"use client"` module.

Inside:

- `lessons/` — `frontmatter.ts` (split and validate), `loader.ts` (read `src/content/lessons`, cached in production), `compile.ts` (MDX → component with `@mdx-js/mdx`), `remark-lesson.ts` (heading anchors and the table of contents, the house rules, `<Term>` collection), `highlight.ts` (Shiki with a CSS-variables theme, colours from `src/styles/code.css`), `lesson-components.tsx` (how lesson MDX renders), `lesson-article.tsx` (the lesson page).
- `components/` — the interactive lesson components (prompt 09.2). `lesson-mdx.tsx` holds what MDX sees: server components that validate their props (`src/content/schemas/lesson-components.ts`) and render the client views `quiz.tsx` (`<Quiz>`: an explanation for every option, "not quite" and a retry, never a fail screen), `mini-terminal.tsx` (`<MiniTerminal>`: the real terminal and engine on a machine from `src/content/mini-terminals.ts`, ticking when the expected command works), `packet-diagram.tsx` (`<PacketDiagram>`) and `annotated.tsx` (`<Annotated>`), plus `try-it.tsx` (`<TryIt mission>`, a server component that reads the mission catalog). All keyboard accessible and reduced-motion aware; `/styleguide` shows each one.
- `glossary/` — `term.tsx` and `term-popover.tsx` (the inline definition card: hover, focus, tap), `glossary-browser.tsx` (the `/learn/glossary` search and filter), `glossary-text.tsx` (backticks to code font).

Never import here: another feature's internals.
