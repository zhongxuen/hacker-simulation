import { z } from "zod";
import { capTranscript, type MentorTranscript } from "./transcript";
import type { HintTier } from "./protocol";

/**
 * The mentor hint request, as it arrives from the browser (md-files/10-ai-mentor.md, prompt 10.1):
 * `{ missionId, objectiveId, tier, transcript }`. It is untrusted — the schema validates the shape
 * and re-applies the transcript caps here (a forged body only ever changes the sender's own hint),
 * so the model never sees more than the caps allow no matter what was posted.
 *
 * The authored hint text is never in the request: the server loads it from the mission content by
 * `(missionId, objectiveId, tier)`. The request only says which hint is wanted.
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

export const MentorHintRequestSchema = z.strictObject({
  missionId: idField,
  objectiveId: idField,
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /**
   * Capped defensively here as well as in the browser. Bounded to a sane count before capping so a
   * forged multi-megabyte array can't cost us a large parse; the body-size cap in the route is the
   * first line of defence.
   */
  transcript: z
    .array(transcriptEntrySchema)
    .max(200)
    .default([])
    .transform((entries): MentorTranscript => capTranscript(entries)),
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
