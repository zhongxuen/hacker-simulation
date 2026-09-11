# src/app

Routes only: pages, layouts, and route handlers that compose features. Keep them thin, with no business or simulation logic.

Never import here: a feature's internals (use `@/features/<name>`). Nothing else in `src` may import from `src/app`.
