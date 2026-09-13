# src/features

Self-contained feature modules. Each exposes its public API through an `index.ts`; everything else in the folder is private. A feature with server-only code (anything that reads files) may also expose a `server.ts`, which client code must never import.

Never import here: another feature's internals. Use `@/features/<name>`, which resolves to its `index.ts`, or `@/features/<name>/server` (ESLint enforces this).
