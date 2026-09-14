/**
 * The mentor feature's client-safe public API (md-files/10-ai-mentor.md, phase 10). It gives hints,
 * never answers, and hints never cost anything. Nothing here imports the Anthropic SDK or any API
 * key: model calls go through the server route at /api/mentor/hint, whose code lives behind
 * `@/features/mentor/server`. This file may safely land in a client bundle.
 */
import type { Mission } from "@/content/schemas/mission";
import {
  MENTOR_MODE_HEADER,
  type HintTier,
  type MentorHintResult,
  type MentorStreamEvent,
} from "./protocol";
import type { MentorTranscript } from "./transcript";

export {
  HINT_COOLDOWN_MS,
  HINT_TIERS,
  isNextTierUnlocked,
  nextTierUnlockTime,
  type HintTier,
  type MentorHintResult,
  type MentorMode,
} from "./protocol";
export {
  buildMentorTranscript,
  capTranscript,
  MAX_TRANSCRIPT_COMMANDS,
  type MentorTranscript,
  type MentorTranscriptEntry,
} from "./transcript";

/** The route the browser calls. Same-origin; the API key stays on the server. */
const MENTOR_HINT_ENDPOINT = "/api/mentor/hint";

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
function authoredText(mission: Mission, objectiveId: string, tier: HintTier): string {
  return mission.hints[objectiveId]?.[tier - 1] ?? "";
}

/**
 * Asks Noor to personalise the authored hint. Streams her text through `onText`, and always resolves
 * to `{ mode, text }`: `model` with her rewrite, or `fallback` with the authored tier text verbatim.
 * It never rejects for a service problem — a network error, a rate-limit (the Vercel Firewall rule on
 * /api/mentor/*), the kill switch, a rejected response, or any non-OK status all resolve to the
 * authored fallback, so the learner never sees an error. It re-throws only on a caller-triggered
 * abort, so a React effect cleanup can ignore it.
 */
export async function requestMentorHint(
  options: RequestMentorHintOptions,
): Promise<MentorHintResult> {
  const { mission, objectiveId, tier, transcript, onText, signal } = options;
  const authored = authoredText(mission, objectiveId, tier);
  const fallback: MentorHintResult = { mode: "fallback", text: authored };

  const respondWithFallback = (): MentorHintResult => {
    onText?.(authored);
    return fallback;
  };

  let response: Response;
  try {
    response = await fetch(MENTOR_HINT_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ missionId: mission.id, objectiveId, tier, transcript }),
      signal,
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    return respondWithFallback();
  }

  // A rate-limit (429) or any non-OK status is not an error to the learner: show the authored hint.
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

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
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
