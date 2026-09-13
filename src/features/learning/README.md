# src/features/learning

The Learning Center: the lesson pipeline, the glossary UI, and (later) the Start Here track, interactive lesson components and the in-mission reference drawer (md-files/09-learning-center.md).

Two public entry points:

- `index.ts` — safe anywhere, client or server: `Term`, `GlossaryBrowser`, `GlossaryText`.
- `server.ts` — server only, because it reads files: `getLesson`, `listLessons`, `getPrerequisiteGraph`, `loadLessonCatalog`, `renderLesson`, `compileLessonBody`, `LessonArticle`, `TableOfContents`. Import it from server components, `generateStaticParams`, and tests, never from a `"use client"` module.

Inside:

- `lessons/` — `frontmatter.ts` (split and validate), `loader.ts` (read `src/content/lessons`, cached in production), `compile.ts` (MDX → component with `@mdx-js/mdx`), `remark-lesson.ts` (heading anchors and the table of contents, the house rules, `<Term>` collection), `highlight.ts` (Shiki with a CSS-variables theme, colours from `src/styles/code.css`), `lesson-components.tsx` (how lesson MDX renders), `lesson-article.tsx` (the lesson page).
- `glossary/` — `term.tsx` and `term-popover.tsx` (the inline definition card: hover, focus, tap), `glossary-browser.tsx` (the `/learn/glossary` search and filter), `glossary-text.tsx` (backticks to code font).

Never import here: another feature's internals.
