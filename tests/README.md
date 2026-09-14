# tests

Tests that live outside `src`. Engine unit tests may also sit next to their code as `*.test.ts`.

The test pyramid (md-files/11-testing-security-deployment.md), as Vitest projects (`vitest.config.mts`) plus Playwright:

| Layer                                       | Folder                                                       | Run with                                      | Environment                 |
| ------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------- | --------------------------- |
| Unit                                        | `unit/`, `src/**/*.test.ts`, `mentor/`                       | `pnpm test:unit` (with components)            | Node, no DOM                |
| Content                                     | the content files in `unit/` (listed in `vitest.config.mts`) | `pnpm test:content` (plus `mission:validate`) | Node                        |
| Integration                                 | `integration/`                                               | `pnpm test:integration`                       | Node, Anthropic SDK mocked  |
| Components                                  | `components/`                                                | `pnpm test:unit`                              | jsdom                       |
| End to end, accessibility, security headers | `e2e/`                                                       | `pnpm build`, then `pnpm test:e2e`            | Chromium, desktop and phone |

`pnpm test` runs every Vitest project, and `pnpm test:coverage` does too, failing if coverage drops below the gates on `src/sim`, the objective evaluator, the run reducer, settings and the mentor's request handling.

Never import here: anything that touches a real network or service. Tests run offline.
