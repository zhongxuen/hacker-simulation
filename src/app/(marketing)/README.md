# src/app/(marketing)

Public pages that need no account: the landing page (`/`) and about. The parentheses make this a route group, so it adds no URL segment.

Never import here: a feature's internals or anything from `src/sim` directly. Compose features through their `index.ts`.
