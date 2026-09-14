import type { Mission } from "@/content/schemas/mission";
import type { UsageEvent } from "@/lib/analytics";
import { isMissionComplete } from "../evaluate";
import type { MissionRunState } from "./mission-run";

/**
 * The anonymous usage counts one change to a run produces (md-files/11-testing-security-deployment.md,
 * prompt 11.4b; md-files/metrics.md). Pure: it compares the run before and after, so the counts
 * come from the same state the learner sees, and a test can check every one.
 *
 * Only ids leave: the mission's, an objective's, and a hint tier. Never a command, an answer, a
 * note, or how many tries something took.
 */
export function usageEventsBetween(
  mission: Mission,
  before: MissionRunState,
  after: MissionRunState,
): UsageEvent[] {
  if (after.attempt !== before.attempt) return [];
  const events: UsageEvent[] = [];
  const missionId = mission.id;

  if (before.phase === "briefing" && after.phase === "workspace") {
    events.push({ name: "Mission started", props: { mission: missionId } });
  }

  const ticked = new Set(before.completed);
  for (const objective of after.completed) {
    if (!ticked.has(objective)) {
      events.push({ name: "Objective ticked", props: { mission: missionId, objective } });
    }
  }

  for (const [objective, shown] of Object.entries(after.hintsShown)) {
    for (let tier = (before.hintsShown[objective] ?? 0) + 1; tier <= shown; tier += 1) {
      if (tier === 1 || tier === 2 || tier === 3) {
        events.push({ name: "Hint opened", props: { step: `${missionId}/${objective}`, tier } });
      }
    }
  }

  if (
    !isMissionComplete(mission, before.completed) &&
    isMissionComplete(mission, after.completed)
  ) {
    events.push({ name: "Mission completed", props: { mission: missionId } });
  }

  return events;
}
