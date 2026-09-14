import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { toScenarioSpec, type Mission } from "@/content/schemas/mission";
import {
  canAnswer,
  createMissionRun,
  currentObjective,
  isRunInProgress,
  MissionRunner,
  missionRunReducer,
  playMission,
  rewardSummary,
  visibleObjectives,
  type MissionLinks,
  type MissionRunAction,
  type MissionRunState,
} from "@/features/missions";
import { getMissionById, loadMissionCatalog, parseMissionSource } from "@/features/missions/server";
import { createTerminalSession, submitLine } from "@/features/terminal";
import { createInitialState } from "@/sim";

/**
 * The in-memory mission run (md-files/06-mission-system.md, prompt 06.4) and the runner UI. The
 * reducer is pure, so every rule is checked here in plain Node: ticks stick, beats play once and
 * in order, answers open in story order, secrets queue their toast, the debrief waits for the
 * main objectives, and restart starts over. The UI is checked through its server-rendered markup.
 */

const FIXTURES = join(import.meta.dirname, "fixtures", "missions", "valid");
const welcome = parseMissionSource(
  readFileSync(join(FIXTURES, "fx-welcome.yaml"), "utf8"),
  "fx-welcome.yaml",
);

function mission(id: string): Mission {
  const found = getMissionById(id);
  if (!found) throw new Error(`no mission ${id}`);
  return found;
}

/** A started run plus a terminal to type into, for driving the reducer like the UI does. */
function started(m: Mission) {
  let terminal = createTerminalSession({ scenario: toScenarioSpec(m), seed: m.scenario.seed });
  let run = missionRunReducer(m, createMissionRun(), { type: "start", sim: terminal.sim });
  const act = (action: MissionRunAction) => (run = missionRunReducer(m, run, action));
  return {
    get run(): MissionRunState {
      return run;
    },
    type(line: string) {
      terminal = submitLine(terminal, line);
      return act({ type: "command", events: terminal.lastEvents, sim: terminal.sim });
    },
    reset() {
      terminal = { ...terminal, sim: createInitialState(toScenarioSpec(m), m.scenario.seed) };
      return act({ type: "reset", sim: terminal.sim });
    },
    act,
  };
}

describe("missionRunReducer", () => {
  it("starts on the briefing, and Start mission plays the start beats", () => {
    const m = mission("net-01");
    const fresh = createMissionRun();
    expect(fresh.phase).toBe("briefing");
    const play = started(m);
    expect(play.run.phase).toBe("workspace");
    expect(play.run.story.map((entry) => entry.speaker)).toEqual(["teammate-idris", "mentor-noor"]);
    expect(play.run.storyBatchStart).toBe(0);
  });

  it("ignores commands before the run starts", () => {
    const m = mission("intro-01");
    const sim = createInitialState(toScenarioSpec(m), m.scenario.seed);
    const run = missionRunReducer(m, createMissionRun(), { type: "command", events: [], sim });
    expect(run).toEqual(createMissionRun());
  });

  it("ticks objectives from events, and plays the beats they trigger, once each", () => {
    const play = started(mission("intro-01"));
    play.type("whoami");
    expect(play.run.completed).toEqual(["whoami"]);
    play.type("ls");
    expect(play.run.completed).toEqual(["whoami", "look-around"]);
    const beats = play.run.story.length;
    // The newest lines (here, the one beat `ls` triggered) are shown together.
    expect(play.run.storyBatchStart).toBe(beats - 1);
    play.type("ls");
    expect(play.run.story).toHaveLength(beats);
    expect(play.run.storyBatchStart).toBe(beats - 1);
  });

  it("keeps a tick once earned, even after Reset machine undoes the change", () => {
    const play = started(mission("linux-01"));
    play.type("sudo chmod 640 /srv/orders/config/database.conf");
    expect(play.run.completed).toContain("lock-it");
    play.reset();
    expect(play.run.completed).toContain("lock-it");
    expect(play.run.resets).toBe(1);
  });

  it("opens answer objectives in story order, and replies to a choice that isn't accepted", () => {
    const m = mission("intro-01");
    const play = started(m);
    const kit = m.objectives.find((objective) => objective.id === "kit-choice");
    if (!kit) throw new Error("kit-choice missing");
    expect(canAnswer(m, play.run, kit)).toBe(false);
    // An answer before its turn is ignored.
    play.act({
      type: "answer",
      objectiveId: "kit-choice",
      answer: "Wait for Roz to sign the letter",
    });
    expect(play.run.completed).not.toContain("kit-choice");

    play.type("whoami");
    play.type("ls");
    play.type("cat scope-letter.txt");
    expect(currentObjective(m, play.run)?.id).toBe("kit-choice");
    expect(canAnswer(m, play.run, kit)).toBe(true);

    play.act({
      type: "answer",
      objectiveId: "kit-choice",
      answer: "Take a look at the bakery's server now",
    });
    expect(play.run.feedback["kit-choice"]).toMatchObject({
      accepted: false,
      reply: { speaker: "teammate-theo" },
    });
    expect(play.run.story.at(-1)?.kind).toBe("reply");

    play.act({
      type: "answer",
      objectiveId: "kit-choice",
      answer: "  wait for roz to SIGN the letter ",
    });
    expect(play.run.feedback["kit-choice"]?.accepted).toBe(true);
    expect(play.run.completed).toContain("kit-choice");
    expect(canAnswer(m, play.run, kit)).toBe(false);
  });

  it("shows secrets only once found, queues their toast, and lets it be acknowledged", () => {
    const m = mission("intro-01");
    const play = started(m);
    expect(visibleObjectives(m, play.run).map((o) => o.id)).not.toContain("look-closer");
    play.type("cat .welcome-note");
    expect(play.run.newSecrets).toEqual(["look-closer"]);
    expect(visibleObjectives(m, play.run).map((o) => o.id)).toContain("look-closer");
    play.act({ type: "acknowledgeSecret", objectiveId: "look-closer" });
    expect(play.run.newSecrets).toEqual([]);
    expect(rewardSummary(m, play.run)).toMatchObject({ secretsTotal: 1, bonusTotal: 1 });
    expect(rewardSummary(m, play.run).secretsFound.map((o) => o.id)).toEqual(["look-closer"]);
  });

  it("shows hints one tier at a time, up to three, and they change nothing else", () => {
    const m = mission("net-01");
    const play = started(m);
    for (let i = 0; i < 5; i++) play.act({ type: "hint", objectiveId: "map-staff" });
    expect(play.run.hintsShown["map-staff"]).toBe(3);
    expect(play.run.completed).toEqual([]);
  });

  it("goes to the debrief only when the main objectives are done, and back to keep exploring", () => {
    const m = mission("net-01");
    const play = started(m);
    play.act({ type: "debrief" });
    expect(play.run.phase).toBe("workspace");
    expect(isRunInProgress(m, play.run)).toBe(true);

    for (const line of [
      "ifconfig",
      "netscan 10.40.1.0/24",
      "netscan 10.40.2.0/24",
      "netscan backup-01 -p common",
    ]) {
      play.type(line);
    }
    play.act({ type: "answer", objectiveId: "write-finding", answer: "23" });
    play.act({
      type: "answer",
      objectiveId: "recommend-fix",
      answer: "Switch off telnet on `backup-01`, and stop the customer wifi reaching the servers",
    });
    expect(isRunInProgress(m, play.run)).toBe(false);
    expect(play.run.story.at(-1)?.speaker).toBe("teammate-theo");

    play.act({ type: "debrief" });
    expect(play.run.phase).toBe("debrief");
    play.act({ type: "resume" });
    expect(play.run.phase).toBe("workspace");
  });

  it("restarts on the briefing with a fresh run and a new attempt", () => {
    const m = mission("intro-01");
    const play = started(m);
    play.type("whoami");
    play.act({ type: "restart" });
    expect(play.run).toEqual({ ...createMissionRun(), attempt: 1 });
  });

  it("is pure: the same steps always give the same run", () => {
    const m = mission("linux-01");
    const steps = [
      { run: "ls" },
      { run: "cat /srv/orders/README.txt" },
      { run: "ls -l /srv/orders/config" },
    ];
    expect(playMission(m, steps).run).toEqual(playMission(m, steps).run);
  });

  it("works for any valid mission, fixtures included", () => {
    const result = playMission(welcome, [
      { answer: "Wait for the letter", objective: "pick-a-path" },
      { run: "logview /home/recruit/welcome.txt" },
    ]);
    expect(result.run.completed).toEqual(["pick-a-path", "read-welcome"]);
  });
});

describe("MissionRunner", () => {
  const links: MissionLinks = {
    bestAfter: [{ slug: "intro-01", title: "Welcome to the team" }],
    concepts: [{ id: "linux-permissions", title: "File permissions" }],
    furtherReading: [],
    next: null,
  };

  it("opens on a briefing with the hook, goals, permission, time, Best after and one Start button", () => {
    const m = mission("linux-01");
    const html = renderToStaticMarkup(createElement(MissionRunner, { mission: m, links }));
    expect(html).toContain(m.title);
    expect(html).toContain("Someone left a password lying around");
    expect(html).toContain("You&#x27;ll learn");
    expect(html).toContain("Your written permission");
    expect(html).toContain("Signed: Roz Kowalczyk");
    expect(html).toContain(`About ${m.estimatedMinutes} minutes`);
    expect(html).toContain('href="/missions/intro-01"');
    expect(html).toContain('href="/learn/linux-permissions"');
    expect(html.match(/Start mission/g)).toHaveLength(1);
  });

  it("has no mission-specific code: no component names a mission, speaker or objective", () => {
    const dir = join(import.meta.dirname, "..", "..", "src", "features", "missions");
    const ids = [
      ...loadMissionCatalog().missions.flatMap((m) => [m.id, ...m.objectives.map((o) => o.id)]),
      "mentor-noor",
      "teammate-kit",
    ];
    const files = readdirSync(join(dir, "components")).map((name) => join(dir, "components", name));
    for (const file of [...files, join(dir, "run", "mission-run.ts")]) {
      const source = readFileSync(file, "utf8");
      const named = ids.filter((id) => source.includes(`"${id}"`) || source.includes(`'${id}'`));
      expect(named, relative(dir, file)).toEqual([]);
    }
  });
});
