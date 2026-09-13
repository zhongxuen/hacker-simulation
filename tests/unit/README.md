# tests/unit

Vitest unit tests, run with `pnpm test` in a plain Node environment (no jsdom).

Never import here: a real network, database, or clock. Inject fakes instead.

`helpers/` holds shared test code (such as the storage scanner behind `storage-guard.test.ts`) and `fixtures/` holds input files that tests read. Neither is run as a test.
