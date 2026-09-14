import { z } from "zod";
import { CAST_IDS } from "../cast";
import { ContentIdSchema, uniqueIds } from "./ids";

/**
 * The campaign schema (md-files/08-campaign-and-story.md, "Campaign as data" and prompt 08.1).
 *
 * A campaign is a recommended path through the missions, told as a story: chapters, each with its
 * framing and its missions in order. It is never a gate. Nothing is saved
 * (md-files/03-app-state-and-privacy.md), so there are no unlock rules, no completed states and no
 * locks: every mission is open from the start, and the order only decides where "Start here" and
 * "Next mission" point.
 *
 * Whether each mission id names a real mission is checked across the catalog by
 * `campaignProblems` (src/content/campaigns), run in tests/unit/campaigns.test.ts, because content
 * can't read the mission files itself.
 */

const text = (what: string) =>
  z
    .string({ error: `Add ${what}.` })
    .trim()
    .min(1, `Can't be empty: add ${what}.`);

/** A line said by someone from the story bible's cast (md-files/story-bible.md). */
export const CampaignLineSchema = z.strictObject({
  speaker: z.enum(CAST_IDS, {
    error: `Use a speaker from the cast: ${CAST_IDS.join(", ")} (see md-files/story-bible.md).`,
  }),
  text: text("what the character says"),
});

export type CampaignLine = z.output<typeof CampaignLineSchema>;

export const ChapterSchema = z.strictObject({
  /** Stable and never reused: `first-shift`. */
  id: ContentIdSchema,
  /** "First shift". Shown as "Chapter 1: First shift". */
  title: text("the chapter's title").max(60),
  /** The story framing before the chapter's missions, in the second person, two sentences or so. */
  narrative: text("the narrative: the chapter's story framing"),
  /** The cast voicing the chapter's setup, one to three lines, shown as speech bubbles. */
  lines: z.array(CampaignLineSchema).min(1, "Add at least one line.").max(3, "Keep it to 3 lines."),
  /** Mission ids, in the recommended order. */
  missions: uniqueIds(ContentIdSchema).min(1, "Add at least one mission."),
  /** A line after the chapter's last mission that leads into what comes next. */
  closing: CampaignLineSchema.optional(),
});

export type Chapter = z.output<typeof ChapterSchema>;

export const CampaignSchema = z
  .strictObject({
    id: ContentIdSchema,
    title: text("the campaign's title").max(80),
    /** One or two sentences under the title on the campaign map. */
    description: text("a description"),
    chapters: z.array(ChapterSchema).min(1, "Add at least one chapter."),
    /** Shown after the last chapter: what's coming, and an invitation to replay. */
    upNext: text("what's coming next").optional(),
  })
  .superRefine((campaign, ctx) => {
    const chapterIds = new Set<string>();
    const placed = new Map<string, string>();
    campaign.chapters.forEach((chapter, index) => {
      if (chapterIds.has(chapter.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["chapters", index, "id"],
          message: `Two chapters have the id "${chapter.id}".`,
        });
      }
      chapterIds.add(chapter.id);
      for (const missionId of chapter.missions) {
        const other = placed.get(missionId);
        if (other !== undefined) {
          ctx.addIssue({
            code: "custom",
            path: ["chapters", index, "missions"],
            message: `"${missionId}" is already in chapter "${other}". A mission belongs to one chapter.`,
          });
        }
        placed.set(missionId, chapter.id);
      }
    });
  });

export type CampaignInput = z.input<typeof CampaignSchema>;
export type Campaign = z.output<typeof CampaignSchema>;
