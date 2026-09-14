import type { GlossaryEntry } from "@/content/schemas/glossary";
import type { Mission } from "@/content/schemas/mission";
import { MAX_EXPLAIN_OUTPUT_TOKENS, type MentorConfig } from "./config";
import { buildExplainPrompt } from "./explain-prompt";
import type { MentorModelRunner } from "./model";
import { EXPLAIN_PROMPT_VERSION } from "./prompts/explain.v1";
import {
  defaultLog,
  modelAvailable,
  readJsonBody,
  streamFallbackResponse,
  streamModelText,
  type LogBase,
  type MentorLog,
} from "./respond";
import { parseMentorExplainRequest } from "./schema";

/**
 * The "Explain this" handler (md-files/10-ai-mentor.md, prompt 10.3): POST /api/mentor/explain.
 * Stateless, streaming, and shaped exactly like the hint handler — the same body cap, NDJSON events,
 * validate-before-release, fallbacks and one metadata-only log line. On any fallback the client shows
 * the explanation written ahead of time: the terminal's own beginner explainer for an error, its
 * "What just happened?" walk-through for a command, or the glossary's definition for a word.
 */

export interface HandleExplainDeps {
  readonly config: MentorConfig;
  readonly getMission: (id: string) => Mission | undefined;
  /** Glossary lookup; defaults to src/content/glossary.ts. */
  readonly getTerm?: (id: string) => GlossaryEntry | undefined;
  readonly runner?: MentorModelRunner;
  readonly log?: MentorLog;
}

export async function handleExplainRequest(
  request: Request,
  deps: HandleExplainDeps,
): Promise<Response> {
  const { config, getMission } = deps;
  const log = deps.log ?? defaultLog;
  const base: LogBase = { kind: "explain", promptVersion: EXPLAIN_PROMPT_VERSION };

  const body = await readJsonBody(request);
  if (!body.ok) return streamFallbackResponse(body.reason, body.status, log, base);
  const parsed = parseMentorExplainRequest(body.data);
  if (!parsed.ok) return streamFallbackResponse("invalid_request", 400, log, base);
  const { missionId, objectiveId, subject, transcript } = parsed.request;
  const known: LogBase = {
    ...base,
    missionId,
    ...(objectiveId !== undefined && { objectiveId }),
    subject: subject.kind,
  };

  const mission = getMission(missionId);
  if (!mission) return streamFallbackResponse("unknown_target", 404, log, known);
  const built = buildExplainPrompt(
    mission,
    { ...(objectiveId !== undefined && { objectiveId }), subject, transcript },
    ...(deps.getTerm ? [deps.getTerm] : []),
  );
  if (!built.ok) return streamFallbackResponse("unknown_target", 404, log, known);

  if (!modelAvailable(config, deps.runner)) {
    return streamFallbackResponse("disabled", 200, log, { ...known, model: config.model });
  }

  return streamModelText({
    config,
    runner: deps.runner,
    prompt: built.prompt,
    maxTokens: MAX_EXPLAIN_OUTPUT_TOKENS,
    log,
    base: { ...known, promptVersion: built.prompt.version },
  });
}
