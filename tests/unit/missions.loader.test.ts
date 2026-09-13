import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { Mission } from "@/content/schemas/mission";
import {
  buildMissionCatalog,
  getMissionCatalog,
  listMissions,
  loadMissionCatalog,
  MissionSourceError,
  parseMissionSource,
  type MissionFile,
} from "@/features/missions/server";

/** The mission loader and registry (md-files/06-mission-system.md, prompt 06.2). */

const FIXTURES = join(import.meta.dirname, "fixtures", "missions");
const VALID = join(FIXTURES, "valid");
const MALFORMED = join(FIXTURES, "malformed");

const fixture = (fileName: string): Mission =>
  parseMissionSource(readFileSync(join(VALID, fileName), "utf8"), fileName);

const welcome = fixture("fx-welcome.yaml");
const map = fixture("fx-map.yaml");

const file = (mission: Mission, fileName = `${mission.id}.yaml`): MissionFile => ({
  fileName,
  mission,
});

/** The error buildMissionCatalog throws for `files`. */
function catalogError(files: readonly MissionFile[]): MissionSourceError {
  try {
    buildMissionCatalog(files);
  } catch (error) {
    if (error instanceof MissionSourceError) return error;
    throw error;
  }
  throw new Error("expected the catalog to be rejected");
}

const scratchDirs: string[] = [];
afterAll(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
});

/** A throwaway mission folder holding copies of the named fixture files. */
function missionDir(files: Readonly<Record<string, string>>): string {
  const dir = mkdtempSync(join(tmpdir(), "missions-"));
  scratchDirs.push(dir);
  for (const [name, source] of Object.entries(files)) copyFileSync(source, join(dir, name));
  return dir;
}

describe("loadMissionCatalog", () => {
  const catalog = loadMissionCatalog(VALID);

  it("reads every mission, by difficulty and then after its prerequisites", () => {
    expect(catalog.missions.map((mission) => mission.id)).toEqual(["fx-welcome", "fx-map"]);
  });

  it("looks missions up by slug and by id", () => {
    expect(catalog.getMission("fx-mapping-the-range")?.id).toBe("fx-map");
    expect(catalog.getMission("fx-map")).toBeUndefined(); // that's its id, not its slug
    expect(catalog.getMissionById("fx-map")?.slug).toBe("fx-mapping-the-range");
    expect(catalog.getMissionById("nope")).toBeUndefined();
  });

  it("filters by skill and difficulty", () => {
    const ids = (missions: readonly Mission[]) => missions.map((mission) => mission.id);
    expect(ids(catalog.listMissions())).toEqual(["fx-welcome", "fx-map"]);
    expect(ids(catalog.listMissions({ skill: "networking" }))).toEqual(["fx-map"]);
    expect(ids(catalog.listMissions({ skill: "blue-team" }))).toEqual(["fx-welcome"]);
    expect(ids(catalog.listMissions({ difficulty: "intro" }))).toEqual(["fx-welcome"]);
    expect(ids(catalog.listMissions({ skill: "linux", difficulty: "easy" }))).toEqual([]);
    expect(ids(catalog.listMissions({ difficulty: "hard" }))).toEqual([]);
  });

  it("builds the prerequisite graph for Best after suggestions", () => {
    expect(catalog.graph.prerequisitesOf("fx-map")).toEqual(["fx-welcome"]);
    expect(catalog.graph.dependentsOf("fx-welcome")).toEqual(["fx-map"]);
    expect(catalog.graph.allPrerequisitesOf("fx-welcome")).toEqual([]);
    expect(catalog.graph.cycles).toEqual([]);
  });

  it("fails on the first malformed file, naming it", () => {
    expect(() => loadMissionCatalog(MALFORMED)).toThrow(MissionSourceError);
    expect(() => loadMissionCatalog(MALFORMED)).toThrow(/^fx-no-authorization\.yaml:/);
  });

  it("reports a scenario with a public address in the engine's words", () => {
    const dir = missionDir({
      "fx-map.yaml": join(VALID, "fx-map.yaml"),
      "fx-public-address.yaml": join(MALFORMED, "fx-public-address.yaml"),
    });
    expect(() => loadMissionCatalog(dir)).toThrow(
      'fx-public-address.yaml:\n  - scenario (network is not valid): host "range-ws-01": 8.8.8.8 is outside the reserved ranges; use 10.x, 172.16.x or 192.168.x',
    );
  });

  it("refuses a mission saved as .yml instead of skipping it", () => {
    const dir = missionDir({ "fx-map.yml": join(VALID, "fx-map.yaml") });
    expect(() => loadMissionCatalog(dir)).toThrow(/Mission files end in \.yaml/);
  });

  it("ignores files that aren't missions, like the folder's README", () => {
    const dir = missionDir({ "fx-welcome.yaml": join(VALID, "fx-welcome.yaml") });
    writeFileSync(join(dir, "README.md"), "# Missions\n");
    writeFileSync(join(dir, ".gitkeep"), "");
    expect(loadMissionCatalog(dir).missions.map((mission) => mission.id)).toEqual(["fx-welcome"]);
  });
});

describe("buildMissionCatalog", () => {
  it("rejects two missions with the same id", () => {
    const error = catalogError([file(welcome), file({ ...map, id: "fx-welcome" }, "fx-copy.yaml")]);
    expect(error.fileName).toBe("fx-copy.yaml");
    expect(error.problems).toEqual([
      'id "fx-welcome" is also used by fx-welcome.yaml. Mission ids are unique and never reused.',
    ]);
  });

  it("rejects two missions with the same slug", () => {
    const error = catalogError([file(welcome), file({ ...map, slug: "fx-welcome" })]);
    expect(error.fileName).toBe("fx-map.yaml");
    expect(error.problems).toEqual([
      'slug "fx-welcome" is also used by fx-welcome.yaml. Each mission needs its own address.',
    ]);
  });

  it("rejects a prerequisite that isn't a mission", () => {
    const error = catalogError([file(welcome), file({ ...map, prerequisites: ["fx-nope"] })]);
    expect(error.message).toBe(
      'fx-map.yaml:\n  - prerequisites: there\'s no mission with the id "fx-nope".',
    );
  });

  it("rejects prerequisites that loop", () => {
    const error = catalogError([
      file({ ...welcome, prerequisites: ["fx-map"] }),
      file({ ...map, difficulty: "intro" }),
    ]);
    expect(error.problems[0]).toMatch(
      /^prerequisites: these missions list each other in a loop: fx-\w+ → fx-\w+ → fx-\w+\./,
    );
  });

  it("puts a prerequisite first among missions of the same difficulty, whatever the titles", () => {
    const catalog = buildMissionCatalog([
      file({ ...welcome, title: "Zebra crossing" }),
      file({ ...map, difficulty: "intro", title: "Aardvark" }),
    ]);
    expect(catalog.missions.map((mission) => mission.id)).toEqual(["fx-welcome", "fx-map"]);
  });

  it("accepts an empty catalog", () => {
    expect(buildMissionCatalog([]).missions).toEqual([]);
  });
});

describe("the real catalog", () => {
  it("loads src/content/missions, the same way the build does", () => {
    expect(getMissionCatalog().missions).toEqual(loadMissionCatalog().missions);
    expect(listMissions()).toEqual(loadMissionCatalog().missions);
  });
});
