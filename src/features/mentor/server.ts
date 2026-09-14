/**
 * The mentor feature's server-only public API (md-files/10-ai-mentor.md, phase 10). It exposes the
 * pieces the route at /api/mentor/hint needs — the request schema, prompt building, output
 * validation, the config, and the handler — plus the SDK-backed model runner.
 *
 * The Anthropic SDK and the API key are reached ONLY through `createAnthropicRunner`, whose module
 * carries `import "server-only"`. This barrel deliberately does not import "server-only" itself, so
 * the pure pieces (prompt building, validation, the schema) stay unit-testable in Node, while the
 * key never has a path into a client bundle: `@/features/mentor` (the client API) imports none of
 * this.
 */
export { createAnthropicRunner } from "./anthropic-client";
export {
  DEFAULT_MENTOR_MODEL,
  MAX_OUTPUT_TOKENS,
  MAX_REQUEST_BODY_BYTES,
  MODEL_TIMEOUT_MS,
  readMentorConfig,
  type MentorConfig,
} from "./config";
export { handleHintRequest, type HandleHintDeps, type MentorLogEntry } from "./handler";
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
export {
  buildSystemPrompt,
  buildUserMessage,
  TRANSCRIPT_CLOSE,
  TRANSCRIPT_OPEN,
  vocabularyGuidance,
} from "./prompts/hint.v1";
export {
  asHintTier,
  MentorHintRequestSchema,
  parseMentorHintRequest,
  type MentorHintRequest,
} from "./schema";
export { validateMentorOutput, type MentorValidationResult } from "./validate";
