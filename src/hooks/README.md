# src/hooks

Shared React hooks used by more than one feature.

- `use-reduced-motion.ts` — `useReducedMotion(ref?)`: whether decorative motion is off, read from `--motion-scale` so it agrees with the CSS (the system setting and the nearest `data-motion` attribute). For effects driven from JavaScript, like a typewriter.
- `use-skippable-effects.ts` — `useSkippableEffects(ref, …)`: any key finishes a celebration's animations, without blocking the key press.

Never import here: a feature's internals or `src/app`. Hooks that belong to one feature live inside that feature.
