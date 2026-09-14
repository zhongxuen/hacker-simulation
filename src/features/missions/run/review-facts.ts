import type { Mission } from "@/content/schemas/mission";
import type { ReviewFacts } from "@/features/mentor";
import { listTools } from "@/sim";
import { runMinutes, type MissionRunState } from "./mission-run";

/** Every command the practice machines know, read once from the engine's registry. */
const KNOWN_COMMANDS = listTools().map((tool) => tool.name);

/**
 * The facts about a finished run that the mentor's post-mission review needs (md-files/10-ai-mentor.md,
 * prompt 10.4), gathered from the mission and the in-memory run: every main and bonus objective and
 * whether it was done, the secrets found (never the ones still hidden), hint tiers opened, the time
 * taken, every command line run, Reset machine presses, and the mission's lessons. Pure.
 */
export function reviewFactsFor(
  mission: Mission,
  run: MissionRunState,
  commandLines: readonly string[],
): ReviewFacts {
  const completed = new Set(run.completed);
  return {
    missionTitle: mission.title,
    objectives: mission.objectives
      .filter((objective) => !objective.hidden || completed.has(objective.id))
      .map((objective) => ({
        id: objective.id,
        description: objective.description,
        ...(objective.name !== undefined && { name: objective.name }),
        kind: objective.hidden ? "secret" : objective.optional ? "bonus" : "main",
        done: completed.has(objective.id),
        hintsOpened: run.hintsShown[objective.id] ?? 0,
      })),
    minutes: runMinutes(run),
    commandLines: commandLines.filter((line) => line.trim() !== ""),
    knownCommands: KNOWN_COMMANDS,
    resets: run.resets,
    lessonIds: [...new Set([...mission.concepts, ...mission.debrief.furtherReading])],
  };
}
