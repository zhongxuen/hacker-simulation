# tests/unit

Vitest unit tests, run with `pnpm test:unit` in a plain Node environment (no jsdom). The content tests here (every mission, lesson, glossary word, campaign and theme validates; no dead cross-reference) are listed in `vitest.config.mts` and run as their own project, `pnpm test:content`.

The guards that catch real problems live here too: the storage guard (`storage-guard.test.ts`: only settings touch browser storage, including the Cache API, service workers and the private file system), `no-database.test.ts` (no database or auth library anywhere in the lockfile, no cookie code), `no-eval.test.ts` (nothing turns text into code or HTML), `security-headers.test.ts`, and `module-boundaries.test.ts`.

Never import here: a real network, database, or clock. Inject fakes instead.

`helpers/` holds shared test code (such as the storage scanner behind `storage-guard.test.ts`) and `fixtures/` holds input files that tests read. Neither is run as a test.
