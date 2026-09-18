# src/app/(dev)

Developer-only pages. Each page calls `notFound()` when `NODE_ENV` is `production`, so they're served by `pnpm dev` and are a 404 in every production build, including Vercel previews. Nothing in the product links here.

- `styleguide/` — every component in every state, the type and spacing scales, and the contrast audit.
- `map-bench/` — the network map with a made-up network of any size on it, for measuring how it draws (`/map-bench?hosts=200&shown=8`). No mission has 200 hosts and none should, so the frame-rate test in `tests/e2e/network-map-performance.spec.ts` measures against this fixture instead of content.

`dev-only.ts` holds the gate. It opens for `E2E_FIXTURES=1` as well as for `pnpm dev`, because a frame rate can only be measured on a production build; the Playwright config sets that variable on the server it starts, and nothing sets it on a deployment. A page using it must also set `export const dynamic = "force-dynamic"`, so the check runs per request instead of once at build time — which also keeps it out of the prerendered output, and so out of the bundle budget.

Never import here: a feature's internals (use `@/features/<name>`) or simulation internals.
