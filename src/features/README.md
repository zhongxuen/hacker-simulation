# src/features

Self-contained feature modules. Each exposes its public API through an `index.ts`; everything else in the folder is private.

Never import here: another feature's internals. Use `@/features/<name>`, which resolves to its `index.ts` (ESLint enforces this).
