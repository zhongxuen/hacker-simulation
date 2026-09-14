import type { Mission } from "@/content/schemas/mission";
import type { Playthrough } from "@/content/schemas/playthrough";
import { playMission, type PlayResult } from "./play";

export interface PlaythroughCheck {
  readonly result: PlayResult;
  /** Every way the mission didn't do what the playthrough says, as lines an author can act on. */
  readonly problems: readonly string[];
}

/**
 * Plays a playthrough and checks it: each step's `ticks` and `accepted`, and the `expect` block at
 * the end. Pure, so tests and `pnpm mission:play` agree.
 */
export function verifyPlaythrough(mission: Mission, playthrough: Playthrough): PlaythroughCheck {
  const problems: string[] = [];
  const ids = new Set(mission.objectives.map((objective) => objective.id));
  const unknown = (where: string, id: string) => {
    if (!ids.has(id)) problems.push(`${where}: there's no objective "${id}" in ${mission.id}.`);
  };

  if (playthrough.mission !== mission.id) {
    problems.push(`The playthrough is for "${playthrough.mission}", not "${mission.id}".`);
  }

  const result = playMission(mission, playthrough.steps);
  playthrough.steps.forEach((step, index) => {
    const where = `steps[${index + 1}]${"run" in step ? ` (${step.run})` : ""}`;
    const played = result.steps[index];
    if (!played) return;
    if ("answer" in step) {
      unknown(where, step.objective);
      if (played.accepted !== step.accepted) {
        problems.push(
          `${where}: the answer "${step.answer}" was ${played.accepted ? "accepted" : "not accepted"}, but the playthrough expects it ${step.accepted ? "accepted" : "not accepted"}.`,
        );
      }
    }
    if (step.ticks) {
      for (const id of step.ticks) {
        unknown(where, id);
        if (!played.ticked.includes(id))
          problems.push(`${where}: expected it to tick "${id}", and it didn't.`);
      }
    }
  });

  if (playthrough.expect.complete && !result.complete) {
    const missing = mission.objectives
      .filter((objective) => !objective.optional && !result.run.completed.includes(objective.id))
      .map((objective) => objective.id);
    problems.push(
      `The mission didn't complete. Main objectives still open: ${missing.join(", ")}.`,
    );
  }
  if (!playthrough.expect.complete && result.complete) {
    problems.push("The mission completed, but the playthrough expects it not to.");
  }
  for (const id of playthrough.expect.objectives) {
    unknown("expect.objectives", id);
    if (!result.run.completed.includes(id))
      problems.push(`expect.objectives: "${id}" was never ticked.`);
  }

  return { result, problems };
}
