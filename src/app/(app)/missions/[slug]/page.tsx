import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/shell/section-placeholder";
import { getMission, listMissions } from "@/features/missions/server";
import { FIRST_STEP } from "@/lib/next-step";

/**
 * Where "Start here" points (FIRST_STEP.href). It gets a page even before its mission file exists,
 * so the button never leads to a 404.
 */
const FIRST_MISSION_SLUG = "intro-01";

// Every mission page is built ahead of time from src/content/missions, so a malformed mission
// fails `next build`. Any other slug is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  const slugs = new Set([...listMissions().map((mission) => mission.slug), FIRST_MISSION_SLUG]);
  return [...slugs].map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/missions/[slug]">): Promise<Metadata> {
  const mission = getMission((await params).slug);
  return mission
    ? { title: mission.title, description: mission.hook }
    : { title: FIRST_STEP.title };
}

// The mission runner (briefing, terminal, objectives, debrief) arrives in prompt 06.4. Until then,
// a loaded mission shows its title and hook.
export default async function MissionPage({ params }: PageProps<"/missions/[slug]">) {
  const mission = getMission((await params).slug);

  if (mission) {
    return (
      <SectionPlaceholder
        headline={mission.title}
        status="We're still building the mission screen. Check back soon to play it."
      >
        <p>{mission.hook}</p>
        <p>It takes about {mission.estimatedMinutes} minutes.</p>
      </SectionPlaceholder>
    );
  }

  return (
    <SectionPlaceholder
      headline={FIRST_STEP.title}
      status="We're still building this mission. Check back soon to play it."
    >
      <p>
        Your first mission. You&apos;ll meet the team, learn the rules every good-guy hacker
        follows, and find out what you&apos;ll be working on. It takes about 8 minutes.
      </p>
    </SectionPlaceholder>
  );
}
