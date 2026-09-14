import type { Mission } from "@/content/schemas/mission";
import {
  MENTOR_ENDPOINTS,
  MENTOR_MODE_HEADER,
  type ExplainSubject,
  type HintTier,
  type MentorHintResult,
  type MentorStreamEvent,
  type MentorTextResult,
} from "./protocol";
import {
  buildFallbackReview,
  MentorReviewSchema,
  type MentorReviewResult,
  type ReviewFacts,
} from "./review";
import type { MentorTranscript } from "./transcript";

/**
 * The browser side of the mentor routes (md-files/10-ai-mentor.md, prompts 10.1, 10.3, 10.4). Every
 * request here always resolves: a network error, a rate-limit (the Vercel Firewall rule on
 * /api/mentor/*), the kill switch, a rejected response, or any non-OK status all resolve to the text
 * written ahead of time, so the learner never sees an error. They re-throw only on a caller-triggered
 * abort, so cleanup can ignore it. Nothing here imports the SDK or a key.
 */

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Posts `body` to a text route and streams the answer through `onText` (the full text so far, not
 * just the new chunk). Resolves to `model` with the mentor's text, or `fallback` with `fallbackText`
 * verbatim (also passed to `onText` once).
 */
async function requestMentorText(
  endpoint: string,
  body: unknown,
  fallbackText: string,
  onText?: (text: string) => void,
  signal?: AbortSignal,
): Promise<MentorTextResult> {
  const respondWithFallback = (): MentorTextResult => {
    onText?.(fallbackText);
    return { mode: "fallback", text: fallbackText };
  };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    return respondWithFallback();
  }

  // A rate-limit (429) or any non-OK status is not an error to the learner: show the authored text.
  if (!response.ok || !response.body || response.headers.get(MENTOR_MODE_HEADER) === "fallback") {
    return respondWithFallback();
  }

  try {
    let accumulated = "";
    for await (const event of readNdjson(response.body)) {
      if (event.type === "text") {
        accumulated += event.text;
        onText?.(accumulated);
      } else if (event.type === "fallback") {
        return respondWithFallback();
      } else if (event.type === "done") {
        return accumulated.trim() === ""
          ? respondWithFallback()
          : { mode: "model", text: accumulated };
      }
    }
    // The stream ended without a `done`: treat as a fallback.
    return respondWithFallback();
  } catch (error) {
    if (isAbort(error)) throw error;
    return respondWithFallback();
  }
}

/** Reads a newline-delimited-JSON body one event at a time. Unparseable lines are skipped. */
async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<MentorStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        const event = parseEvent(line);
        if (event) yield event;
        newline = buffer.indexOf("\n");
      }
    }
    const last = buffer.trim();
    if (last !== "") {
      const event = parseEvent(last);
      if (event) yield event;
    }
  } finally {
    reader.releaseLock();
  }
}

function parseEvent(line: string): MentorStreamEvent | undefined {
  if (line === "") return undefined;
  try {
    const value = JSON.parse(line) as MentorStreamEvent;
    return value && typeof value === "object" && "type" in value ? value : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------------------------
// Hints
// ---------------------------------------------------------------------------------------------

export interface RequestMentorHintOptions {
  readonly mission: Mission;
  readonly objectiveId: string;
  readonly tier: HintTier;
  /** The learner's recent terminal activity, already capped. Empty when no terminal is attached. */
  readonly transcript: MentorTranscript;
  /**
   * Called as Noor's hint streams in, with the full text so far (not just the new chunk), so the UI
   * can set it directly. On a fallback it is called once with the authored text.
   */
  readonly onText?: (text: string) => void;
  readonly signal?: AbortSignal;
}

/** The authored tier text the client already holds and always falls back to (verbatim). */
export function authoredHint(mission: Mission, objectiveId: string, tier: HintTier): string {
  return mission.hints[objectiveId]?.[tier - 1] ?? "";
}

/**
 * Asks Noor to personalise the authored hint. Streams her text through `onText`, and always resolves
 * to `{ mode, text }`: `model` with her rewrite, or `fallback` with the authored tier text verbatim.
 */
export function requestMentorHint(options: RequestMentorHintOptions): Promise<MentorHintResult> {
  const { mission, objectiveId, tier, transcript, onText, signal } = options;
  return requestMentorText(
    MENTOR_ENDPOINTS.hint,
    { missionId: mission.id, objectiveId, tier, transcript },
    authoredHint(mission, objectiveId, tier),
    onText,
    signal,
  );
}

// ---------------------------------------------------------------------------------------------
// "Explain this"
// ---------------------------------------------------------------------------------------------

export interface RequestMentorExplainOptions {
  readonly missionId: string;
  /** The objective the learner is on, for context. */
  readonly objectiveId?: string;
  readonly subject: ExplainSubject;
  readonly transcript: MentorTranscript;
  /**
   * The explanation written ahead of time, shown verbatim if the mentor is unavailable: the
   * terminal's beginner explainer, its "What just happened?" walk-through, or the glossary entry.
   */
  readonly fallback: string;
  readonly onText?: (text: string) => void;
  readonly signal?: AbortSignal;
}

/** Asks Noor to explain a line, a result, an error or a word. Always resolves, like a hint. */
export function requestMentorExplain(
  options: RequestMentorExplainOptions,
): Promise<MentorTextResult> {
  const { missionId, objectiveId, subject, transcript, fallback, onText, signal } = options;
  return requestMentorText(
    MENTOR_ENDPOINTS.explain,
    { missionId, ...(objectiveId !== undefined && { objectiveId }), subject, transcript },
    fallback,
    onText,
    signal,
  );
}

// ---------------------------------------------------------------------------------------------
// The post-mission review
// ---------------------------------------------------------------------------------------------

export interface RequestMentorReviewOptions {
  readonly missionId: string;
  readonly facts: ReviewFacts;
  /** The run's terminal activity, capped with REVIEW_TRANSCRIPT_LIMITS. */
  readonly transcript: MentorTranscript;
  readonly signal?: AbortSignal;
}

/**
 * Asks Noor to look back at the run. Resolves to her review, or to the template review built from
 * the run's facts when she's unavailable (`mode: "fallback"`). Only the ids, counts and the capped
 * transcript are sent: the server looks up every word about the mission itself.
 */
export async function requestMentorReview(
  options: RequestMentorReviewOptions,
): Promise<MentorReviewResult> {
  const { missionId, facts, transcript, signal } = options;
  const fallback: MentorReviewResult = { mode: "fallback", review: buildFallbackReview(facts) };
  try {
    const response = await fetch(MENTOR_ENDPOINTS.review, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        missionId,
        completed: facts.objectives.filter((objective) => objective.done).map((o) => o.id),
        hintsOpened: Object.fromEntries(
          facts.objectives
            .filter((objective) => objective.hintsOpened > 0)
            .map((objective) => [objective.id, Math.min(3, objective.hintsOpened)]),
        ),
        minutes: facts.minutes,
        resets: facts.resets,
        commandCount: facts.commandLines.length,
        transcript,
      }),
      signal,
    });
    if (!response.ok || response.headers.get(MENTOR_MODE_HEADER) === "fallback") return fallback;
    const data = (await response.json()) as { mode?: unknown; review?: unknown };
    if (data.mode !== "model") return fallback;
    const parsed = MentorReviewSchema.safeParse(data.review);
    return parsed.success ? { mode: "model", review: parsed.data } : fallback;
  } catch (error) {
    if (isAbort(error)) throw error;
    return fallback;
  }
}
