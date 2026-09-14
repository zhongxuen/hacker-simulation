import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatPlaythrough, verifyPlaythrough } from "@/features/missions";
import {
  loadMissionCatalog,
  loadPlaythrough,
  loadPlaythroughs,
  MissionSourceError,
  MISSIONS_DIR,
  parsePlaythroughSource,
} from "@/features/missions/server";

/**
 * Every mission is played end to end in CI, from its playthrough in
 * src/content/missions/playthroughs (md-files/06-mission-system.md, prompt 06.6): the same terminal
 * session code and run reducer as the browser, so a mission that stops completing, or a step that
 * stops ticking what its playthrough says, fails here.
 */

const missions = loadMissionCatalog().missions;

describe("the real missions", () => {
  it("each have a playthrough, and every playthrough is for a real mission", () => {
    const ids = missions.map((mission) => mission.id);
    expect(ids.filter((id) => !loadPlaythrough(id))).toEqual([]);
    expect(
      loadPlaythroughs()
        .map((p) => p.mission)
        .filter((id) => !ids.includes(id)),
    ).toEqual([]);
  });

  it.each(missions.map((mission) => [mission.id, mission] as const))(
    "%s plays to the end, every bonus objective and secret included",
    (id, mission) => {
      const playthrough = loadPlaythrough(id);
      if (!playthrough) throw new Error(`no playthrough for ${id}`);
      const { result, problems } = verifyPlaythrough(mission, playthrough);
      expect(problems, formatPlaythrough(mission, result)).toEqual([]);
      expect(result.complete).toBe(true);
      // Chapter 1 missions have a bonus objective and a secret, and the playthrough finds both.
      expect(result.run.completed).toEqual(
        expect.arrayContaining(mission.objectives.map((objective) => objective.id)),
      );
    },
  );

  it("reach their first tick with the first step", () => {
    for (const mission of missions) {
      const playthrough = loadPlaythrough(mission.id);
      if (!playthrough) continue;
      const { result } = verifyPlaythrough(mission, playthrough);
      expect(result.steps[0]?.ticked.length, mission.id).toBeGreaterThan(0);
    }
  });

  it("have no TODO left from the mission:new template", () => {
    for (const name of readdirSync(MISSIONS_DIR).filter((file) => file.endsWith(".yaml"))) {
      expect(readFileSync(join(MISSIONS_DIR, name), "utf8"), name).not.toMatch(/\bTODO\b/);
    }
  });
});

describe("playthrough files", () => {
  const problems = (source: string, fileName = "net-01.yaml") => {
    try {
      parsePlaythroughSource(source, fileName);
      return [];
    } catch (error) {
      if (error instanceof MissionSourceError) return error.problems;
      throw error;
    }
  };

  it("reject a step that is none of run, answer or reset, and a name that doesn't match", () => {
    expect(problems("mission: net-01\nsteps:\n  - type: ls\n").join()).toMatch(
      /Each step is one of: run/,
    );
    expect(problems("mission: net-01\nsteps:\n  - run: ls\n", "linux-01.yaml")[0]).toMatch(
      /Name it net-01.yaml/,
    );
  });

  it("say which step went differently", () => {
    const mission = missions.find((candidate) => candidate.id === "net-01");
    if (!mission) throw new Error("net-01 missing");
    const { problems: found } = verifyPlaythrough(mission, {
      mission: "net-01",
      steps: [
        { run: "whoami", ticks: ["find-yourself"] },
        { answer: "23", objective: "write-finding", accepted: true },
      ],
      expect: { complete: true, objectives: [] },
    });
    expect(found).toEqual([
      'steps[1] (whoami): expected it to tick "find-yourself", and it didn\'t.',
      'steps[2]: the answer "23" was not accepted, but the playthrough expects it accepted.',
      "The mission didn't complete. Main objectives still open: find-yourself, map-staff, map-servers, check-doors, write-finding, recommend-fix.",
    ]);
  });
});
