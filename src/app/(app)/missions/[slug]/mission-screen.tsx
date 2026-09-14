"use client";

import { useState } from "react";
import { LeaveGuard } from "@/components/shell/leave-guard";
import { ShowMissionProgress } from "@/components/shell/mission-progress";
import type { Mission } from "@/content/schemas/mission";
import { MissionRunner, type MissionLinks, type MissionRunStatus } from "@/features/missions";

/**
 * Puts the mission runner in the app shell: its progress in the top bar once the run starts, and
 * "Leave this mission?" while a run is in progress.
 */
export function MissionScreen({ mission, links }: { mission: Mission; links: MissionLinks }) {
  const [status, setStatus] = useState<MissionRunStatus | null>(null);

  return (
    <>
      <MissionRunner key={mission.id} mission={mission} links={links} onStatusChange={setStatus} />
      {status && status.phase !== "briefing" && (
        <ShowMissionProgress done={status.done} total={status.total} />
      )}
      <LeaveGuard when={status?.inProgress ?? false} />
    </>
  );
}
