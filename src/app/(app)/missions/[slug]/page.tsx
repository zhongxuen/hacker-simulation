import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { bestAfter, chapterOf, MAIN_CAMPAIGN, nextMission } from "@/content/campaigns";
import type { Mission } from "@/content/schemas/mission";
import { getLesson } from "@/features/learning/server";
import type { LessonLink, MissionLink, MissionLinks, NextMissionLink } from "@/features/missions";
import {
  getMission,
  getMissionById,
  getMissionGraph,
  listMissions,
} from "@/features/missions/server";
import { MissionScreen } from "./mission-screen";

// Every mission page is built ahead of time from src/content/missions, so a malformed mission
// fails `next build`. Any other slug is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return listMissions().map((mission) => ({ slug: mission.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/missions/[slug]">): Promise<Metadata> {
  const mission = getMission((await params).slug);
  return mission ? { title: mission.title, description: mission.hook } : {};
}

const missionLink = (mission: Mission): MissionLink => ({
  slug: mission.slug,
  title: mission.title,
});

const lessonLinks = (ids: readonly string[]): LessonLink[] =>
  ids.flatMap((id) => {
    const lesson = getLesson(id);
    return lesson ? [{ id: lesson.id, title: lesson.title }] : [];
  });

/**
 * The mission to suggest next. In the campaign, that's chapter order, running on into the next
 * chapter (md-files/08-campaign-and-story.md). A mission outside the campaign suggests the first
 * mission that lists it as a prerequisite, or else the next one in catalog order.
 */
function nextLink(mission: Mission): NextMissionLink | null {
  const place = chapterOf(MAIN_CAMPAIGN, mission.id);
  if (place) {
    const next = nextMission(MAIN_CAMPAIGN, mission.id);
    const target = next && getMissionById(next.missionId);
    if (!next || !target) return null;
    return {
      ...missionLink(target),
      ...(next.startsChapter && {
        startsChapter: { number: next.chapterNumber, title: next.chapter.title },
      }),
    };
  }
  const [dependent] = getMissionGraph().dependentsOf(mission.id);
  const missions = listMissions();
  const target = dependent
    ? getMissionById(dependent)
    : missions[missions.findIndex((candidate) => candidate.id === mission.id) + 1];
  return target ? missionLink(target) : null;
}

/**
 * A mission: the page resolves everything the runner links to (Best after, lessons, its place in
 * the campaign, the next mission) from the mission's own data and the campaign, and the runner
 * does the rest in the browser.
 */
export default async function MissionPage({ params }: PageProps<"/missions/[slug]">) {
  const mission = getMission((await params).slug);
  if (!mission) notFound();

  const place = chapterOf(MAIN_CAMPAIGN, mission.id);
  const next = nextLink(mission);
  const links: MissionLinks = {
    bestAfter: bestAfter(mission.id, listMissions()).map(missionLink),
    concepts: lessonLinks(mission.concepts),
    furtherReading: lessonLinks(mission.debrief.furtherReading),
    ...(place && {
      chapter: { number: place.chapterNumber, title: place.chapter.title, episode: place.episode },
    }),
    next,
    ...(place &&
      !next &&
      MAIN_CAMPAIGN.upNext !== undefined && {
        campaignEnd: MAIN_CAMPAIGN.upNext,
      }),
  };

  return <MissionScreen mission={mission} links={links} />;
}
