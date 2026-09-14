import { z } from "zod";
import { ContentIdSchema } from "./ids";

/**
 * A playthrough: a mission played from a script instead of by a person, for regression-testing
 * mission content (md-files/06-mission-system.md, prompt 06.6). One YAML file per mission in
 * src/content/missions/playthroughs, named after the mission: `net-01.yaml`.
 *
 * `pnpm mission:play <slug>` runs it and prints the transcript; tests/unit/mission-playthroughs
 * runs every one in CI and fails if a mission stops completing, or a step stops doing what the
 * playthrough says it does.
 */

const text = (what: string) =>
  z
    .string({
      error: (issue) => (issue.input === undefined ? `Missing: add ${what}.` : "Should be text."),
    })
    .trim()
    .min(1, `Can't be empty: add ${what}.`);

const RunStepSchema = z.strictObject({
  /** A command line, typed as the learner would. */
  run: text("the command line to type"),
  /** Objective ids this step should tick. Checked when given. */
  ticks: z.array(ContentIdSchema).optional(),
});

const AnswerStepSchema = z.strictObject({
  /** The answer to submit: typed text, or a choice's text exactly as written. */
  answer: text("the answer"),
  objective: ContentIdSchema,
  /** Whether it should be accepted. Defaults to true. */
  accepted: z.boolean().default(true),
  ticks: z.array(ContentIdSchema).optional(),
});

const ResetStepSchema = z.strictObject({
  /** Press Reset machine. */
  reset: z.literal(true),
  ticks: z.array(ContentIdSchema).optional(),
});

export const PlaythroughStepSchema = z.union([RunStepSchema, AnswerStepSchema, ResetStepSchema], {
  error:
    "Each step is one of: run: <command>, answer: <text> with objective: <id>, or reset: true.",
});

export const PlaythroughSchema = z.strictObject({
  /** The mission's id. Must match the file name. */
  mission: ContentIdSchema,
  /** A line on what this playthrough shows: "The shortest way through, then both secrets." */
  description: text("a line on what this playthrough shows").optional(),
  steps: z.array(PlaythroughStepSchema).min(1, "Add at least one step."),
  expect: z
    .strictObject({
      /** Every main objective ticked by the end. Defaults to true. */
      complete: z.boolean().default(true),
      /** Objectives that must be ticked by the end, bonus and secrets included. */
      objectives: z.array(ContentIdSchema).default([]),
    })
    .default({ complete: true, objectives: [] }),
});

export type PlaythroughStep = z.output<typeof PlaythroughStepSchema>;
export type Playthrough = z.output<typeof PlaythroughSchema>;
