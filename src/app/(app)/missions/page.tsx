import type { Metadata } from "next";
import { MissionList, summarizeMission } from "@/features/missions";
import { listMissions } from "@/features/missions/server";
import { getAppSection } from "@/lib/app-sections";
import { FIRST_STEP } from "@/lib/next-step";

export const metadata: Metadata = { title: getAppSection("missions").label };

/** The id of the mission "Start here" points at: the last part of its address. */
const START_HERE_ID = FIRST_STEP.href.split("/").at(-1) ?? "";

export default function MissionsPage() {
  const missions = listMissions();
  const titles = new Map(missions.map((mission) => [mission.id, mission.title]));

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        Short missions, one skill at a time
      </h1>
      <p className="mt-4 text-lg leading-8 text-secondary">
        A mission is a short story episode, 5 to 20 minutes long. You get a briefing, try something
        hands-on, and see right away whether it worked. Hints are free, and mistakes never cost you
        anything.
      </p>
      <div className="mt-8">
        <MissionList
          missions={missions.map((mission) => summarizeMission(mission, titles))}
          startHereId={START_HERE_ID}
        />
      </div>
    </div>
  );
}
