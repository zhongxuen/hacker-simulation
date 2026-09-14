import type { ScenarioSpec } from "@/sim/types";
import type { Mission } from "./mission";

/**
 * The small, Zod-free parts of the mission schema that the browser needs at runtime: the mission
 * runner, the answer box and the mission list import these (md-files/11-testing-security-deployment.md,
 * prompt 11.3). Importing them from here, rather than from mission.ts, keeps the full Zod build
 * (about 90 KB gzipped) out of the pages that play a mission. mission.ts re-exports all of them,
 * so server code and tests can keep importing from there.
 */

export const MISSION_DIFFICULTIES = ["intro", "easy", "medium", "hard"] as const;

export type MissionDifficulty = (typeof MISSION_DIFFICULTIES)[number];

/** Answers compare trimmed, case-insensitive, with any run of spaces counted as one space. */
export function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * The engine's ScenarioSpec for a mission: its scenario without the seed, with the mission id as
 * the scenario id unless it sets its own. Build the starting state with
 * `createInitialState(toScenarioSpec(mission), mission.scenario.seed)`.
 *
 * The return type is also the compile-time proof that the mission schema still matches the
 * engine's ScenarioSpec: if the engine's spec changes shape, this stops compiling.
 */
export function toScenarioSpec(mission: Pick<Mission, "id" | "scenario">): ScenarioSpec {
  const { id, seed, ...spec } = mission.scenario;
  void seed; // the seed goes to createInitialState, not into the spec
  return { ...spec, id: id ?? mission.id };
}
