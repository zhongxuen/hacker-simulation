import { describe, expect, it } from "vitest";
import {
  createMissionRun,
  MAX_NOTE_LENGTH,
  missionRunReducer,
  type MissionRunState,
} from "@/features/missions";
import { loadMissionCatalog } from "@/features/missions/server";

/**
 * Host notes (md-files/07-network-visualizer.md, prompt 07.3): the learner's notes in the map's
 * details panel live in the one in-memory run store, and go with the run
 * (md-files/03-app-state-and-privacy.md). Nothing is saved.
 */

const mission = loadMissionCatalog().getMissionById("net-01")!;
const inWorkspace: MissionRunState = { ...createMissionRun(), phase: "workspace" };
const note = (run: MissionRunState, hostId: string, text: string) =>
  missionRunReducer(mission, run, { type: "note", hostId, text });

describe("host notes in the mission run", () => {
  it("keeps a note per host, and replaces it on edit", () => {
    const one = note(inWorkspace, "backup-01", "Telnet is open!");
    const two = note(one, "printer-01", "Ignores pings.");
    expect(note(two, "backup-01", "Telnet on 23.").notes).toEqual({
      "backup-01": "Telnet on 23.",
      "printer-01": "Ignores pings.",
    });
  });

  it("removes a note that's emptied, and caps a very long one", () => {
    expect(note(note(inWorkspace, "pos-01", "Till"), "pos-01", "   ").notes).toEqual({});
    expect(note(inWorkspace, "pos-01", "x".repeat(5000)).notes["pos-01"]).toHaveLength(
      MAX_NOTE_LENGTH,
    );
  });

  it("starts empty, ignores notes before the mission starts, and clears on restart", () => {
    expect(createMissionRun().notes).toEqual({});
    expect(note(createMissionRun(), "pos-01", "Early").notes).toEqual({});
    const noted = note(inWorkspace, "pos-01", "Till");
    expect(missionRunReducer(mission, noted, { type: "restart" }).notes).toEqual({});
  });
});
