# src/app/(dev)

Developer-only pages, such as `/styleguide`. Each page calls `notFound()` when `NODE_ENV` is `production`, so they're served by `pnpm dev` and are a 404 in every production build, including Vercel previews. Nothing in the product links here.

Never import here: a feature's internals (use `@/features/<name>`) or simulation internals.
