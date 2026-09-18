import type { Mission } from "@/content/schemas/mission";
import type { HintTier } from "./protocol";
import { renderTranscript, terminalBlock } from "./prompts/noor.v1";
import {
  buildHintSystemPrompt,
  buildHintUserMessage,
  HINT_PROMPT_VERSION,
  TRANSCRIPT_CLOSE,
  TRANSCRIPT_OPEN,
} from "./prompts/hint.v2";
import type { MentorTranscript } from "./transcript";

/**
 * Builds exactly what is sent to the model for one hint request (md-files/10-ai-mentor.md, prompts
 * 10.1 and 10.2). Pure and unit-tested: the tests assert what is present (the requested tier, the
 * objective's description and why) and, just as importantly, what is absent — the objective's
 * `check` (answers, choices, file predicates, command patterns), its `success` line, any tier after
 * the requested one, other objectives' hints, the scenario ground truth, the story beats, and the
 * debrief.
 *
 * EARLIER TIERS ARE INCLUDED, LATER TIERS ARE NOT. Tiers 1..tier are given, because the learner has
 * already unlocked and seen every one of them on their own screen (tiers unlock in order), so
 * including them discloses nothing new and lets Noor build on the nudge instead of repeating it.
 * Tier+1..3 are never included: that is the structural guarantee that the model cannot hand over a
 * hint the learner has not earned, even under prompt injection.
 */

export interface HintPrompt {
  readonly version: string;
  readonly system: string;
  readonly messages: readonly { readonly role: "user"; readonly content: string }[];
}

/** The reason `buildHintPrompt` can't build a prompt, so the caller falls back instead. */
export type PromptProblem = "unknown_objective" | "no_hints";

export type BuildHintPromptResult =
  | { readonly ok: true; readonly prompt: HintPrompt; readonly authoredTier: string }
  | { readonly ok: false; readonly problem: PromptProblem };

/**
 * Builds the prompt for `(mission, objectiveId, tier)`. Returns the authored tier text alongside, so
 * the caller has the exact string the client will fall back to. Fails (for a graceful fallback) when
 * the objective is unknown or hidden (hidden objectives ship no hints).
 */
export function buildHintPrompt(
  mission: Mission,
  objectiveId: string,
  tier: HintTier,
  transcript: MentorTranscript,
): BuildHintPromptResult {
  const objective = mission.objectives.find((candidate) => candidate.id === objectiveId);
  if (!objective || objective.hidden) return { ok: false, problem: "unknown_objective" };

  const tiers = mission.hints[objectiveId];
  if (!tiers) return { ok: false, problem: "no_hints" };

  // Only the tiers the learner has unlocked: index 0..tier-1. A later tier is never read.
  const unlocked = tiers.slice(0, tier);
  const authoredTier = unlocked[tier - 1];
  if (authoredTier === undefined) return { ok: false, problem: "no_hints" };

  const system = buildHintSystemPrompt({
    difficulty: mission.difficulty,
    requestedTier: tier,
    objectiveDescription: objective.description,
    objectiveWhy: objective.why,
    authoredTiers: unlocked,
  });

  // `terminalBlock` renders the transcript into the delimited data block and neutralises every
  // delimiter tag inside it, so a learner cannot forge a closing tag and "escape" the block.
  const content = buildHintUserMessage(terminalBlock(renderTranscript(transcript)));

  return {
    ok: true,
    authoredTier,
    prompt: { version: HINT_PROMPT_VERSION, system, messages: [{ role: "user", content }] },
  };
}

export { HINT_PROMPT_VERSION, TRANSCRIPT_OPEN, TRANSCRIPT_CLOSE };
