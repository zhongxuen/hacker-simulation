# src/hooks

Shared React hooks used by more than one feature.

- `use-reduced-motion.ts` — `useReducedMotion(ref?)`: whether decorative motion is off, read from `--motion-scale` so it agrees with the CSS (the system setting and the nearest `data-motion` attribute). For effects driven from JavaScript, like a typewriter.
- `use-skippable-effects.ts` — `useSkippableEffects(ref, …)`: any key finishes a celebration's animations, without blocking the key press.
- `use-search-index.ts` — `useSearchIndex(enabled)`: the search index (`/search-index.json`), fetched once per page load the first time something searches, and held in memory only. Used by the command palette and the reference drawer.

Never import here: a feature's internals or `src/app`. Hooks that belong to one feature live inside that feature.
