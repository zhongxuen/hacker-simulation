# src/features/mentor

The AI Mentor: Noor Halvorsen (`mentor-noor` in the story bible). She personalises authored hints (hints, never answers, and hints never cost anything), explains what's on the learner's screen, and looks back at a finished run with them. Phase 10 (see `md-files/10-ai-mentor.md`).

The mentor is an **enhancement, never a dependency**. With no API key, the kill switch on, a rate-limit hit, a model failure, or a rejected response, the learner still gets text written ahead of time, in Noor's voice, and nothing surfaces as an error: the authored hint verbatim, the terminal's own explanation, the glossary's definition, or the template review. She also **never opens anything by herself**: the learner asks, and the mentor only ever offers.

## Public API

- **`index.ts` (client-safe)** — safe to bundle for the browser. Imports no API key and no Anthropic SDK.
  - Requests (`client.ts`), each of which always resolves and re-throws only on a caller abort:
    - `requestMentorHint({ mission, objectiveId, tier, transcript, onText, signal })` → `{ mode, text }`; the fallback is `mission.hints[objectiveId][tier - 1]` verbatim (`authoredHint`).
    - `requestMentorExplain({ missionId, objectiveId?, subject, transcript, fallback, onText, signal })` → `{ mode, text }`; `subject` is terminal output (a line or a whole result, flagged when it's an error) or a glossary word by id.
    - `requestMentorReview({ missionId, facts, transcript, signal })` → `{ mode, review }`; the fallback is `buildFallbackReview(facts)`.
  - The attempt's memory (`session/`): `useMentorSession(mission)` (the React hook the mission runner holds per attempt) over `createMentorStore(mission, deps?)`, a plain store of every hint tier shown, each explanation, and the review. `askHint` enforces the ladder (tier 1 at once, later tiers after `HINT_COOLDOWN_MS`, never past tier 3, never for a secret); `requestReview` runs once per attempt. Selectors: `hintsFor`, `nextHintTier`, `nextHintUnlockAt`, `canRevealHint`. `staticMentorSession()` never asks anything (the styleguide and tests).
  - The review (`review.ts`): `MentorReview` and its schema, `ReviewFacts` (gathered by the missions feature), `runFactLines` ("Your run at a glance": objectives, time, hints opened, commands tried) and `buildFallbackReview`, the template.
  - The nudge (`nudge.ts`): `useNudge({ progress, failures, enabled })` and the pure `seemsStuck` (3 attempts that didn't work since the last tick, or 3 minutes without one).
  - Transcripts: `buildMentorTranscript(blocks, limits?)` / `capTranscript(entries, limits?)`, with `HINT_TRANSCRIPT_LIMITS` (the last 12 commands in detail) and `REVIEW_TRANSCRIPT_LIMITS` (up to 40 commands, the start of each output).
  - Components (`components/`): `MentorPanel` (the drawer: Noor's welcome, "Hints are free", the hint ladder for one step at a time with which hint you're on and a calm cooldown, explanations under the questions asked, and a quiet line when she's answering from her notes), `MentorBubble` (one reply as a `CharacterMessage`: typing indicator, her words, or "From Noor's notes"), `TypingIndicator` (loops like any loading indicator, stands still under reduced motion), `NudgeChip`, `MentorReviewCard` (the debrief's "Looking back with Noor"), `MentorText`.
  - Shared constants: `HINT_TIERS`, `HINT_TIER_LABELS`, `MENTOR_ENDPOINTS`, `MENTOR_FIRST_NAME`, `HINTS_ARE_FREE`, `FROM_NOTES_LABEL`.
- **`server.ts` (server-only)** — for the routes and tests only.
  - `handleHintRequest`, `handleExplainRequest`, `handleReviewRequest(request, deps)` — the whole request→response logic, with `getMission`, the config, and the model runner injected (so tests never touch the network). The streaming, body cap, fallbacks and the one metadata-only log line they share live in `respond.ts`. Its `readJsonBody` refuses a request from another site (403), a body not sent as JSON (415) and a body over 16 KB (413, read as a stream and dropped as soon as it passes the cap) before anything is parsed (phase 11).
  - `buildHintPrompt`, `buildExplainPrompt`, `buildReviewPrompt` — pure prompt building. Versioned prompt files are in `prompts/` (`hint.v1`, `explain.v1`, `review.v1`, and `noor.v1`, the persona, voice, safety and data rules the newer two share).
  - `validateMentorOutput` — the output safety check; `checkReviewOutput` — the review's JSON shape, every sentence validated, lessons limited to the mission's own.
  - The request schemas and caps, `readMentorConfig`, `createAnthropicRunner` / `getAnthropicRunner`, and the caps and limits constants.

## Where the mentor shows up

- **Mission workspace** (`@/features/missions`): an "Ask Noor" button beside Reference opens the panel (the two drawers take turns). "Show me a hint" on an objective shows tier 1 in the panel; "Explain this" in the terminal (per command, with a chooser for each line, and a hover shortcut per line) and on a glossary word in the Reference ask for an explanation. The "Want a nudge?" chip sits in the notifications corner when the learner seems stuck and the `nudgeChip` setting is on.
- **Debrief**: "Looking back with Noor", asked for by the learner, held with the attempt so it's written once.

## The no-key-in-client rule

The Anthropic SDK is imported from exactly one module, `anthropic-client.ts`, which begins with `import "server-only"` so importing it from any client module is a build error. It is reached only through `server.ts`, which is imported only by the routes (`src/app/api/mentor/{hint,explain,review}/route.ts`). The client API (`index.ts`) never imports it, so no key or model endpoint can reach a client bundle.

## Never import here

- Another feature's internals (only `@/features/<name>` or `@/features/<name>/server`). The missions feature imports this one, never the other way round.
- The Anthropic SDK or any API key from anywhere but `anthropic-client.ts`.
- Browser storage. Nothing is stored between requests: the routes are stateless, and the client keeps everything the mentor said only in memory, for the current attempt.

## The model never holds the answer

- **Hints**: the route loads the authored tier from the mission content by `(missionId, objectiveId, tier)`, never from the request. The prompt is given tiers 1..tier (all already shown to the learner) and never a later tier, the objective's description and `why`, and the delimited transcript — and never the objective's `check`, its `success` line, other objectives' hints, the scenario ground truth, the story beats, or the debrief. See `prompt-builder.ts`.
- **Explanations**: the mission's title and difficulty, the current step's description, the glossary definition (from the content) for a word, and the learner's screen as delimited data. No hint at all. See `explain-prompt.ts`.
- **Reviews**: the words of the objectives the learner ticked and the extras they found (never an unfound secret), learning goals, counts, and the lesson ids it may suggest. No hint, check, success line or debrief copy. See `review-prompt.ts`.

`tests/mentor/injection.test.ts` runs 16 injection attempts through all three prompts.
