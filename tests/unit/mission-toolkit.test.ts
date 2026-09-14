import { describe, expect, it } from "vitest";
import { verifyPlaythrough } from "@/features/missions";
import { parseMissionSource, parsePlaythroughSource } from "@/features/missions/server";
import { missionTemplate, playthroughTemplate, seedFor } from "../../scripts/lib/mission-template";

/**
 * `pnpm mission:new` (md-files/06-mission-system.md, prompt 06.6) must write a mission that
 * validates and plays to the end as it is, so an author starts from something that works and
 * replaces the TODOs one at a time.
 */
describe("the mission:new template", () => {
  const mission = parseMissionSource(missionTemplate("web-07"), "web-07.yaml");

  it("validates, with the slug as its id and a seed of its own", () => {
    expect(mission.id).toBe("web-07");
    expect(mission.slug).toBe("web-07");
    expect(mission.scenario.seed).toBe(seedFor("web-07"));
    expect(seedFor("web-07")).not.toBe(seedFor("web-08"));
  });

  it("marks the copy to replace with TODO", () => {
    expect(missionTemplate("web-07").match(/\bTODO\b/g)?.length).toBeGreaterThan(20);
  });

  it("plays to the end from its own playthrough, bonus objective and secret included", () => {
    const playthrough = parsePlaythroughSource(playthroughTemplate("web-07"), "web-07.yaml");
    const { result, problems } = verifyPlaythrough(mission, playthrough);
    expect(problems).toEqual([]);
    expect(result.run.completed).toHaveLength(mission.objectives.length);
  });
});
