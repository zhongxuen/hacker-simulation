import type { Campaign, Chapter } from "../schemas/campaign";
import { MAIN_CAMPAIGN } from "./main";

/**
 * Campaigns and the pure helpers that read them (md-files/08-campaign-and-story.md, prompt 08.1).
 * There are no unlock rules anywhere: the order decides where "Start here" and "Next mission"
 * point, and nothing else.
 */

export { MAIN_CAMPAIGN };

export const CAMPAIGNS: readonly Campaign[] = [MAIN_CAMPAIGN];

/** Every mission in the campaign, in the recommended order, across chapters. */
export function campaignMissionIds(campaign: Campaign): string[] {
  return campaign.chapters.flatMap((chapter) => chapter.missions);
}

/** The mission a newcomer should play first: the first mission of the first chapter. */
export function startHereMissionId(campaign: Campaign): string {
  const first = campaign.chapters[0]?.missions[0];
  if (first === undefined) throw new Error(`Campaign "${campaign.id}" has no missions.`);
  return first;
}

export interface ChapterPlace {
  readonly chapter: Chapter;
  /** Counting from 1, as the learner reads it: "Chapter 1". */
  readonly chapterNumber: number;
  /** The mission's place in its chapter, counting from 1: "Episode 2". */
  readonly episode: number;
}

/** Where a mission sits in the campaign, or undefined if it isn't in it. */
export function chapterOf(campaign: Campaign, missionId: string): ChapterPlace | undefined {
  for (const [index, chapter] of campaign.chapters.entries()) {
    const position = chapter.missions.indexOf(missionId);
    if (position !== -1) return { chapter, chapterNumber: index + 1, episode: position + 1 };
  }
  return undefined;
}

export interface NextMission extends ChapterPlace {
  readonly missionId: string;
  /** The next mission opens a new chapter: the debrief says so. */
  readonly startsChapter: boolean;
}

/**
 * The mission to play after `missionId`, following chapter order: the next one in its chapter, or
 * the first mission of the next chapter after a chapter's last. Undefined after the campaign's
 * last mission, or for a mission that isn't in the campaign.
 */
export function nextMission(campaign: Campaign, missionId: string): NextMission | undefined {
  const order = campaignMissionIds(campaign);
  const index = order.indexOf(missionId);
  const next = index === -1 ? undefined : order[index + 1];
  if (next === undefined) return undefined;
  const place = chapterOf(campaign, next);
  if (!place) return undefined;
  return { missionId: next, ...place, startsChapter: place.episode === 1 };
}

interface WithPrerequisites {
  readonly id: string;
  readonly prerequisites: readonly string[];
}

/**
 * "Best after: …" for a mission: the missions its `prerequisites` name, in the order written,
 * skipping any id that isn't in `missions`. A suggestion shown on the briefing, never a lock.
 */
export function bestAfter<M extends WithPrerequisites>(
  missionId: string,
  missions: readonly M[],
): M[] {
  const byId = new Map(missions.map((mission) => [mission.id, mission]));
  return (byId.get(missionId)?.prerequisites ?? []).flatMap((id) => {
    const prerequisite = byId.get(id);
    return prerequisite ? [prerequisite] : [];
  });
}

/**
 * Everything wrong with a campaign that the schema can't see on its own: mission ids that don't
 * name a real mission. One line per problem, empty when all is well.
 */
export function campaignProblems(campaign: Campaign, missionIds: Iterable<string>): string[] {
  const known = new Set(missionIds);
  return campaign.chapters.flatMap((chapter) =>
    chapter.missions
      .filter((id) => !known.has(id))
      .map(
        (id) =>
          `campaign ${campaign.id} → chapter ${chapter.id}: there's no mission with the id "${id}".`,
      ),
  );
}
