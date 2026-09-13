import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { toScenarioSpec, type Mission, type ObjectiveCheck } from "@/content/schemas/mission";
import {
  evaluateObjectives,
  isMissionComplete,
  mainObjectives,
  missionProgress,
  type SubmittedAnswers,
} from "@/features/missions";
import { parseMissionSource } from "@/features/missions/server";
import {
  createInitialState,
  deepFreeze,
  fixedClock,
  scenarioStartMs,
  step,
  stableStringify,
  vfs,
  type FsActor,
  type ScenarioSpec,
  type SimEvent,
  type SimState,
  type Vfs,
} from "@/sim";

/**
 * Objective evaluation (md-files/06-mission-system.md, prompt 06.3), driven only by engine state,
 * engine events, and the learner's submitted answers.
 */

const SOURCE = readFileSync(
  join(import.meta.dirname, "fixtures", "missions", "valid", "fx-welcome.yaml"),
  "utf8",
);
const loadMission = (): Mission => parseMissionSource(SOURCE, "fx-welcome.yaml");
const mission = loadMission();
const spec = toScenarioSpec(mission);
const initial = createInitialState(spec, mission.scenario.seed);
const context = fixedClock(scenarioStartMs(spec) + 60_000);

interface Run {
  readonly state: SimState;
  readonly events: readonly SimEvent[];
}

/** Runs command lines (already split into words) in order, keeping every event of the run. */
function play(...commands: string[][]): Run {
  let state = initial;
  const events: SimEvent[] = [];
  for (const argv of commands) {
    const result = step(state, { type: "exec", argv }, context);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

const evaluate = (run: Run, answers: SubmittedAnswers = {}) =>
  evaluateObjectives(mission, run.state, run.events, answers);

const RECRUIT: FsActor = { user: "recruit", uid: 1000, group: "recruit", groups: ["recruit"] };

/** The state with one machine's filesystem changed, as if a command had done it. */
function withFs(state: SimState, hostId: string, change: (fs: Vfs) => Vfs): SimState {
  const machine = state.machines[hostId];
  if (!machine) throw new Error(`no machine ${hostId}`);
  return {
    ...state,
    machines: { ...state.machines, [hostId]: { ...machine, fs: change(machine.fs) } },
  };
}

const unwrap = <T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!result.ok) throw new Error(`fs change failed: ${JSON.stringify(result.error)}`);
  return result.value;
};

const chmod = (state: SimState, path: string, mode: number, hostId = "range-ws-01") =>
  withFs(state, hostId, (fs) =>
    unwrap(vfs.chmod(fs, { actor: RECRUIT, cwd: "/", now: 0 }, path, mode)),
  );

/** A one-objective mission, to test one check at a time. */
const single = (check: ObjectiveCheck): Pick<Mission, "objectives"> => ({
  objectives: [
    {
      id: "check",
      description: "Do it",
      why: "Why.",
      success: "Done!",
      check,
      optional: false,
      hidden: false,
    },
  ],
});

const passes = (
  check: ObjectiveCheck,
  run: Run = { state: initial, events: [] },
  answers: SubmittedAnswers = {},
) => evaluateObjectives(single(check), run.state, run.events, answers).includes("check");

describe("evaluateObjectives on the fixture mission", () => {
  it("starts with nothing complete", () => {
    expect(evaluate({ state: initial, events: [] })).toEqual([]);
  });

  it("ticks an event check only for a matching event", () => {
    expect(evaluate(play(["logview", "/home/recruit/welcome.txt"]))).toEqual(["read-welcome"]);
    expect(evaluate(play(["logview", "/var/log/range.log"]))).toEqual([]);
  });

  it("ticks nested all/any: a successful netscan that found the server", () => {
    expect(evaluate(play(["netscan", "192.168.60.0/24"]))).toEqual(["scan-range"]);
    // A failing scan runs a matching command line, but doesn't count.
    expect(evaluate(play(["netscan", "192.168.60.0/33"]))).toEqual([]);
  });

  it("ticks answers, compared trimmed, case-insensitive, with spaces collapsed", () => {
    const run = { state: initial, events: [] };
    expect(evaluate(run, { "name-the-host": ["  RANGE-SRV-01 "] })).toEqual(["name-the-host"]);
    expect(evaluate(run, { "name-the-host": ["range srv 01"] })).toEqual([]);
    expect(evaluate(run, { "pick-a-path": ["Look now"] })).toEqual([]);
    expect(evaluate(run, { "pick-a-path": ["Look now", "wait   for the LETTER"] })).toEqual([
      "pick-a-path",
    ]);
    // An answer only counts for the objective it was submitted to.
    expect(evaluate(run, { "pick-a-path": ["range-srv-01"] })).toEqual([]);
  });

  it("ticks a file check once the file is fixed, and reports it un-ticked if it breaks again", () => {
    const fixed = chmod(initial, "/srv/shared/app.conf", 0o600);
    expect(evaluate({ state: fixed, events: [] })).toEqual(["lock-the-file"]);
    const groupReadable = chmod(initial, "/srv/shared/app.conf", 0o640);
    expect(evaluate({ state: groupReadable, events: [] })).toEqual([]);
    // The evaluator reports what holds now; the mission run keeps ticks once earned.
    const broken = chmod(fixed, "/srv/shared/app.conf", 0o644);
    expect(evaluate({ state: broken, events: [] })).toEqual([]);
  });

  it("ticks the bonus and the hidden objective", () => {
    expect(evaluate(play(["netscan", "--help"]))).toEqual(["read-the-manual"]);
    expect(evaluate(play(["logview", "/home/recruit/.welcome-note"]))).toEqual(["look-closer"]);
  });

  it("completes the mission without its bonus or hidden objectives", () => {
    const run = play(["logview", "/home/recruit/welcome.txt"], ["netscan", "192.168.60.0/24"]);
    const answers = { "pick-a-path": ["Ask Theo"], "name-the-host": ["range-srv-01"] };
    const done = evaluate(
      { ...run, state: chmod(run.state, "/srv/shared/app.conf", 0o600) },
      answers,
    );

    expect(done).toEqual([
      "pick-a-path",
      "read-welcome",
      "scan-range",
      "name-the-host",
      "lock-the-file",
    ]);
    expect(isMissionComplete(mission, done)).toBe(true);
    expect(missionProgress(mission, done)).toEqual({ done: 5, total: 5 });
    expect(isMissionComplete(mission, done.slice(1))).toBe(false);
    expect(missionProgress(mission, done.slice(1))).toEqual({ done: 4, total: 5 });
  });

  it("never counts bonus or hidden objectives as main ones", () => {
    expect(mainObjectives(mission).map((objective) => objective.id)).toEqual([
      "pick-a-path",
      "read-welcome",
      "scan-range",
      "name-the-host",
      "lock-the-file",
    ]);
    expect(missionProgress(mission, ["read-the-manual", "look-closer"])).toEqual({
      done: 0,
      total: 5,
    });
    expect(isMissionComplete(mission, ["read-the-manual", "look-closer"])).toBe(false);
  });

  it("returns completed ids in objective order, whatever order they happened in", () => {
    const run = play(["netscan", "--help"], ["logview", "/home/recruit/welcome.txt"]);
    expect(evaluate(run, { "pick-a-path": ["Ask Theo"] })).toEqual([
      "pick-a-path",
      "read-welcome",
      "read-the-manual",
    ]);
  });
});

describe("each kind of check", () => {
  const scan = play(["netscan", "192.168.60.0/24"]);

  it("event: every match field must equal the event's field", () => {
    expect(passes({ kind: "event", event: "scan.completed" }, scan)).toBe(true);
    expect(
      passes(
        {
          kind: "event",
          event: "host.discovered",
          match: { hostId: "range-srv-01", via: "netscan" },
        },
        scan,
      ),
    ).toBe(true);
    expect(
      passes({ kind: "event", event: "host.discovered", match: { hostId: "range-ws-01" } }, scan),
    ).toBe(false);
    expect(
      passes({ kind: "event", event: "host.discovered", match: { ip: "192.168.60.20" } }, scan),
    ).toBe(true);
    expect(passes({ kind: "event", event: "web.probed" }, scan)).toBe(false);
    // Strict equality: the number 22 isn't the text "22".
    const probe = play(["webprobe", "192.168.60.20"]);
    expect(
      passes({ kind: "event", event: "web.probed", match: { port: 80, status: 200 } }, probe),
    ).toBe(true);
    expect(passes({ kind: "event", event: "web.probed", match: { port: "80" } }, probe)).toBe(
      false,
    );
  });

  it("commandRun: searched, not anchored, successful commands unless anyExitCode", () => {
    expect(passes({ kind: "commandRun", pattern: "60\\.0/24" }, scan)).toBe(true);
    expect(passes({ kind: "commandRun", pattern: "^logview" }, scan)).toBe(false);
    const failed = play(["logview", "/root/secret.txt"]);
    expect(passes({ kind: "commandRun", pattern: "^logview" }, failed)).toBe(false);
    expect(passes({ kind: "commandRun", pattern: "^logview", anyExitCode: true }, failed)).toBe(
      true,
    );
    const unknown = play(["ls", "-la"]);
    expect(passes({ kind: "commandRun", pattern: "^ls", anyExitCode: true }, unknown)).toBe(true);
  });

  it("answer: any submitted answer may match any accepted one", () => {
    const check: ObjectiveCheck = { kind: "answer", accept: ["port 23", "telnet"] };
    const empty = { state: initial, events: [] };
    expect(passes(check, empty, { check: ["no idea", " Port  23"] })).toBe(true);
    expect(passes(check, empty, { check: ["TELNET"] })).toBe(true);
    expect(passes(check, empty, { check: ["port 22"] })).toBe(false);
    expect(passes(check, empty, {})).toBe(false);
  });

  it("fileState: mode, bits, owner, group and content", () => {
    const file = (predicate: Record<string, unknown>, path = "/srv/shared/app.conf") =>
      ({ kind: "fileState", path, predicate }) as ObjectiveCheck;
    expect(passes(file({ exists: true }))).toBe(true);
    expect(passes(file({ mode: "644" }))).toBe(true);
    expect(passes(file({ mode: "0644" }))).toBe(true);
    expect(passes(file({ mode: "600" }))).toBe(false);
    expect(passes(file({ modeIncludes: "604" }))).toBe(true);
    expect(passes(file({ modeIncludes: "700" }))).toBe(false);
    expect(passes(file({ modeExcludes: "022" }))).toBe(true);
    expect(passes(file({ modeExcludes: "044" }))).toBe(false);
    expect(passes(file({ owner: "recruit", group: "recruit" }))).toBe(true);
    expect(passes(file({ owner: "root" }))).toBe(false);
    expect(passes(file({ contains: "db_password=" }))).toBe(true);
    expect(passes(file({ notContains: "db_password=" }))).toBe(false);
    expect(passes(file({ notContains: "hunter2" }))).toBe(true);
    // contains and notContains need a regular file.
    expect(passes(file({ contains: "app" }, "/srv/shared"))).toBe(false);
    expect(passes(file({ notContains: "app" }, "/srv/shared"))).toBe(false);
    expect(passes(file({ type: "dir", mode: "755" }, "/srv/shared"))).toBe(true);
  });

  it("fileState: exists false, and missing files failing everything else", () => {
    const gone = withFs(initial, "range-ws-01", (fs) =>
      unwrap(vfs.rm(fs, { actor: RECRUIT, cwd: "/", now: 0 }, "/srv/shared/app.conf")),
    );
    const exists = (value: boolean) =>
      ({ kind: "fileState", path: "/srv/shared/app.conf", predicate: { exists: value } }) as const;
    expect(passes(exists(false))).toBe(false);
    expect(passes(exists(false), { state: gone, events: [] })).toBe(true);
    expect(passes(exists(true), { state: gone, events: [] })).toBe(false);
    expect(
      passes(
        { kind: "fileState", path: "/srv/shared/app.conf", predicate: { notReadableBy: "guest" } },
        { state: gone, events: [] },
      ),
    ).toBe(false);
  });

  it("fileState: readableBy follows the real permission rules, folders included", () => {
    const readable = (user: string, state = initial) =>
      passes(
        { kind: "fileState", path: "/srv/shared/app.conf", predicate: { readableBy: user } },
        { state, events: [] },
      );
    expect(readable("guest")).toBe(true);
    expect(readable("recruit")).toBe(true);
    expect(readable("nobody-at-all")).toBe(false);
    // The file is still 644, but guest can no longer enter the folder it's in.
    const closedFolder = chmod(initial, "/srv/shared", 0o700);
    expect(readable("guest", closedFolder)).toBe(false);
    expect(readable("recruit", closedFolder)).toBe(true);
    expect(
      passes(
        { kind: "fileState", path: "/srv/shared/app.conf", predicate: { modeExcludes: "044" } },
        { state: closedFolder, events: [] },
      ),
    ).toBe(false);
  });

  it("fileState: another host's filesystem, when the check names it", () => {
    const backup = (predicate: Record<string, unknown>, host?: string) =>
      ({
        kind: "fileState",
        path: "/srv/backup/backup.conf",
        ...(host !== undefined && { host }),
        predicate,
      }) as ObjectiveCheck;
    expect(passes(backup({ contains: "rotate" }, "range-srv-01"))).toBe(true);
    expect(
      passes(backup({ readableBy: "admin", owner: "admin", mode: "640" }, "range-srv-01")),
    ).toBe(true);
    // Without a host, the learner's own machine is checked, and it has no such file.
    expect(passes(backup({ exists: true }))).toBe(false);
    expect(passes(backup({ exists: false }))).toBe(true);
  });

  it("fileState: type symlink looks at the link itself, anything else follows it", () => {
    const linked: ScenarioSpec = {
      ...spec,
      network: {
        ...spec.network,
        hosts: spec.network.hosts.map((host) =>
          host.id === "range-ws-01"
            ? {
                ...host,
                fs: {
                  entries: [
                    ...(host.fs?.entries ?? []),
                    { path: "/home/recruit/shared", target: "/srv/shared" },
                  ],
                },
              }
            : host,
        ),
      },
    };
    const state = createInitialState(linked, 1);
    const link = (predicate: Record<string, unknown>) =>
      passes({ kind: "fileState", path: "/home/recruit/shared", predicate } as ObjectiveCheck, {
        state,
        events: [],
      });
    expect(link({ type: "symlink" })).toBe(true);
    expect(link({ type: "dir", owner: "recruit" })).toBe(true);
    expect(link({ type: "file" })).toBe(false);
  });

  it("all and any, nested", () => {
    const yes: ObjectiveCheck = { kind: "event", event: "scan.completed" };
    const no: ObjectiveCheck = { kind: "event", event: "flag.found" };
    expect(passes({ kind: "all", of: [yes, yes] }, scan)).toBe(true);
    expect(passes({ kind: "all", of: [yes, no] }, scan)).toBe(false);
    expect(passes({ kind: "any", of: [no, yes] }, scan)).toBe(true);
    expect(passes({ kind: "any", of: [no, no] }, scan)).toBe(false);
    expect(
      passes(
        { kind: "all", of: [yes, { kind: "any", of: [no, { kind: "all", of: [yes] }] }] },
        scan,
      ),
    ).toBe(true);
    expect(
      passes(
        { kind: "any", of: [no, { kind: "all", of: [yes, { kind: "any", of: [no] }] }] },
        scan,
      ),
    ).toBe(false);
  });

  it("answers inside all/any use the objective's own answers", () => {
    const check: ObjectiveCheck = {
      kind: "all",
      of: [
        { kind: "event", event: "scan.completed" },
        { kind: "answer", accept: ["range-srv-01"] },
      ],
    };
    expect(passes(check, scan, { check: ["range-srv-01"] })).toBe(true);
    expect(passes(check, scan, { other: ["range-srv-01"] })).toBe(false);
  });
});

describe("determinism", () => {
  it("gives the same answer for the same input, and never changes its inputs", () => {
    const frozenMission = deepFreeze(loadMission());
    const run = play(
      ["netscan", "192.168.60.0/24"],
      ["logview", "/home/recruit/.welcome-note"],
      ["netscan", "--help"],
    );
    const state = deepFreeze(chmod(run.state, "/srv/shared/app.conf", 0o600));
    const events = deepFreeze([...run.events]);
    const answers = deepFreeze({ "pick-a-path": ["Wait for the letter"], "name-the-host": ["x"] });
    const before = stableStringify({ mission: frozenMission, state, events, answers });

    const first = evaluateObjectives(frozenMission, state, events, answers);
    const second = evaluateObjectives(frozenMission, state, events, answers);
    expect(first).toEqual([
      "pick-a-path",
      "scan-range",
      "lock-the-file",
      "read-the-manual",
      "look-closer",
    ]);
    expect(second).toEqual(first);
    expect(stableStringify({ mission: frozenMission, state, events, answers })).toBe(before);
  });

  it("replaying the same commands from the same seed gives the same ticks", () => {
    const commands = [
      ["netscan", "192.168.60.0/24"],
      ["logview", "/home/recruit/welcome.txt"],
    ];
    expect(evaluate(play(...commands))).toEqual(evaluate(play(...commands)));
  });
});
