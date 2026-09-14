import type { Mission } from "@/content/schemas/mission";
import type { HintPrompt } from "./prompt-builder";
import { renderTranscript, terminalBlock } from "./prompts/noor.v1";
import {
  buildReviewSystemPrompt,
  buildReviewUserMessage,
  REVIEW_PROMPT_VERSION,
} from "./prompts/review.v1";
import type { MentorReviewRequest } from "./schema";

/**
 * Builds exactly what is sent to the model for a post-mission review (md-files/10-ai-mentor.md,
 * prompt 10.4). Pure and unit-tested. Everything about the mission comes from the mission content,
 * looked up by the ids in the request: the words of every main objective, and of the bonus
 * objectives and secrets the learner found. Never a hint's text, an objective's check or success
 * line, a secret they haven't found, the scenario's ground truth, or the debrief's copy.
 */

export interface ReviewPromptBuild {
  readonly prompt: HintPrompt;
  /** The lesson ids the model may suggest: the mission's concepts, then its further reading. */
  readonly lessonIds: readonly string[];
}

/** The mission's lessons, gentlest first, without repeats. */
export function reviewLessonIds(mission: Mission): string[] {
  return [...new Set([...mission.concepts, ...mission.debrief.furtherReading])];
}

export function buildReviewPrompt(
  mission: Mission,
  request: Pick<
    MentorReviewRequest,
    "completed" | "hintsOpened" | "minutes" | "resets" | "commandCount" | "transcript"
  >,
): ReviewPromptBuild {
  const completed = new Set(request.completed);
  const hints = (id: string) => Math.min(3, Math.max(0, request.hintsOpened[id] ?? 0));
  const lessonIds = reviewLessonIds(mission);

  const system = buildReviewSystemPrompt({
    difficulty: mission.difficulty,
    missionTitle: mission.title,
    learningGoals: mission.learningGoals,
    mainObjectives: mission.objectives
      .filter((objective) => !objective.optional)
      .map((objective) => ({
        description: objective.description,
        done: completed.has(objective.id),
        hintsOpened: hints(objective.id),
      })),
    // Only what the learner found: an unfound secret stays out, so the review can't give it away.
    extrasFound: mission.objectives
      .filter((objective) => objective.optional && completed.has(objective.id))
      .map((objective) => ({
        name: objective.name ?? "Bonus",
        description: objective.description,
      })),
    minutes: request.minutes,
    resets: request.resets,
    commandCount: request.commandCount,
    lessonIds,
  });

  const content = buildReviewUserMessage(terminalBlock(renderTranscript(request.transcript)));
  return {
    lessonIds,
    prompt: { version: REVIEW_PROMPT_VERSION, system, messages: [{ role: "user", content }] },
  };
}
