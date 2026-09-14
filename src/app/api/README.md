# src/app/api

Route handlers (server-only): the AI Mentor proxy, and similar. Secrets and answer keys stay here, never in client code.

Never import here: React components or client-only code. Validate every request body before using it.

## Routes

- `mentor/hint` — `POST /api/mentor/hint`, the AI Mentor proxy (phase 10). Stateless: no module-level state remembers a request or a learner; each body is Zod-validated fresh. It loads the authored hint tier from the mission content (never from the request), asks the model to personalise it, validates the model's output before any of it reaches the client, and streams newline-delimited JSON (`text` / `done` / `fallback`). Any problem — no key, the kill switch, a bad or oversized body, an unknown target, a model failure, or a rejected response — ends in a `fallback`, and the client shows the authored hint. It logs one metadata-only line per request and never logs learner text. The handler and all its logic live behind `@/features/mentor/server`; the Anthropic SDK and key are reached only through that feature's `server-only` module. Rate limiting is a Vercel Firewall rule on `/api/mentor/*` (see `md-files/deployment.md`).
