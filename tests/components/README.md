# tests/components

Vitest component tests in a simulated browser (jsdom), with Testing Library: the parts only a DOM can show, like typing into the terminal, clicking Start mission and waiting for the workspace to load, a 429 from the mentor route turning into the written hint, and the usage-counts setting. The server-rendered markup of components is tested in `tests/unit` with `react-dom/server`.

`setup.ts` adds the few browser APIs jsdom lacks (`<dialog>`, `matchMedia`, `ResizeObserver`, `getAnimations`, scrolling) and makes `fetch` fail by default, so the mentor answers from its notes unless a test says otherwise.

Never import here: a real network or clock. Query by role and label, the way a learner (or a screen reader) finds things.
