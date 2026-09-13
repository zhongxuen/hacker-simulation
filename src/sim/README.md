# src/sim

The PURE simulation engine: headless, deterministic, and isolated. Same seed + same commands = identical output.

The only entry point is `step(state, cmd, ctx) => { state, output, events, exitCode }`. Outside code imports from `@/sim` (runtime) or `@/sim/types` (types, plus the event and error code lists), never from the folders inside. Events are the integration seam: missions, the network map and the mentor subscribe to them instead of reading engine internals. Expected failures are typed errors with stable codes (`SIM_ERROR_CODES`); the friendly explanations live in the terminal, not here.

- `core/` state, `step`, RNG, clock, scenarios, serialization, replay
- `fs/` the virtual filesystem · `net/` the network model · `tools/` simulated tools
- `__fixtures__/` the test scenario, golden run, and test helpers

Never import here: React, Next.js, Node I/O modules, or anything from `src` outside `src/sim`. No `Date.now()`, `new Date()`, or `Math.random()`: inject time and randomness instead. ESLint enforces all of this, and `golden.test.ts` fails loudly if ambient time or randomness is ever read.
