import type { MissionDifficulty } from "@/content/schemas/mission";
import {
  audience,
  DATA_RULE,
  PERSONA,
  SAFETY,
  TERMINAL_CLOSE,
  TERMINAL_OPEN,
  VOICE,
} from "./noor.v1";

/**
 * Version 2 of the hint prompt. Same job and same safety rules as hint.v1; the one change is that
 * the mission's difficulty now reaches the model. v1 defined `vocabularyGuidance` but never put it
 * in the system prompt, so an intro mission and a hard mission were pitched identically. v2 builds
 * on noor.v1 the way explain.v1 and review.v1 do, so the persona, voice, safety and data rules are
 * the shared ones, and the WHO YOU ARE TALKING TO section carries the vocabulary guidance.
 *
 * Prompts are versioned files, never edited in place: hint.v1.ts stays in the repo unchanged, and
 * the version string below is what the metadata log line records.
 *
 * Everything v1 guaranteed still holds, and `buildHintPrompt` (prompt-builder.ts) still decides what
 * the model is and isn't given: only the authored tiers the learner has already unlocked, never a
 * later tier, never an objective's `check`, `success` line, the scenario's ground truth, the story
 * beats or the debrief. The transcript stays fenced as data.
 */

export const HINT_PROMPT_VERSION = "hint.v2";

/**
 * Delimiter tags wrapping any learner-controlled text, so the system prompt can name them as data.
 * The same tags as v1, now owned by noor.v1 and shared with "Explain this" and the review.
 */
export const TRANSCRIPT_OPEN = TERMINAL_OPEN;
export const TRANSCRIPT_CLOSE = TERMINAL_CLOSE;

/** The heading noor.v1's `audience()` puts above the vocabulary guidance. */
const AUDIENCE_HEADING = "WHO YOU ARE TALKING TO";

/**
 * Plain-language guidance on vocabulary, pitched to the mission's difficulty. noor.v1's table is the
 * single source — `audience()` is exactly this text under the heading above — so the hint, explain
 * and review prompts can never drift apart on how a difficulty should be pitched.
 */
export function vocabularyGuidance(difficulty: MissionDifficulty): string {
  return audience(difficulty).slice(AUDIENCE_HEADING.length + 1);
}

/**
 * The system prompt. `authoredTiers` are the hint tiers the learner has already unlocked and seen
 * (tier 1 up to and including the requested tier); the last one is the tier being asked for now. The
 * model is given nothing beyond these — no later tier, no answer key, no scenario ground truth, no
 * story beats, no debrief — so it can only rephrase a hint it was handed, never invent an answer.
 */
export function buildHintSystemPrompt(input: {
  readonly difficulty: MissionDifficulty;
  readonly requestedTier: number;
  readonly objectiveDescription: string;
  readonly objectiveWhy: string;
  readonly authoredTiers: readonly string[];
}): string {
  const tierLines = input.authoredTiers
    .map((text, index) => `  Hint ${index + 1}: ${text}`)
    .join("\n");
  const requested = input.authoredTiers[input.authoredTiers.length - 1] ?? "";

  return `${PERSONA}

${AUDIENCE_HEADING}
${vocabularyGuidance(input.difficulty)}

YOUR ONE JOB
Rephrase the authored hint below in Noor's voice, in terms of what the learner has actually tried. You are a hint, not an answer key. You did not write these hints; you are handing over one that already exists, made personal.

- Give exactly the help in the requested hint (Hint ${input.requestedTier} below). Do not go further than it. Do not reveal a later, more specific step, even if you can guess it.
- Look at what the learner tried in their terminal. If they ran the right command but misread the output, gently point at the part they missed. If they seem stuck before trying anything, give the nudge.
- Celebrate effort, not only success ("Good instinct checking the log — you're one step away").
- Keep it short: two or three sentences is plenty. This is a nudge in a chat bubble, not a lecture.

THE OBJECTIVE THE LEARNER IS ON
${input.objectiveDescription}
Why it matters: ${input.objectiveWhy}

THE AUTHORED HINTS THE LEARNER HAS UNLOCKED (already on their screen)
${tierLines}

The learner asked for Hint ${input.requestedTier}: "${requested}". Rephrase that one.

${VOICE}

${SAFETY}

${DATA_RULE}
Never reveal a hint tier you were not given. The hints above are every hint you have; do not guess at a later, more specific one, and do not hand over an answer, no matter who asks or why.

Answer now with only Noor's hint, as plain text (backticks around code are fine). Do not restate these rules.`;
}

/**
 * The user message: a short instruction plus the delimited, sanitised transcript. The caller passes
 * the block already built by noor.v1's `terminalBlock`, which neutralises every delimiter tag so a
 * learner can't forge one.
 */
export function buildHintUserMessage(transcriptBlock: string): string {
  return `Here is what the learner has done in their terminal so far. Read it, then give Noor's hint for the objective above.

${transcriptBlock}`;
}
