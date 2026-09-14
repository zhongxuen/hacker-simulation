# tests/mentor

The AI mentor's prompt-injection suite (phase 10), part of the `unit` Vitest project. `injection.test.ts` runs 16 injection attempts through the hint, explain and review prompts and checks they stay fenced as data, and that output validation catches what a tricked model might write. A live-model evaluation of the same attempts runs only when `ANTHROPIC_API_KEY` is set (it's skipped in CI).

Never import here: a real API key or network, except in the live block, which must stay skipped without a key.
