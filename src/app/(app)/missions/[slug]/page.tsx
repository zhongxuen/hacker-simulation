import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Mission } from "@/content/schemas/mission";
import { getLesson } from "@/features/learning/server";
import type { LessonLink, MissionLink, MissionLinks } from "@/features/missions";
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
 * The mission to suggest next: the first one that lists this mission as its prerequisite, or
 * else the next one in catalog order. Phase 08's campaign will replace this with chapter order.
 */
function nextMission(mission: Mission): Mission | undefined {
  const [dependent] = getMissionGraph().dependentsOf(mission.id);
  if (dependent) return getMissionById(dependent);
  const missions = listMissions();
  return missions[missions.findIndex((candidate) => candidate.id === mission.id) + 1];
}

/**
 * A mission: the page resolves everything the runner links to (Best after, lessons, the next
 * mission) from the mission's own data, and the runner does the rest in the browser.
 */
export default async function MissionPage({ params }: PageProps<"/missions/[slug]">) {
  const mission = getMission((await params).slug);
  if (!mission) notFound();

  const next = nextMission(mission);
  const links: MissionLinks = {
    bestAfter: mission.prerequisites.flatMap((id) => {
      const prerequisite = getMissionById(id);
      return prerequisite ? [missionLink(prerequisite)] : [];
    }),
    concepts: lessonLinks(mission.concepts),
    furtherReading: lessonLinks(mission.debrief.furtherReading),
    next: next ? missionLink(next) : null,
  };

  return <MissionScreen mission={mission} links={links} />;
}
