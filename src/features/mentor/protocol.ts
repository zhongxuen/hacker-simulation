/**
 * The wire protocol between the browser and the mentor route, and the small set of constants both
 * sides share (md-files/10-ai-mentor.md, prompt 10.1). Kept free of any server-only import so both
 * the client (`index.ts`) and the server (`server.ts`) can use it.
 */

/** There are three authored hint tiers per objective: a nudge, the idea, then a near-answer. */
export type HintTier = 1 | 2 | 3;

export const HINT_TIERS: readonly HintTier[] = [1, 2, 3];

/** Header the route sets so a client (or a proxy) can see at a glance which path answered. */
export const MENTOR_MODE_HEADER = "x-mentor-mode";

/** The streaming media type: newline-delimited JSON, one event per line. */
export const MENTOR_STREAM_CONTENT_TYPE = "application/x-ndjson; charset=utf-8";

/**
 * Why a request fell back to the authored hint. Metadata only, logged and sent to the client so it
 * can show the authored text; it never carries learner text. `disabled` covers both the kill switch
 * and a missing API key, so the reason never reveals which.
 */
export type MentorFallbackReason =
  | "disabled"
  | "request_too_large"
  | "invalid_request"
  | "unknown_target"
  | "no_hints"
  | "model_error"
  | "validation_rejected"
  | "empty_output";

/**
 * One line of the NDJSON stream:
 *  - `text`: a chunk of Noor's rewritten hint, safe to show (it passed validation).
 *  - `fallback`: stop and show the authored tier text verbatim; anything shown so far is discarded.
 *  - `done`: the model finished and every chunk was released.
 */
export type MentorStreamEvent =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "fallback"; readonly reason: MentorFallbackReason }
  | { readonly type: "done" };

/** How the mentor answered: `model` is Noor's live rewrite, `fallback` the authored tier text. */
export type MentorMode = "model" | "fallback";

/** What a hint request resolves to: the mode, and the text the learner should end up seeing. */
export interface MentorHintResult {
  readonly mode: MentorMode;
  readonly text: string;
}

/** The learner gets a moment to try each hint before the next tier unlocks: 30 seconds. */
export const HINT_COOLDOWN_MS = 30_000;

/**
 * When the next tier unlocks, given when the current tier was shown. Pure, so the UI and its tests
 * agree. Tier 1 has no previous tier, so it is available immediately (no call to this).
 */
export function nextTierUnlockTime(currentTierShownAt: number): number {
  return currentTierShownAt + HINT_COOLDOWN_MS;
}

/** Whether the next tier can be shown yet, given when the current tier was shown and the time now. */
export function isNextTierUnlocked(currentTierShownAt: number, now: number): boolean {
  return now >= nextTierUnlockTime(currentTierShownAt);
}
