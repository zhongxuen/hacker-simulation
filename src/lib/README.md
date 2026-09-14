# src/lib

Cross-cutting helpers: the app's section list (`app-sections.ts`), the "Start here" destination (`next-step.ts`), command palette matching (`command-search.ts`), search over lessons, glossary and commands (`search.ts`: the index's shape and `searchIndex`), terminal colour themes as CSS (`terminal-themes.ts`), progress maths (`progress.ts`), the contrast checker and audit behind `/styleguide` (`contrast.ts`, `contrast-audit.ts`, `css-custom-properties.ts`), and small utilities like `cx.ts`. `settings/` is the settings module (see its README): the only thing the app keeps between visits, and the only code allowed to touch browser storage (`tests/unit/storage-guard.test.ts`).

Never import here: features, `src/app`, or React components. The simulation engine must not import from here.
