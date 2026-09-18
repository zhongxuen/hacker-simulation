import type { Mission } from "@/content/schemas/mission";
import { MAX_OUTPUT_TOKENS, type MentorConfig } from "./config";
import type { MentorModelRunner } from "./model";
import { buildHintPrompt } from "./prompt-builder";
import { HINT_PROMPT_VERSION } from "./prompts/hint.v2";
import type { MentorFallbackReason } from "./protocol";
import {
  defaultLog,
  modelAvailable,
  readJsonBody,
  streamFallbackResponse,
  streamModelText,
  type LogBase,
  type MentorLog,
  type MentorLogEntry,
} from "./respond";
import { parseMentorHintRequest } from "./schema";

/**
 * The mentor hint handler (md-files/10-ai-mentor.md, prompts 10.1, 10.2, 10.5). The route calls this;
 * it holds no state between requests. Everything it needs is injected, so the tests run it with a
 * mock model runner and never touch the network.
 *
 * It streams newline-delimited JSON (`text` / `done` / `fallback`), and the `x-mentor-mode` response
 * header says `model` or `fallback`. Nothing ever surfaces to the learner as an error: a missing key,
 * the kill switch, a bad request, an unknown target, a model failure, a rejected response, or an
 * over-cap body all end the same way — a `fallback` event, and the client shows the authored hint.
 * The streaming, validation and logging it shares with "Explain this" live in respond.ts.
 */

export type { MentorLogEntry };

export interface HandleHintDeps {
  readonly config: MentorConfig;
  readonly getMission: (id: string) => Mission | undefined;
  /** The model runner. Omit only when the config has no key or is disabled (no model call is made). */
  readonly runner?: MentorModelRunner;
  readonly log?: MentorLog;
}

export async function handleHintRequest(request: Request, deps: HandleHintDeps): Promise<Response> {
  const { config, getMission } = deps;
  const log = deps.log ?? defaultLog;
  const base: LogBase = { kind: "hint", promptVersion: HINT_PROMPT_VERSION };

  // 1. Body-size cap, then parse and validate the request (the transcript is capped in the schema).
  const body = await readJsonBody(request);
  if (!body.ok) return streamFallbackResponse(body.reason, body.status, log, base);
  const parsed = parseMentorHintRequest(body.data);
  if (!parsed.ok || !parsed.request) {
    return streamFallbackResponse("invalid_request", 400, log, base);
  }
  const { missionId, objectiveId, tier, transcript } = parsed.request;
  const known: LogBase = { ...base, missionId, objectiveId, tier };

  // 2. Load the authored tier from the mission content — never from the request. An unknown mission,
  //    objective, tier, or a hidden objective (which ships no hints) is a 4xx the client treats as
  //    fallback.
  const mission = getMission(missionId);
  if (!mission) return streamFallbackResponse("unknown_target", 404, log, known);
  const built = buildHintPrompt(mission, objectiveId, tier, transcript);
  if (!built.ok) {
    const reason: MentorFallbackReason =
      built.problem === "no_hints" ? "no_hints" : "unknown_target";
    return streamFallbackResponse(reason, 404, log, known);
  }

  // 3. Kill switch or no key: fall back cleanly. Nothing reveals which.
  if (!modelAvailable(config, deps.runner)) {
    return streamFallbackResponse("disabled", 200, log, { ...known, model: config.model });
  }

  // 4. Call the model, validating before releasing, and log exactly once when it ends.
  return streamModelText({
    config,
    runner: deps.runner,
    prompt: built.prompt,
    maxTokens: MAX_OUTPUT_TOKENS,
    log,
    base: { ...known, promptVersion: built.prompt.version },
  });
}

export { MAX_OUTPUT_TOKENS };
