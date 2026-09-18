/**
 * The mentor feature's server-only public API (md-files/10-ai-mentor.md, phase 10). It exposes the
 * pieces the routes under /api/mentor need — the request schemas, prompt building, output
 * validation, the config, and the three handlers (hint, explain, review) — plus the SDK-backed model
 * runner.
 *
 * The Anthropic SDK and the API key are reached ONLY through `anthropic-client.ts`, whose module
 * carries `import "server-only"`. This barrel deliberately does not import "server-only" itself, so
 * the pure pieces (prompt building, validation, the schemas) stay unit-testable in Node, while the
 * key never has a path into a client bundle: `@/features/mentor` (the client API) imports none of
 * this.
 */
export { createAnthropicRunner, getAnthropicRunner } from "./anthropic-client";
export {
  DEFAULT_MENTOR_MODEL,
  MAX_EXPLAIN_OUTPUT_TOKENS,
  MAX_OUTPUT_TOKENS,
  MAX_REQUEST_BODY_BYTES,
  MAX_REVIEW_OUTPUT_TOKENS,
  MODEL_TIMEOUT_MS,
  readMentorConfig,
  REVIEW_TIMEOUT_MS,
  type MentorConfig,
} from "./config";
export { handleHintRequest, type HandleHintDeps } from "./handler";
export { handleExplainRequest, type HandleExplainDeps } from "./explain-handler";
export {
  checkReviewOutput,
  handleReviewRequest,
  type HandleReviewDeps,
  type ReviewCheck,
} from "./review-handler";
export type { MentorLogEntry } from "./respond";
export type {
  MentorModelInput,
  MentorModelRunner,
  MentorModelStream,
  MentorModelUsage,
} from "./model";
export {
  buildHintPrompt,
  HINT_PROMPT_VERSION,
  type BuildHintPromptResult,
  type HintPrompt,
} from "./prompt-builder";
export { buildExplainPrompt, type BuildExplainPromptResult } from "./explain-prompt";
export { buildReviewPrompt, reviewLessonIds, type ReviewPromptBuild } from "./review-prompt";
export {
  buildHintSystemPrompt,
  buildHintUserMessage,
  TRANSCRIPT_CLOSE,
  TRANSCRIPT_OPEN,
  vocabularyGuidance,
} from "./prompts/hint.v2";
export { EXPLAIN_PROMPT_VERSION } from "./prompts/explain.v1";
export { REVIEW_JSON_SCHEMA, REVIEW_PROMPT_VERSION } from "./prompts/review.v1";
export {
  asHintTier,
  MentorExplainRequestSchema,
  MentorHintRequestSchema,
  MentorReviewRequestSchema,
  parseMentorExplainRequest,
  parseMentorHintRequest,
  parseMentorReviewRequest,
  type MentorExplainRequest,
  type MentorHintRequest,
  type MentorReviewRequest,
} from "./schema";
export { validateMentorOutput, type MentorValidationResult } from "./validate";
