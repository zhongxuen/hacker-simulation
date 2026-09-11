# src/sim

The PURE simulation engine: headless, deterministic, and isolated. Same seed + same commands = identical output.

Never import here: React, Next.js, Node I/O modules, or anything from `src` outside `src/sim`. No `Date.now()`, `new Date()`, or `Math.random()`: inject time and randomness instead. ESLint enforces all of this.
