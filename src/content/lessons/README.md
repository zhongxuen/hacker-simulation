# src/content/lessons

Learning Center lessons: one `.mdx` file per lesson, written for complete beginners (md-files/09-learning-center.md). The first lessons arrive in prompt 09.4.

## Writing a lesson

The file name is the lesson's id: `net-ports.mdx` holds the lesson `net-ports`, served at `/learn/net-ports`. It starts with YAML frontmatter, validated by `LessonFrontmatterSchema` (`src/content/schemas/lesson.ts`):

```mdx
---
id: net-ports
title: Ports and services
topic: networking # foundations | linux | networking | web | crypto | forensics | blue-team
level: 1 # 0 first steps, 1 primer, 2 working knowledge, 3 deep dive
readingMinutes: 4 # 5 or less at levels 0 and 1
analogy: "A port is like a numbered door on a building; a service is whoever answers it."
summary: Numbered doors on a computer, and the programs that answer them. # optional, for cards
prerequisites: [net-ip-basics]
relatedMissions: [net-01]
relatedCommands: [netscan, webprobe]
glossaryTerms: [port, service, banner]
---

## The one-sentence version

Every computer has numbered doors called <Term id="port">ports</Term>.
```

House rules, enforced while the lesson compiles and in CI (`tests/unit/content-references.test.ts`):

- Sections are `##`, subsections `###`. No `#`: the page shows the title from the frontmatter. The headings build the "On this page" contents.
- No `import` or `export`. Use the lesson components: `<Term id="…">words</Term>` today, and the interactive components from prompt 09.2.
- Code fences use one of the languages in `src/features/learning/lessons/highlight.ts` (`console` for a terminal session, `shellscript`, `http`, `log`, …), or none for plain text. Add `title="Try this"` after the language for a caption.
- Every id in the frontmatter, and every `<Term id>` in the body, must exist. Levels 0 and 1 need an analogy and 5 minutes or less. Prerequisites can't loop.
- Keep examples fictional: `example.com` and `.example` domains, `10.x` and `192.168.x` addresses.

Never import here: React, features, or engine internals. Lessons are data.
