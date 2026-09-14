import * as z from "zod/mini";
import type { MentorMode } from "./protocol";

/**
 * The post-mission review (md-files/10-ai-mentor.md, prompt 10.4): Noor looks back at the run with
 * the learner. It leads with something they did well, describes their approach, names the steps that
 * went smoothly and any scenic routes, and points at lessons to try next. It is formative feedback,
 * never a grade, and never framed as weaknesses.
 *
 * This file is client-safe: the review's shape, the facts the debrief gathers about the run, the
 * "at a glance" lines, and the deterministic template the learner gets when the model is unavailable.
 * The server side (prompt, output checks) lives in review-prompt.ts and review-handler.ts.
 */

/** A lesson Noor suggests trying next, and why, in one sentence. `why` may be empty. */
export interface MentorReviewLesson {
  readonly lessonId: string;
  readonly why: string;
}

export interface MentorReview {
  /** Something specific the learner did well. Always first. */
  readonly wellDone: string;
  /** How they went about it, in a sentence or two. */
  readonly approach: string;
  /** Steps that went smoothly. */
  readonly efficientSteps: readonly string[];
  /** Scenic routes: steps that took a detour, framed as something worth knowing, not a mistake. */
  readonly detours: readonly string[];
  /** Lessons to try next, from the mission's own lessons. */
  readonly tryNext: readonly MentorReviewLesson[];
  /** One encouraging closing line. */
  readonly signOff: string;
}

export interface MentorReviewResult {
  readonly mode: MentorMode;
  readonly review: MentorReview;
}

/** How much of each part the learner sees, however much the model wrote. */
export const REVIEW_LIMITS = {
  textChars: 600,
  efficientSteps: 3,
  detours: 2,
  tryNext: 3,
} as const;

const reviewText = z.string().check(z.trim(), z.minLength(1), z.maxLength(REVIEW_LIMITS.textChars));

/**
 * The review's shape, checked on both sides: the server checks what the model wrote, and the
 * browser checks what the server sent. Anything that doesn't fit becomes the template review.
 *
 * Written with zod/mini, because the browser runs it: the full Zod build would add about 90 KB to
 * the mission pages (md-files/11-testing-security-deployment.md, prompt 11.3).
 */
export const MentorReviewSchema = z.object({
  wellDone: reviewText,
  approach: reviewText,
  efficientSteps: z.array(reviewText).check(z.maxLength(6)),
  detours: z.array(reviewText).check(z.maxLength(6)),
  tryNext: z
    .array(
      z.object({
        lessonId: z.string().check(z.trim(), z.minLength(1), z.maxLength(80)),
        why: z.string().check(z.trim(), z.maxLength(REVIEW_LIMITS.textChars)),
      }),
    )
    .check(z.maxLength(6)),
  signOff: reviewText,
});

// ---------------------------------------------------------------------------------------------
// The facts about a run
// ---------------------------------------------------------------------------------------------

/** One objective, as the review sees it. Secrets appear only once found. */
export interface ReviewObjectiveFact {
  readonly id: string;
  /** What the learner was asked to do, as the mission words it (backticks mark code). */
  readonly description: string;
  /** The playful name of a bonus objective or secret. */
  readonly name?: string;
  readonly kind: "main" | "bonus" | "secret";
  readonly done: boolean;
  /** Hint tiers opened for it. Hints are free: this is never a mark against anyone. */
  readonly hintsOpened: number;
}

/** Everything the debrief knows about the run, gathered by the missions feature. */
export interface ReviewFacts {
  readonly missionTitle: string;
  readonly objectives: readonly ReviewObjectiveFact[];
  /** From Start mission to the debrief, in minutes, or null when unknown. */
  readonly minutes: number | null;
  /** Every command line run in this attempt, oldest first. */
  readonly commandLines: readonly string[];
  /**
   * The commands the practice machine knows, so a typo (`sl`) is never listed as a command the
   * learner used. Leave out to list every word-shaped name.
   */
  readonly knownCommands?: readonly string[];
  /** Reset machine presses. */
  readonly resets: number;
  /** The mission's lessons: its concepts, then its further reading, without repeats. */
  readonly lessonIds: readonly string[];
}

/** One row of "Your run at a glance". `value` marks commands with backticks. */
export interface RunFactLine {
  readonly label: string;
  readonly value: string;
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

/** "`ls`, `cat` and `netscan`". */
function codeList(names: readonly string[]): string {
  const coded = names.map((name) => `\`${name}\``);
  if (coded.length <= 1) return coded.join("");
  return `${coded.slice(0, -1).join(", ")} and ${coded.at(-1)}`;
}

/** The most distinct command names listed, in the order they were first used. */
export const MAX_LISTED_COMMANDS = 6;

/**
 * The commands used, by name, in the order first used: `ls -la | grep x` counts `ls` and `grep`.
 * Only word-shaped names count, and with `known`, only commands the machine has, so a typo never
 * shows as a command the learner used.
 */
export function commandNames(lines: readonly string[], known?: readonly string[]): string[] {
  const names: string[] = [];
  for (const line of lines) {
    for (const segment of line.split(/\|\||&&|[|;]/)) {
      const name = segment.trim().split(/\s+/)[0] ?? "";
      if (!/^[a-z][\w.-]*$/i.test(name) || names.includes(name)) continue;
      if (known && !known.includes(name)) continue;
      names.push(name);
    }
  }
  return names;
}

function minutesText(minutes: number): string {
  if (minutes < 1) return "under a minute";
  const rounded = Math.round(minutes);
  return `about ${plural(rounded, "minute")}`;
}

/**
 * "Your run at a glance": objectives, time, hints opened and commands run, in plain words. Pure and
 * deterministic, so it shows the same with or without the model.
 */
export function runFactLines(facts: ReviewFacts): RunFactLine[] {
  const main = facts.objectives.filter((objective) => objective.kind === "main");
  const bonus = facts.objectives.filter((objective) => objective.kind === "bonus");
  const secretsFound = facts.objectives.filter(
    (objective) => objective.kind === "secret" && objective.done,
  );
  const hints = facts.objectives.reduce((sum, objective) => sum + objective.hintsOpened, 0);
  const names = commandNames(facts.commandLines, facts.knownCommands);
  const lines: RunFactLine[] = [
    {
      label: "Main objectives",
      value: `${main.filter((objective) => objective.done).length} of ${main.length} done`,
    },
  ];
  if (bonus.length > 0 || secretsFound.length > 0) {
    const parts: string[] = [];
    if (bonus.length > 0) {
      parts.push(`${bonus.filter((objective) => objective.done).length} of ${bonus.length} bonus`);
    }
    if (secretsFound.length > 0) parts.push(plural(secretsFound.length, "secret") + " found");
    lines.push({ label: "For the curious", value: parts.join(", ") });
  }
  if (facts.minutes !== null) lines.push({ label: "Time", value: minutesText(facts.minutes) });
  lines.push({
    label: "Hints opened",
    value: hints === 0 ? "none this time" : `${hints}, and they're always free`,
  });
  lines.push({
    label: "Commands run",
    value:
      facts.commandLines.length === 0
        ? "none: you worked it out in the team chat"
        : `${facts.commandLines.length}, using ${codeList(names.slice(0, MAX_LISTED_COMMANDS))}${
            names.length > MAX_LISTED_COMMANDS ? " and more" : ""
          }`,
  });
  return lines;
}

/**
 * The review written ahead of time, for when the model is unavailable, switched off or busy. It
 * still leads with what the learner did, in Noor's voice, and points at the mission's own lessons.
 * It never judges an approach it can't see, so it has no smooth steps or scenic routes.
 */
export function buildFallbackReview(facts: ReviewFacts): MentorReview {
  const main = facts.objectives.filter((objective) => objective.kind === "main");
  const doneMain = main.filter((objective) => objective.done).length;
  const extras = facts.objectives
    .filter((objective) => objective.kind !== "main" && objective.done && objective.name)
    .map((objective) => objective.name as string);
  const names = commandNames(facts.commandLines, facts.knownCommands);

  const wellDone = [
    doneMain === main.length
      ? `You finished every main objective in ${facts.missionTitle}.`
      : `You finished ${doneMain} of ${main.length} main objectives in ${facts.missionTitle}.`,
    extras.length > 0
      ? `You found ${extras.length === 1 ? "a bonus, too" : "some extras, too"}: ${extras.join(", ")}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const approach =
    facts.commandLines.length === 0
      ? "You worked this one out through the team chat, one decision at a time."
      : `You ran ${plural(facts.commandLines.length, "command")}, using ${codeList(
          names.slice(0, MAX_LISTED_COMMANDS),
        )}. Every command you tried taught you something about the machine, including the ones that didn't work the first time.`;

  return {
    wellDone,
    approach,
    efficientSteps: [],
    detours: [],
    tryNext: facts.lessonIds.slice(0, REVIEW_LIMITS.tryNext).map((lessonId) => ({
      lessonId,
      why: "",
    })),
    signOff:
      "Every mission you finish makes the next one make more sense. See you on the next one.",
  };
}
