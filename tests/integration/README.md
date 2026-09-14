# tests/integration

Route Handlers end to end, in Node (md-files/11-testing-security-deployment.md, "Integration"): `mentor-routes.test.ts` calls the real exported `POST` of `/api/mentor/hint`, `/explain` and `/review`, through the real config, handler, prompt builder, output validator and SDK-backed runner. Only `@anthropic-ai/sdk` is replaced (with `vi.mock`), by a fake that records every call and streams whatever reply the test sets. It covers every security-relevant path: validation and size limits, the hint tier loaded from content, the fallbacks, output validation, cross-site refusal, and logs with no learner text.

Never import here: a real network, or a real API key.
