import type { Mission } from "@/content/schemas/mission";
import {
  MAX_OUTPUT_TOKENS,
  MAX_REQUEST_BODY_BYTES,
  MODEL_TIMEOUT_MS,
  type MentorConfig,
} from "./config";
import type { MentorModelRunner } from "./model";
import { buildHintPrompt } from "./prompt-builder";
import { HINT_PROMPT_VERSION } from "./prompts/hint.v1";
import {
  MENTOR_MODE_HEADER,
  MENTOR_STREAM_CONTENT_TYPE,
  type MentorFallbackReason,
  type MentorStreamEvent,
} from "./protocol";
import { parseMentorHintRequest } from "./schema";
import { validateMentorOutput } from "./validate";

/**
 * The mentor hint handler (md-files/10-ai-mentor.md, prompts 10.1, 10.2, 10.5). The route calls this;
 * it holds no state between requests. Everything it needs is injected, so the tests run it with a
 * mock model runner and never touch the network.
 *
 * It streams newline-delimited JSON (`text` / `done` / `fallback`), and the `x-mentor-mode` response
 * header says `model` or `fallback`. Nothing ever surfaces to the learner as an error: a missing key,
 * the kill switch, a bad request, an unknown target, a model failure, a rejected response, or an
 * over-cap body all end the same way — a `fallback` event, and the client shows the authored hint.
 *
 * STREAMING vs VALIDATE-BEFORE-SEND. These pull in opposite directions: streaming wants to release
 * text as it arrives, but nothing unvalidated may reach the client. The resolution: accumulate the
 * whole response, re-validate the entire buffer on every chunk, and release only *completed*
 * sentences (the in-progress tail is held back). A payload that only completes in the unreleased tail
 * still fails validation and forces a fallback before its sentence is released. A late rejection
 * (after some sentences were shown) sends a `fallback` event, and the client discards what it showed
 * and swaps to the authored text. The cost is that a hint may briefly show a sentence that a later
 * rejection retracts — acceptable, because the mentor is an enhancement and the authored hint always
 * wins.
 *
 * LOGGING. Exactly one structured line per request, metadata only — never the transcript or any
 * learner text. When validation rejects a response, the rejected model text is logged, truncated, so
 * it can be reviewed. This line is also the hint-usage analytics event until phase 11.
 */

export interface MentorLogEntry {
  readonly feature: "mentor";
  readonly promptVersion: string;
  readonly missionId?: string;
  readonly objectiveId?: string;
  readonly tier?: number;
  readonly model?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly fallback: boolean;
  readonly fallbackReason?: MentorFallbackReason;
  readonly validationRejected: boolean;
  /** Only set when validation rejected the model text: the rejected text, truncated. Never learner text. */
  readonly rejectedText?: string;
}

export interface HandleHintDeps {
  readonly config: MentorConfig;
  readonly getMission: (id: string) => Mission | undefined;
  /** The model runner. Omit only when the config has no key or is disabled (no model call is made). */
  readonly runner?: MentorModelRunner;
  readonly log?: (entry: MentorLogEntry) => void;
}

/** How much of a rejected model response to log, in characters. */
const REJECTED_LOG_CHARS = 300;

const encoder = new TextEncoder();

function eventText(event: MentorStreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}

function eventLine(event: MentorStreamEvent): Uint8Array {
  return encoder.encode(eventText(event));
}

function truncateForLog(text: string): string {
  const trimmed = text.trim();
  return trimmed.length <= REJECTED_LOG_CHARS
    ? trimmed
    : `${trimmed.slice(0, REJECTED_LOG_CHARS)}…`;
}

/** A single-event response for the paths that fall back before any model call. */
function fallbackResponse(
  reason: MentorFallbackReason,
  status: number,
  log: (entry: MentorLogEntry) => void,
  fields: Partial<MentorLogEntry> = {},
): Response {
  log({
    feature: "mentor",
    promptVersion: HINT_PROMPT_VERSION,
    fallback: true,
    fallbackReason: reason,
    validationRejected: false,
    ...fields,
  });
  return new Response(eventText({ type: "fallback", reason }), {
    status,
    headers: {
      "content-type": MENTOR_STREAM_CONTENT_TYPE,
      [MENTOR_MODE_HEADER]: "fallback",
      "cache-control": "no-store",
    },
  });
}

/**
 * The greatest index in `text` (beyond `from`) that ends a completed sentence: a `.`/`!`/`?`
 * (with an optional closing quote or bracket) followed by whitespace, or a newline. The in-progress
 * final sentence, which has no trailing whitespace yet, is held back until the stream ends.
 */
function lastReleasableIndex(text: string, from: number): number {
  const re = /[.!?]["')\]]?(?=\s)|\n/g;
  let index = from;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const end = match.index + match[0].length;
    if (end > from) index = end;
  }
  return index;
}

export async function handleHintRequest(request: Request, deps: HandleHintDeps): Promise<Response> {
  const { config, getMission } = deps;
  const log = deps.log ?? defaultLog;

  // 1. Body-size cap: the declared length, then the actual bytes read.
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BODY_BYTES) {
    return fallbackResponse("request_too_large", 413, log);
  }
  const body = await request.text();
  if (encoder.encode(body).length > MAX_REQUEST_BODY_BYTES) {
    return fallbackResponse("request_too_large", 413, log);
  }

  // 2. Parse and validate the request (the transcript is capped inside the schema).
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return fallbackResponse("invalid_request", 400, log);
  }
  const parsed = parseMentorHintRequest(data);
  if (!parsed.ok || !parsed.request) {
    return fallbackResponse("invalid_request", 400, log);
  }
  const { missionId, objectiveId, tier, transcript } = parsed.request;
  const known = { missionId, objectiveId, tier };

  // 3. Load the authored tier from the mission content — never from the request. An unknown mission,
  //    objective, tier, or a hidden objective (which ships no hints) is a 4xx the client treats as
  //    fallback.
  const mission = getMission(missionId);
  if (!mission) return fallbackResponse("unknown_target", 404, log, known);
  const built = buildHintPrompt(mission, objectiveId, tier, transcript);
  if (!built.ok) {
    const reason: MentorFallbackReason =
      built.problem === "no_hints" ? "no_hints" : "unknown_target";
    return fallbackResponse(reason, 404, log, known);
  }

  // 4. Kill switch or no key: fall back cleanly. Nothing reveals which.
  if (config.disabled || !config.apiKey || !deps.runner) {
    return fallbackResponse("disabled", 200, log, { ...known, model: config.model });
  }

  // 5. Call the model, validating before releasing, and log exactly once when it ends.
  const runner = deps.runner;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: MentorStreamEvent) => controller.enqueue(eventLine(event));
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), MODEL_TIMEOUT_MS);

      let full = "";
      let released = 0;
      let fallbackReason: MentorFallbackReason | undefined;
      let inputTokens: number | undefined;
      let outputTokens: number | undefined;

      try {
        const run = runner(
          {
            model: config.model,
            system: built.prompt.system,
            messages: built.prompt.messages,
            maxTokens: MAX_OUTPUT_TOKENS,
          },
          abort.signal,
        );
        for await (const delta of run) {
          full += delta;
          if (!validateMentorOutput(full).ok) {
            fallbackReason = "validation_rejected";
            break;
          }
          const boundary = lastReleasableIndex(full, released);
          if (boundary > released) {
            send({ type: "text", text: full.slice(released, boundary) });
            released = boundary;
          }
        }

        if (fallbackReason === undefined) {
          if (!validateMentorOutput(full).ok) {
            fallbackReason = "validation_rejected";
          } else if (full.trim() === "") {
            fallbackReason = "empty_output";
          } else {
            if (released < full.length) send({ type: "text", text: full.slice(released) });
            send({ type: "done" });
          }
        }
        if (fallbackReason !== undefined) send({ type: "fallback", reason: fallbackReason });

        try {
          const usage = await run.usage();
          inputTokens = usage.inputTokens;
          outputTokens = usage.outputTokens;
        } catch {
          // Usage is best-effort; a broken/aborted run just logs without token counts.
        }
      } catch {
        fallbackReason = "model_error";
        send({ type: "fallback", reason: "model_error" });
      } finally {
        clearTimeout(timer);
        const rejected = fallbackReason === "validation_rejected";
        log({
          feature: "mentor",
          promptVersion: built.prompt.version,
          ...known,
          model: config.model,
          inputTokens,
          outputTokens,
          fallback: fallbackReason !== undefined,
          fallbackReason,
          validationRejected: rejected,
          ...(rejected ? { rejectedText: truncateForLog(full) } : {}),
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": MENTOR_STREAM_CONTENT_TYPE,
      [MENTOR_MODE_HEADER]: "model",
      "cache-control": "no-store",
    },
  });
}

/** One JSON line to the server console. Vercel's runtime logs collect it; we store nothing ourselves. */
function defaultLog(entry: MentorLogEntry): void {
  console.log(JSON.stringify(entry));
}

export { MAX_OUTPUT_TOKENS };
