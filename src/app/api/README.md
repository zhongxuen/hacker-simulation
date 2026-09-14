# src/app/api

Route handlers (server-only): the AI Mentor proxy, and similar. Secrets and answer keys stay here, never in client code.

Never import here: React components or client-only code. Validate every request body before using it.

## Routes

- `mentor/hint` — `POST /api/mentor/hint`, the AI Mentor proxy (phase 10). Stateless: no module-level state remembers a request or a learner; each body is Zod-validated fresh. It loads the authored hint tier from the mission content (never from the request), asks the model to personalise it, validates the model's output before any of it reaches the client, and streams newline-delimited JSON (`text` / `done` / `fallback`). Any problem — no key, the kill switch, a bad or oversized body, an unknown target, a model failure, or a rejected response — ends in a `fallback`, and the client shows the authored hint. It logs one metadata-only line per request and never logs learner text. The handler and all its logic live behind `@/features/mentor/server`; the Anthropic SDK and key are reached only through that feature's `server-only` module. Rate limiting is a Vercel Firewall rule on `/api/mentor/*` (see `md-files/deployment.md`).
- `mentor/explain` — `POST /api/mentor/explain`, "Explain this" (phase 10.3): a terminal line, an error, a command's whole result, or a glossary word (the definition is loaded from `src/content/glossary.ts`, never the request). Same shape as the hint route: capped, delimited, streamed NDJSON, validated before release, one metadata-only log line, and every problem is a `fallback` (the client shows the explanation written ahead of time).
- `mentor/review` — `POST /api/mentor/review`, the post-mission review (phase 10.4). The body is ids and counts (objectives ticked, hint tiers opened, minutes, resets) plus the capped transcript; the objectives' words come from the mission content. It answers with JSON (`{ mode: "model", review }` or `{ mode: "fallback", reason }`) because every sentence is checked before any of it is shown; the model is asked for the review's JSON shape with structured outputs.

Before any parsing, all three refuse (phase 11, `md-files/security-review.md`): a request from another site (403, by `Sec-Fetch-Site`/`Origin`), a body not sent as `application/json` (415), and a body over 16 KB (413, checked on `Content-Length` and again on the bytes as they stream in). `tests/integration/mentor-routes.test.ts` calls each route's real `POST` with only the Anthropic SDK mocked.

All three share the handler pieces in `src/features/mentor/respond.ts` and the runner from `getAnthropicRunner`, and `next.config.ts` traces the mission files into each.
