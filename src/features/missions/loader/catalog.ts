import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildPrerequisiteGraph, type PrerequisiteGraph } from "@/content/lesson-graph";
import {
  MISSION_DIFFICULTIES,
  type Mission,
  type MissionDifficulty,
} from "@/content/schemas/mission";
import type { Skill } from "@/content/skills";
import { MISSION_FILE_EXTENSION, MissionSourceError, parseMissionSource } from "./source";

/**
 * The mission catalog (md-files/06-mission-system.md, prompt 06.2): every mission file in
 * src/content/missions. There is no database: the content files are the whole catalog.
 *
 * Server only: it reads the files with Node's fs. Mission pages are generated at build time, so a
 * malformed mission fails `next build` (and `pnpm test`) with a MissionSourceError that names the
 * file and every problem in it.
 */

/** Where mission files live, relative to the project root. */
export const MISSIONS_DIR = join(process.cwd(), "src", "content", "missions");

export interface MissionFile {
  readonly fileName: string;
  readonly mission: Mission;
}

export interface MissionCatalog {
  /**
   * Every mission in display order: by difficulty (intro, easy, medium, hard), then each mission
   * after its prerequisites, then by title.
   */
  readonly missions: readonly Mission[];
  /** Which missions are best played before which: for "Best after" suggestions, never locking. */
  readonly graph: PrerequisiteGraph;
  getMission(slug: string): Mission | undefined;
  getMissionById(id: string): Mission | undefined;
  /** Missions matching `filter`, in catalog order. */
  listMissions(filter?: MissionFilter): readonly Mission[];
}

export interface MissionFilter {
  /** Missions that practise this skill. */
  skill?: Skill;
  difficulty?: MissionDifficulty;
}

/**
 * Checks what no single file can: ids and slugs are unique, prerequisites name real missions and
 * don't loop. Throws a MissionSourceError for the first file with a problem.
 */
export function buildMissionCatalog(files: readonly MissionFile[]): MissionCatalog {
  const problems = new Map<string, string[]>();
  const report = (fileName: string, problem: string) =>
    problems.set(fileName, [...(problems.get(fileName) ?? []), problem]);

  const byId = new Map<string, MissionFile>();
  const bySlug = new Map<string, MissionFile>();
  for (const file of files) {
    const { id, slug } = file.mission;
    const sameId = byId.get(id);
    if (sameId) {
      report(
        file.fileName,
        `id "${id}" is also used by ${sameId.fileName}. Mission ids are unique and never reused.`,
      );
    } else byId.set(id, file);
    const sameSlug = bySlug.get(slug);
    if (sameSlug) {
      report(
        file.fileName,
        `slug "${slug}" is also used by ${sameSlug.fileName}. Each mission needs its own address.`,
      );
    } else bySlug.set(slug, file);
  }

  for (const { fileName, mission } of files) {
    for (const prerequisite of mission.prerequisites) {
      if (!byId.has(prerequisite)) {
        report(fileName, `prerequisites: there's no mission with the id "${prerequisite}".`);
      }
    }
  }

  const rank = (mission: Mission) => MISSION_DIFFICULTIES.indexOf(mission.difficulty);
  const sorted = [...byId.values()]
    .map((file) => file.mission)
    .sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title, "en"));
  const graph = buildPrerequisiteGraph(sorted);
  for (const cycle of graph.cycles) {
    const first = byId.get(cycle[0] ?? "");
    if (first) {
      report(
        first.fileName,
        `prerequisites: these missions list each other in a loop: ${cycle.join(" → ")}. Remove one of the links.`,
      );
    }
  }

  const failing = files.find((file) => problems.has(file.fileName));
  if (failing) throw new MissionSourceError(failing.fileName, problems.get(failing.fileName) ?? []);

  const position = new Map(graph.order.map((id, index) => [id, index]));
  const missions = [...sorted].sort(
    (a, b) => rank(a) - rank(b) || (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0),
  );
  const missionsBySlug = new Map(missions.map((mission) => [mission.slug, mission]));
  const missionsById = new Map(missions.map((mission) => [mission.id, mission]));

  return {
    missions,
    graph,
    getMission: (slug) => missionsBySlug.get(slug),
    getMissionById: (id) => missionsById.get(id),
    listMissions: ({ skill, difficulty } = {}) =>
      missions.filter(
        (mission) =>
          (skill === undefined || mission.skills.includes(skill)) &&
          (difficulty === undefined || mission.difficulty === difficulty),
      ),
  };
}

/** Reads and validates every mission file in `dir`. */
export function loadMissionCatalog(dir: string = MISSIONS_DIR): MissionCatalog {
  const names = readdirSync(dir).sort();
  // A mission saved as .yml would be silently skipped, so say so instead.
  const misnamed = names.find((name) => name.endsWith(".yml"));
  if (misnamed) {
    throw new MissionSourceError(misnamed, [
      `Mission files end in ${MISSION_FILE_EXTENSION}. Rename it to ${misnamed.replace(/\.yml$/, MISSION_FILE_EXTENSION)}.`,
    ]);
  }
  return buildMissionCatalog(
    names
      .filter((name) => name.endsWith(MISSION_FILE_EXTENSION))
      .map((fileName) => ({
        fileName,
        mission: parseMissionSource(readFileSync(join(dir, fileName), "utf8"), fileName),
      })),
  );
}

let cached: MissionCatalog | undefined;

/**
 * The catalog for src/content/missions. Cached in production. In development it's read again on
 * every call, so an edited mission shows up on reload.
 */
export function getMissionCatalog(): MissionCatalog {
  if (process.env.NODE_ENV !== "production") return loadMissionCatalog();
  cached ??= loadMissionCatalog();
  return cached;
}

/** The mission at /missions/<slug>, or undefined. */
export function getMission(slug: string): Mission | undefined {
  return getMissionCatalog().getMission(slug);
}

/** The mission with this id, or undefined. */
export function getMissionById(id: string): Mission | undefined {
  return getMissionCatalog().getMissionById(id);
}

/** Missions matching `filter`, in catalog order. */
export function listMissions(filter: MissionFilter = {}): readonly Mission[] {
  return getMissionCatalog().listMissions(filter);
}

/** Which missions are best played before which, for "Best after" links. Never used to lock. */
export function getMissionGraph(): PrerequisiteGraph {
  return getMissionCatalog().graph;
}
