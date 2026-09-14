import { z } from "zod";
import {
  capTranscript,
  HINT_TRANSCRIPT_LIMITS,
  REVIEW_TRANSCRIPT_LIMITS,
  trimLine,
  trimOutput,
  type MentorTranscript,
} from "./transcript";
import type { ExplainSubject, HintTier } from "./protocol";

/**
 * The mentor requests, as they arrive from the browser (md-files/10-ai-mentor.md, prompts 10.1,
 * 10.3 and 10.4). Every one is untrusted — the schemas validate the shape and re-apply the transcript
 * caps here (a forged body only ever changes the sender's own answer), so the model never sees more
 * than the caps allow no matter what was posted.
 *
 * Authored content is never in a request: the server loads hints, objectives and glossary
 * definitions from the content itself, by id. A request only says which one is wanted.
 */

/** Ids are content ids (lowercase words and single hyphens); a generous max keeps abuse bounded. */
const idField = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, digits and single hyphens.");

/** A single command and its output, before the shared caps trim them. */
// Generous pre-cap bounds: honest terminal output can be long, and `capTranscript` (the transform
// below) trims to the real caps. The route's 16 KB body-size cap is the first line of defence.
const transcriptEntrySchema = z.strictObject({
  input: z.string().max(8_000),
  output: z.string().max(100_000),
});

/**
 * A transcript, capped defensively here as well as in the browser. Bounded to a sane count before
 * capping so a forged multi-megabyte array can't cost us a large parse; the body-size cap in the
 * route is the first line of defence.
 */
const transcriptSchema = (limits = HINT_TRANSCRIPT_LIMITS) =>
  z
    .array(transcriptEntrySchema)
    .max(200)
    .default([])
    .transform((entries): MentorTranscript => capTranscript(entries, limits));

// ---------------------------------------------------------------------------------------------
// Hints
// ---------------------------------------------------------------------------------------------

export const MentorHintRequestSchema = z.strictObject({
  missionId: idField,
  objectiveId: idField,
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  transcript: transcriptSchema(),
});

export type MentorHintRequest = z.output<typeof MentorHintRequestSchema>;

export interface MentorRequestParse {
  readonly ok: boolean;
  readonly request?: MentorHintRequest;
}

/** Validates and caps a parsed request body. On any problem `ok` is false and the client falls back. */
export function parseMentorHintRequest(data: unknown): MentorRequestParse {
  const result = MentorHintRequestSchema.safeParse(data);
  return result.success ? { ok: true, request: result.data } : { ok: false };
}

/** Narrows a validated tier to the shared `HintTier` type. */
export function asHintTier(tier: 1 | 2 | 3): HintTier {
  return tier;
}

// ---------------------------------------------------------------------------------------------
// "Explain this"
// ---------------------------------------------------------------------------------------------

/**
 * What the learner pointed at. Terminal text is capped like a transcript entry: one line of the
 * command, and at most the transcript's output caps of what it showed.
 */
const explainSubjectSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("output"),
    command: z
      .string()
      .max(8_000)
      .transform((command) => trimLine(command)),
    text: z
      .string()
      .max(100_000)
      .transform((text) => trimOutput(text)),
    scope: z.enum(["line", "output"]),
    error: z.boolean(),
  }),
  z.strictObject({ kind: z.literal("term"), termId: idField }),
]);

export const MentorExplainRequestSchema = z.strictObject({
  missionId: idField,
  /** The objective the learner is on, for context. Optional: the mission may be finished. */
  objectiveId: idField.optional(),
  subject: explainSubjectSchema,
  transcript: transcriptSchema(),
});

export type MentorExplainRequest = z.output<typeof MentorExplainRequestSchema> & {
  readonly subject: ExplainSubject;
};

export function parseMentorExplainRequest(
  data: unknown,
): { readonly ok: true; readonly request: MentorExplainRequest } | { readonly ok: false } {
  const result = MentorExplainRequestSchema.safeParse(data);
  return result.success ? { ok: true, request: result.data } : { ok: false };
}

// ---------------------------------------------------------------------------------------------
// The post-mission review
// ---------------------------------------------------------------------------------------------

/**
 * The run, as facts the server can check against the mission: which objectives were ticked (by
 * id), how many hint tiers were opened for each, the time taken, and Reset machine presses. The
 * objectives' words come from the mission content, never from here.
 */
export const MentorReviewRequestSchema = z.strictObject({
  missionId: idField,
  completed: z.array(idField).max(40),
  hintsOpened: z
    .record(idField, z.number().int().min(0).max(3))
    .refine((record) => Object.keys(record).length <= 40, "Too many objectives."),
  minutes: z
    .number()
    .min(0)
    .max(24 * 60)
    .nullable(),
  resets: z.number().int().min(0).max(1_000),
  commandCount: z.number().int().min(0).max(10_000),
  transcript: transcriptSchema(REVIEW_TRANSCRIPT_LIMITS),
});

export type MentorReviewRequest = z.output<typeof MentorReviewRequestSchema>;

export function parseMentorReviewRequest(
  data: unknown,
): { readonly ok: true; readonly request: MentorReviewRequest } | { readonly ok: false } {
  const result = MentorReviewRequestSchema.safeParse(data);
  return result.success ? { ok: true, request: result.data } : { ok: false };
}
