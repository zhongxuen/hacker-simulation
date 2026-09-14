# tests/e2e

Playwright end-to-end tests (phase 11), run against a production build: `pnpm build`, then `pnpm test:e2e` (the config starts `pnpm start` on port 3217, or `E2E_PORT`; `E2E_BASE_URL` points it at a deployment instead). Chromium on a desktop, and a phone for the tests tagged `@mobile`.

- `first-five-minutes.spec.ts` — land, Start, a first command, the first tick, in at most five actions (it takes four), with no sign-up and no cookies.
- `net-01.spec.ts` — the whole net-01 playthrough in the browser, driven by the mission's own playthrough file.
- `modules.spec.ts` — one happy path per module: campaign, missions (a wrong answer, the leave guard), terminal, sandbox, network map, lessons (quiz and practice terminal), glossary, command manual, search palette, mentor (and its 429 fallback), reference drawer, settings, privacy, the 404 page.
- `a11y.spec.ts` — axe on every route (every lesson included) and the key states, with zero serious or critical violations; the SIMULATED marker on every app page, not dismissible.
- `keyboard.spec.ts` — keyboard only: the shell (skip link first, every stop visible, no trap), and the sandbox from picking a machine to exploring the map with the arrow keys.
- `security.spec.ts` — security headers and the CSP on real responses, no CSP violation or console error while using the app, the mentor routes refusing other sites, and nothing about the learner left in the browser.
- `helpers.ts` — shared learner steps (`run`, `startMission`, `answer`).

Never import here: application internals. Drive the app through the browser the way a learner would. Content files (a mission's playthrough, the lesson list) may be read as data.
