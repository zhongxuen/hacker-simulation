# src/content/schemas

Zod schemas that validate everything in `src/content`. A malformed mission must fail a test, never ship.

Never import here: anything except `@/content` and `@/sim/types`.
