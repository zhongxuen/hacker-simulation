# src/sim/core

Engine state, the reducer that applies commands, the injected clock, and the seeded random number generator.

Never import here: anything outside `src/sim`, or any real source of time or randomness.
