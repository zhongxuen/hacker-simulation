import { parse as parseYaml } from "yaml";
import {
  parseMission,
  toScenarioSpec,
  type Mission,
  type ObjectiveCheck,
} from "@/content/schemas/mission";
import { createInitialState, ScenarioError, type SimState } from "@/sim";

/** A mission file that can't be used, with a message that names the file and what to fix. */
export class MissionSourceError extends Error {
  constructor(
    readonly fileName: string,
    readonly problems: readonly string[],
  ) {
    super(`${fileName}:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
    this.name = "MissionSourceError";
  }
}

/** Mission files are YAML, named after the mission's id: `linux-01.yaml`. */
export const MISSION_FILE_EXTENSION = ".yaml";

/**
 * Reads one mission file and checks everything that file alone decides: the YAML, the schema,
 * that the id matches the file name, that the engine can build the scenario (reserved addresses,
 * file owners that exist, a session host with a filesystem…), and that objective checks point at
 * real hosts, users and flags in that scenario. Throws a MissionSourceError listing the problems.
 *
 * `fileName` is the file's base name. Checks that span missions (unique slugs, prerequisites)
 * belong to the catalog.
 */
export function parseMissionSource(source: string, fileName: string): Mission {
  let data: unknown;
  try {
    data = parseYaml(source.replace(/^﻿/, ""));
  } catch (error) {
    throw new MissionSourceError(fileName, [
      `The file isn't valid YAML: ${(error as Error).message}`,
    ]);
  }
  if (data === null || data === undefined) {
    throw new MissionSourceError(fileName, [
      "The file is empty. A mission file starts with its id, slug, version and title.",
    ]);
  }

  const result = parseMission(data);
  if (!result.success) throw new MissionSourceError(fileName, result.problems);
  const mission = result.mission;

  const expectedId = fileName.slice(0, -MISSION_FILE_EXTENSION.length);
  if (!fileName.endsWith(MISSION_FILE_EXTENSION) || mission.id !== expectedId) {
    throw new MissionSourceError(fileName, [
      `id is "${mission.id}", but the file is named ${fileName}. Name the file ${mission.id}${MISSION_FILE_EXTENSION}, or change the id to match.`,
    ]);
  }

  const state = buildScenario(mission, fileName);
  const problems = scenarioReferenceProblems(mission, state);
  if (problems.length > 0) throw new MissionSourceError(fileName, problems);
  return mission;
}

/** Builds the mission's starting state with the engine, turning its complaints into problems. */
function buildScenario(mission: Mission, fileName: string): SimState {
  try {
    return createInitialState(toScenarioSpec(mission), mission.scenario.seed);
  } catch (error) {
    if (!(error instanceof ScenarioError)) throw error;
    const context = error.message.split("\n")[0]?.replace(/:$/, "") ?? "";
    throw new MissionSourceError(
      fileName,
      error.problems.map((problem) => `scenario (${context}): ${problem}`),
    );
  }
}

/** Every check in `check`, nested ones included. */
function* checksIn(check: ObjectiveCheck): Generator<ObjectiveCheck> {
  yield check;
  if (check.kind === "all" || check.kind === "any") {
    for (const inner of check.of) yield* checksIn(inner);
  }
}

/**
 * Names in checks and beats that the scenario must define, so a typo fails here instead of an
 * objective that can never tick: fileState hosts (with a filesystem) and the users and groups they
 * name, and the `hostId` and `flagId` values events are matched on.
 */
function scenarioReferenceProblems(mission: Mission, state: SimState): string[] {
  const problems: string[] = [];
  const hostIds = new Set(Object.keys(state.network.hosts));
  const flagIds = new Set(state.flags.map((flag) => flag.id));

  const checkMatch = (where: string, match: Readonly<Record<string, unknown>> | undefined) => {
    const hostId = match?.hostId;
    if (typeof hostId === "string" && !hostIds.has(hostId)) {
      problems.push(`${where}: match.hostId "${hostId}" isn't a host in the scenario.`);
    }
    const flagId = match?.flagId;
    if (typeof flagId === "string" && !flagIds.has(flagId)) {
      problems.push(`${where}: match.flagId "${flagId}" isn't one of the scenario's flags.`);
    }
  };

  for (const objective of mission.objectives) {
    const where = `objectives[${objective.id}].check`;
    for (const check of checksIn(objective.check)) {
      if (check.kind === "event") checkMatch(where, check.match);
      if (check.kind !== "fileState") continue;

      const hostId = check.host ?? state.session.hostId;
      const machine = Object.hasOwn(state.machines, hostId) ? state.machines[hostId] : undefined;
      if (!machine) {
        problems.push(
          hostIds.has(hostId)
            ? `${where}: host "${hostId}" has no filesystem, so there are no files to check. Give it an fs, or check a file on another host.`
            : `${where}: host "${hostId}" isn't a host in the scenario.`,
        );
        continue;
      }
      const { predicate } = check;
      for (const field of ["owner", "readableBy", "notReadableBy"] as const) {
        const user = predicate[field];
        if (user !== undefined && !Object.hasOwn(machine.accounts.users, user)) {
          problems.push(`${where}: ${field} "${user}" isn't a user on ${hostId}.`);
        }
      }
      if (
        predicate.group !== undefined &&
        !Object.hasOwn(machine.accounts.groups, predicate.group)
      ) {
        problems.push(`${where}: group "${predicate.group}" isn't a group on ${hostId}.`);
      }
    }
  }

  mission.story.forEach((beat, index) => {
    if (typeof beat.on === "object" && "event" in beat.on) {
      checkMatch(`story[${index + 1}].on`, beat.on.match);
    }
  });
  return problems;
}
