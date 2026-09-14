import type { MissionDifficulty } from "@/content/schemas/mission";
import { REVIEW_LIMITS } from "../review";
import { audience, DATA_RULE, PERSONA, SAFETY, TERMINAL_OPEN, VOICE } from "./noor.v1";

/**
 * Version 1 of the post-mission review prompt (md-files/10-ai-mentor.md, prompt 10.4). Noor reads the
 * run and writes formative feedback: what went well (first, and specific), the approach, the smooth
 * steps, any scenic routes, and lessons to try next. Filled by `buildReviewPrompt`, which gives the
 * model only what the learner has already seen: the objectives they ticked, bonus objectives and
 * secrets they found, the mission's learning goals, and the lesson ids it may suggest. Never a hint's
 * text, an objective's check, a secret they haven't found, or the scenario's ground truth.
 *
 * The answer is JSON, constrained by REVIEW_JSON_SCHEMA (structured outputs) and checked again on
 * the server before anything reaches the browser.
 */
export const REVIEW_PROMPT_VERSION = "review.v1";

/**
 * The JSON schema the review must follow. Structured outputs need every object closed
 * (`additionalProperties: false`) and every property required; lengths are enforced on the server.
 */
export const REVIEW_JSON_SCHEMA: Readonly<Record<string, unknown>> = {
  type: "object",
  properties: {
    wellDone: { type: "string" },
    approach: { type: "string" },
    efficientSteps: { type: "array", items: { type: "string" } },
    detours: { type: "array", items: { type: "string" } },
    tryNext: {
      type: "array",
      items: {
        type: "object",
        properties: { lessonId: { type: "string" }, why: { type: "string" } },
        required: ["lessonId", "why"],
        additionalProperties: false,
      },
    },
    signOff: { type: "string" },
  },
  required: ["wellDone", "approach", "efficientSteps", "detours", "tryNext", "signOff"],
  additionalProperties: false,
};

export interface ReviewPromptInput {
  readonly difficulty: MissionDifficulty;
  readonly missionTitle: string;
  readonly learningGoals: readonly string[];
  /** Main objectives, in order, with whether each was done and hint tiers opened. */
  readonly mainObjectives: readonly {
    readonly description: string;
    readonly done: boolean;
    readonly hintsOpened: number;
  }[];
  /** Bonus objectives and secrets the learner found (never ones they haven't). */
  readonly extrasFound: readonly { readonly name: string; readonly description: string }[];
  readonly minutes: number | null;
  readonly resets: number;
  readonly commandCount: number;
  /** Lesson ids Noor may suggest, gentlest first. */
  readonly lessonIds: readonly string[];
}

function objectiveLines(input: ReviewPromptInput): string {
  return input.mainObjectives
    .map(
      (objective, index) =>
        `  ${index + 1}. ${objective.description} (${objective.done ? "done" : "not done"}; hints opened: ${objective.hintsOpened})`,
    )
    .join("\n");
}

export function buildReviewSystemPrompt(input: ReviewPromptInput): string {
  const extras =
    input.extrasFound.length === 0
      ? "  (none)"
      : input.extrasFound.map((extra) => `  - ${extra.name}: ${extra.description}`).join("\n");
  const minutes =
    input.minutes === null ? "unknown" : `about ${Math.max(1, Math.round(input.minutes))}`;

  return `${PERSONA}

${audience(input.difficulty)}

YOUR ONE JOB
The learner has finished the mission "${input.missionTitle}". Look back at their run with them and write a short, warm review. This is formative feedback from a mentor, never a grade, a score, or a list of weaknesses.

WHAT THE MISSION TEACHES
${input.learningGoals.map((goal) => `  - ${goal}`).join("\n")}

THE MAIN OBJECTIVES
${objectiveLines(input)}

BONUS OBJECTIVES AND SECRETS THEY FOUND
${extras}

THE RUN
  Minutes: ${minutes}. Commands run: ${input.commandCount}. Times they reset the practice machine: ${input.resets}.
  Their commands and what the computer showed are in the ${TERMINAL_OPEN} block (the most recent ones, with only the start of each output).

LESSONS YOU MAY SUGGEST (use these ids exactly, and no others)
${input.lessonIds.map((id) => `  - ${id}`).join("\n")}

HOW TO WRITE IT
- wellDone: one or two sentences on something specific they did well, taken from their run. Name the actual thing ("You checked the permissions with \`ls -l\` before changing anything"), never a generic "great job". This always comes first.
- approach: one or two sentences describing how they went about the mission, in order.
- efficientSteps: up to ${REVIEW_LIMITS.efficientSteps} short sentences naming steps that went smoothly.
- detours: up to ${REVIEW_LIMITS.detours} short sentences on scenic routes: steps that took longer than they needed to, framed as something worth knowing for next time ("\`ls -a\` would have shown the hidden file straight away"), never as a mistake. An empty list is fine. A command that printed an error is normal practice, not a detour worth mentioning, unless there's a genuinely useful tip in it.
- tryNext: one to ${REVIEW_LIMITS.tryNext} lessons from the list above, each with one sentence on why it's a good next step after this run. Frame them as "try next", never as fixing a weakness.
- signOff: one short, encouraging closing line in Noor's voice.
- Hints are free and using them is smart. Never treat hints opened, errors, resets or time as a bad thing, and never praise someone for not using hints.
- Never mention speed as an achievement, and never compare them to anyone.

${VOICE}

${SAFETY}

${DATA_RULE}

Answer with only the JSON object.`;
}

export function buildReviewUserMessage(terminal: string): string {
  return `Here is the learner's run in the terminal. Read it, then write Noor's review.

${terminal}`;
}
