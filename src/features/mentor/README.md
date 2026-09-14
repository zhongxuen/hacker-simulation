# src/features/mentor

The AI Mentor: Noor Halvorsen (`mentor-noor` in the story bible) personalising authored hints. She gives hints, never answers, and hints never cost anything. Phase 10 (see `md-files/10-ai-mentor.md`).

The mentor is an **enhancement, never a dependency**. With no API key, the kill switch on, a rate-limit hit, a model failure, or a rejected response, the learner still gets the authored hint verbatim in Noor's voice, and nothing surfaces as an error.

## Public API

- **`index.ts` (client-safe)** — safe to bundle for the browser. Imports no API key and no Anthropic SDK.
  - `requestMentorHint({ mission, objectiveId, tier, transcript, onText, signal })` — calls the route, streams Noor's text through `onText`, and always resolves to `{ mode: "model" | "fallback", text }`. Fallback text is `mission.hints[objectiveId][tier - 1]` verbatim. It re-throws only on a caller abort.
  - `buildMentorTranscript(blocks)` / `capTranscript(entries)` — apply the shared transcript caps client-side.
  - `HINT_COOLDOWN_MS` (30s), `nextTierUnlockTime`, `isNextTierUnlocked`, `HINT_TIERS`, and the shared types.
- **`server.ts` (server-only)** — for the route and tests only.
  - `handleHintRequest(request, deps)` — the whole request→response logic, with `getMission`, the config, and the model runner injected (so tests never touch the network).
  - `buildHintPrompt` / `buildSystemPrompt` — pure prompt building.
  - `validateMentorOutput` — the output safety check.
  - `parseMentorHintRequest` / `MentorHintRequestSchema` — the request schema and caps.
  - `readMentorConfig`, `createAnthropicRunner`, and the caps/limits constants.

## The no-key-in-client rule

The Anthropic SDK is imported from exactly one module, `anthropic-client.ts`, which begins with `import "server-only"` so importing it from any client module is a build error. It is reached only through `server.ts`, which is imported only by the route (`src/app/api/mentor/hint/route.ts`). The client API (`index.ts`) never imports it, so no key or model endpoint can reach a client bundle.

## Never import here

- Another feature's internals (only `@/features/<name>` or `@/features/<name>/server`).
- The Anthropic SDK or any API key from anywhere but `anthropic-client.ts`.
- Browser storage. Nothing is stored between requests: the route is stateless, and the client keeps hint text only in React state for the current run.

## The model never holds the answer

The route loads the authored tier text from the mission content by `(missionId, objectiveId, tier)`, never from the request. The prompt is given tiers 1..tier (all already shown to the learner) and never a later tier, the objective's description and `why`, and the delimited transcript — and never the objective's `check`, its `success` line, other objectives' hints, the scenario ground truth, the story beats, or the debrief. See `prompt-builder.ts`.
