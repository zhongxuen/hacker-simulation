# src/app/(marketing)

Public pages that need no account: the landing page (`/`, with the Start button and "No sign-up. Nothing to install. Nothing you do here is saved.") and "What we store" (`/privacy`). `layout.tsx` adds the footer, which links to both. The parentheses make this a route group, so it adds no URL segment.

`/privacy` mirrors the "What the app remembers" table in `md-files/03-app-state-and-privacy.md`: when a phase adds a setting or starts sending something, update both.

Never import here: a feature's internals or anything from `src/sim` directly. Compose features through their `index.ts`.
