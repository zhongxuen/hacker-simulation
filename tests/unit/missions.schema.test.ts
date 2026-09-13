import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { describe, expect, it } from "vitest";
import { CAST, CAST_IDS } from "@/content/cast";
import { missionCopy } from "@/content/mission-copy";
import {
  formatIssuePath,
  normalizeAnswer,
  parseMission,
  toScenarioSpec,
  type Mission,
  type ObjectiveCheck,
} from "@/content/schemas/mission";
import { SKILL_IDS, SKILLS } from "@/content/skills";
import { findBannedWords } from "@/content/voice";
import { MISSIONS_DIR, MissionSourceError, parseMissionSource } from "@/features/missions/server";

/**
 * The mission schema (md-files/06-mission-system.md, prompt 06.1). Every mission file in
 * src/content/missions must validate, through the same parse function the loader uses, so CI
 * rejects malformed content with a readable error. Fixtures prove the schema accepts a complete
 * mission and rejects each kind of mistake an author can make.
 */

const FIXTURES = join(import.meta.dirname, "fixtures", "missions");
const VALID = join(FIXTURES, "valid");
const MALFORMED = join(FIXTURES, "malformed");

const yamlFiles = (dir: string) =>
  readdirSync(dir)
    .filter((name) => name.endsWith(".yaml"))
    .sort();

const read = (dir: string, fileName: string) => readFileSync(join(dir, fileName), "utf8");

/** The problems a MissionSourceError reports for `source`, or [] if it parses. */
function problemsWith(source: string, fileName: string): readonly string[] {
  try {
    parseMissionSource(source, fileName);
    return [];
  } catch (error) {
    if (error instanceof MissionSourceError) return error.problems;
    throw error;
  }
}

/** Copy that breaks md-files/voice-and-tone.md, as `path: word`. */
function bannedWordsIn(mission: Mission): string[] {
  return missionCopy(mission).flatMap(({ path, text }) =>
    findBannedWords(text).map((word) => `${path}: ${word}`),
  );
}

describe("the real missions in src/content/missions", () => {
  const files = yamlFiles(MISSIONS_DIR);

  it("all validate, with ids matching their file names and scenarios the engine can build", () => {
    for (const fileName of files) {
      expect(problemsWith(read(MISSIONS_DIR, fileName), fileName), fileName).toEqual([]);
    }
  });

  it("use none of the banned words", () => {
    for (const fileName of files) {
      const mission = parseMissionSource(read(MISSIONS_DIR, fileName), fileName);
      expect(bannedWordsIn(mission), fileName).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// The valid fixtures
// ---------------------------------------------------------------------------------------------

const WELCOME_SOURCE = read(VALID, "fx-welcome.yaml");
const welcome = parseMissionSource(WELCOME_SOURCE, "fx-welcome.yaml");

function* checksIn(check: ObjectiveCheck): Generator<ObjectiveCheck> {
  yield check;
  if (check.kind === "all" || check.kind === "any")
    for (const inner of check.of) yield* checksIn(inner);
}

describe("the valid fixture missions", () => {
  it("validate, and use none of the banned words", () => {
    for (const fileName of yamlFiles(VALID)) {
      const mission = parseMissionSource(read(VALID, fileName), fileName);
      expect(bannedWordsIn(mission), fileName).toEqual([]);
    }
  });

  it("exercise every kind of check, nested all/any, choices, and a check on a named host", () => {
    const checks = welcome.objectives.flatMap((objective) => [...checksIn(objective.check)]);
    expect(new Set(checks.map((check) => check.kind))).toEqual(
      new Set(["event", "answer", "fileState", "commandRun", "all", "any"]),
    );
    expect(checks.some((check) => check.kind === "answer" && check.choices)).toBe(true);
    expect(checks.some((check) => check.kind === "answer" && !check.choices)).toBe(true);
    expect(checks.some((check) => check.kind === "fileState" && check.host)).toBe(true);
    const nested = welcome.objectives.find((objective) => objective.id === "scan-range")?.check;
    expect(nested?.kind === "all" && nested.of.some((inner) => inner.kind === "any")).toBe(true);
  });

  it("fills in defaults and marks hidden objectives optional", () => {
    const byId = new Map(welcome.objectives.map((objective) => [objective.id, objective]));
    expect(byId.get("look-closer")).toMatchObject({ hidden: true, optional: true });
    expect(byId.get("read-the-manual")).toMatchObject({ hidden: false, optional: true });
    expect(byId.get("pick-a-path")).toMatchObject({ hidden: false, optional: false });
    expect(welcome.prerequisites).toEqual([]);
    expect(welcome.guidedTour).toBe(true);
    const fx = parseMissionSource(read(VALID, "fx-map.yaml"), "fx-map.yaml");
    expect(fx).toMatchObject({ guidedTour: false, debrief: { furtherReading: [] } });
  });

  it("accepts a file mode written as a YAML number, and keeps it as octal text", () => {
    const host = welcome.scenario.network.hosts.find((entry) => entry.id === "range-ws-01");
    const entry = host?.fs?.entries?.find((file) => file.path === "/srv/shared/app.conf");
    expect(entry?.mode).toBe("644");
  });

  it("lists every learner-facing string for the copy check, choices and replies included", () => {
    const paths = missionCopy(welcome).map((copy) => copy.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        "hook",
        "briefing.authorization",
        "story[1].text",
        "objectives[pick-a-path].why",
        "objectives[pick-a-path].check.choices[1].reply.text",
        "hints.lock-the-file[3]",
        "debrief.ethicsNote",
        "debrief.nextTease",
      ]),
    );
    // Scenario files are realistic terminal output, so they're not held to the copy rules.
    expect(missionCopy(welcome).some((copy) => copy.text.includes("db_password"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// Malformed missions
// ---------------------------------------------------------------------------------------------

describe("malformed mission files on disk", () => {
  it.each(yamlFiles(MALFORMED))("%s fails with the problem its first line expects", (fileName) => {
    const source = read(MALFORMED, fileName);
    const expected = /^# expect: (.+)$/m.exec(source)?.[1];
    if (!expected) throw new Error(`${fileName} needs a "# expect: <problem>" line`);
    expect(problemsWith(source, fileName).join("\n")).toContain(expected.trim());
  });
});

type Data = Record<string, unknown>;

/** The valid fixture as plain data, to break one thing at a time. */
const fixtureData = (): Data => parseYaml(WELCOME_SOURCE) as Data;

const at = (data: unknown, ...path: (string | number)[]): Data =>
  path.reduce<unknown>((node, key) => (node as Data)[key], data) as Data;

/** Problems with the fixture after `change`, run through the real file parser. */
function problemsAfter(change: (data: Data) => void, fileName = "fx-welcome.yaml") {
  const data = fixtureData();
  change(data);
  return problemsWith(stringifyYaml(data), fileName);
}

describe("the schema rejects, with a readable problem", () => {
  it.each<[string, (data: Data) => void, string]>([
    [
      "a briefing without authorization",
      (data) => delete at(data, "briefing").authorization,
      "briefing.authorization: Missing: add the authorization: who gave written permission, and exactly what's in scope.",
    ],
    [
      "a debrief without an ethics note",
      (data) => delete at(data, "debrief").ethicsNote,
      "debrief.ethicsNote: Missing: add the ethics note",
    ],
    [
      "a debrief without a defensive takeaway",
      (data) => delete at(data, "debrief").defensiveTakeaway,
      "debrief.defensiveTakeaway: Missing: add the defensive takeaway",
    ],
    ["a mission without a hook", (data) => delete data.hook, "hook: Missing: add the hook"],
    [
      "a hook longer than one line",
      (data) => (data.hook = "First day.\nSecond line."),
      "hook: Keep it to one line.",
    ],
    [
      "a mission without learning goals",
      (data) => delete data.learningGoals,
      "learningGoals: Missing: add the learning goals: 2 to 4 plain-language lines",
    ],
    [
      "too many learning goals",
      (data) => (data.learningGoals = ["a", "b", "c", "d", "e"]),
      "learningGoals: Write 2 to 4 learning goals.",
    ],
    [
      "an objective without a why",
      (data) => delete at(data, "objectives", 0).why,
      "objectives[pick-a-path].why: Missing: add one line on why this step matters.",
    ],
    [
      "an objective without a success line",
      (data) => delete at(data, "objectives", 1).success,
      "objectives[read-welcome].success: Missing: add the celebration line",
    ],
    [
      "a blank success line",
      (data) => (at(data, "objectives", 1).success = "   "),
      "objectives[read-welcome].success: Can't be empty",
    ],
    [
      "an intro mission over 10 minutes",
      (data) => (data.estimatedMinutes = 11),
      "estimatedMinutes: intro missions take 10 minutes or less",
    ],
    [
      "an easy mission over 15 minutes",
      (data) => Object.assign(data, { difficulty: "easy", estimatedMinutes: 20 }),
      "estimatedMinutes: easy missions take 15 minutes or less",
    ],
    [
      "a speaker who isn't in the cast",
      (data) => (at(data, "story", 0).speaker = "mentor-nora"),
      'story[1].speaker: "mentor-nora" isn\'t in the cast. Use one of: mentor-noor,',
    ],
    [
      "a reply from a speaker who isn't in the cast",
      (data) =>
        (at(data, "objectives", 0, "check", "choices", 0, "reply").speaker = "hollow-latch"),
      'objectives[pick-a-path].check.choices[1].reply.speaker: "hollow-latch" isn\'t in the cast',
    ],
    [
      "an event type the engine doesn't send",
      (data) => (at(data, "objectives", 1, "check").event = "file.opened"),
      'objectives[read-welcome].check.event: "file.opened" isn\'t an event the engine sends.',
    ],
    [
      "a story beat on an unknown event",
      (data) => (at(data, "story", 2, "on").event = "host.found"),
      'story[3].on: event: "host.found" isn\'t an event the engine sends.',
    ],
    [
      "a typo in a field name",
      (data) => {
        data.hnits = data.hints;
        delete data.hints;
      },
      'Unknown field "hnits". Did you mean "hints"?',
    ],
    [
      "a typo in a nested field name",
      (data) => (at(data, "objectives", 2).descripton = "x"),
      'objectives[scan-range]: Unknown field "descripton". Did you mean "description"?',
    ],
    [
      "a match on a field the event doesn't have",
      (data) => (at(data, "story", 2, "on", "match").hostid = "range-srv-01"),
      'host.discovered events have no field "hostid". Did you mean "hostId"?',
    ],
    [
      "an unknown kind of check",
      (data) => (at(data, "objectives", 1, "check").kind = "eventually"),
      'objectives[read-welcome].check.kind: "eventually" isn\'t a kind of check.',
    ],
    [
      "a regular expression that doesn't compile",
      (data) => (at(data, "objectives", 2, "check", "of", 0).pattern = "netscan ("),
      "objectives[scan-range].check.of[1].pattern: This isn't a regular expression JavaScript can read.",
    ],
    [
      "an empty group of checks",
      (data) => (at(data, "objectives", 2, "check", "of", 1).of = []),
      "objectives[scan-range].check.of[2].of: Put at least one check inside.",
    ],
    [
      "a file predicate with nothing to check",
      (data) => (at(data, "objectives", 4, "check", "of", 0).predicate = {}),
      "objectives[lock-the-file].check.of[1].predicate: Say what must be true about the file",
    ],
    [
      "exists: false with other fields",
      (data) =>
        (at(data, "objectives", 4, "check", "of", 0).predicate = { exists: false, mode: "600" }),
      "predicate.exists: exists: false can't be combined with other fields",
    ],
    [
      "a mode that lost its leading zero",
      (data) => (at(data, "objectives", 4, "check", "of", 0).predicate = { modeExcludes: 44 }),
      "predicate.modeExcludes: Write the mode as 3 or 4 octal digits",
    ],
    [
      "a relative file path",
      (data) => (at(data, "objectives", 4, "check", "of", 0).path = "srv/shared/app.conf"),
      'objectives[lock-the-file].check.of[1].path: Use an absolute path, starting with "/".',
    ],
    [
      "an accepted answer that isn't one of the choices",
      (data) => (at(data, "objectives", 0, "check").accept = ["Wait for the letter", "Run away"]),
      'objectives[pick-a-path].check.accept[2]: "Run away" isn\'t one of the choices.',
    ],
    [
      "a choice that isn't accepted and has no reply",
      (data) => delete at(data, "objectives", 0, "check", "choices", 0).reply,
      "objectives[pick-a-path].check.choices[1].reply: This choice isn't accepted, so it needs a reply",
    ],
    [
      "fewer than 3 main objectives",
      (data) => {
        const objectives = at(data, "objectives") as unknown as Data[];
        for (const objective of objectives.slice(2)) objective.optional = true;
      },
      "objectives: A mission has 3 to 6 main objectives (not optional or hidden); this one has 2.",
    ],
    [
      "more than 6 main objectives",
      (data) => {
        const objectives = at(data, "objectives") as unknown as Data[];
        const hints = at(data, "hints");
        for (const n of [1, 2]) {
          objectives.push({ ...objectives[1], id: `extra-${n}` });
          hints[`extra-${n}`] = hints["read-welcome"];
        }
        at(data, "objectives", 5).optional = false;
      },
      "this one has 8",
    ],
    [
      "a hidden objective marked not optional",
      (data) => (at(data, "objectives", 6).optional = false),
      "objectives[look-closer].optional: Hidden objectives are always optional.",
    ],
    [
      "two objectives with the same id",
      (data) => (at(data, "objectives", 3).id = "scan-range"),
      'objectives[scan-range].id: Two objectives have the id "scan-range".',
    ],
    [
      "an objective with no hints",
      (data) => delete at(data, "hints")["read-welcome"],
      'hints: Add three hints for the objective "read-welcome".',
    ],
    [
      "hints for an objective that doesn't exist",
      (data) => (at(data, "hints")["scan-rang"] = ["a", "b", "c"]),
      'hints.scan-rang: There\'s no objective with the id "scan-rang". Did you mean "scan-range"?',
    ],
    [
      "two hint tiers instead of three",
      (data) => (at(data, "hints")["read-welcome"] = ["a", "b"]),
      "hints.read-welcome: Write exactly three hints, in order: a nudge, then the idea, then a near-answer.",
    ],
    [
      "a story beat on an objective that doesn't exist",
      (data) => (at(data, "story", 1, "on").objective = "pick-the-path"),
      'story[2].on.objective: There\'s no objective with the id "pick-the-path".',
    ],
    [
      "a story beat with an unknown trigger",
      (data) => (at(data, "story", 0).on = "begin"),
      'story[1].on: the text "begin" isn\'t a trigger.',
    ],
    [
      "a debrief that doesn't mirror the learning goals",
      (data) => (at(data, "debrief").whatYouLearned = ["one", "two"]),
      "debrief.whatYouLearned: Write one line for each learning goal: there are 3 goals and 2 lines here.",
    ],
    [
      "a mission that lists itself as a prerequisite",
      (data) => (data.prerequisites = ["fx-welcome"]),
      "prerequisites: A mission can't be its own prerequisite.",
    ],
    [
      "a skill outside the taxonomy",
      (data) => (data.skills = ["lockpicking"]),
      'skills[1]: "lockpicking" isn\'t allowed here. Use one of: linux, networking, web, crypto, forensics, blue-team.',
    ],
    [
      "an unquoted version number",
      (data) => (at(data, "scenario", "network", "hosts", 1, "services", 0).version = 9.6),
      'scenario.network.hosts[range-srv-01].services[1].version: Put the version in quotes, like "9.6"',
    ],
    [
      "a seed out of range",
      (data) => (at(data, "scenario").seed = -1),
      "scenario.seed: Should be 0 or more.",
    ],
  ])("%s", (_name, change, expected) => {
    expect(problemsAfter(change).join("\n")).toContain(expected);
  });

  it("an id that doesn't match the file name", () => {
    expect(problemsAfter(() => {}, "fx-welcom.yaml")).toEqual([
      'id is "fx-welcome", but the file is named fx-welcom.yaml. Name the file fx-welcome.yaml, or change the id to match.',
    ]);
  });

  it("a scenario the engine can't build, with the engine's own words", () => {
    expect(
      problemsAfter((data) => {
        const entries = at(
          data,
          "scenario",
          "network",
          "hosts",
          0,
          "fs",
          "entries",
        ) as unknown as Data[];
        entries.push({ path: "/home/recruit/lost.txt", content: "x", owner: "alex" });
      }),
    ).toEqual([
      'scenario (host "range-ws-01" filesystem is not valid): "/home/recruit/lost.txt": owner "alex" is not a user',
    ]);
  });

  it("checks that name hosts, users or flags the scenario doesn't have", () => {
    const problems = problemsAfter((data) => {
      at(data, "objectives", 4, "check", "of", 1).host = "range-srv-02";
      at(data, "objectives", 4, "check", "of", 0).predicate = { notReadableBy: "visitor" };
      at(data, "objectives", 6, "check", "match").flagId = "look-closr";
      at(data, "story", 2, "on", "match").hostId = "range-srv-1";
    });
    expect(problems).toEqual([
      'objectives[lock-the-file].check: notReadableBy "visitor" isn\'t a user on range-ws-01.',
      'objectives[lock-the-file].check: host "range-srv-02" isn\'t a host in the scenario.',
      "objectives[look-closer].check: match.flagId \"look-closr\" isn't one of the scenario's flags.",
      'story[3].on: match.hostId "range-srv-1" isn\'t a host in the scenario.',
    ]);
  });

  it("a file check on a host with no filesystem", () => {
    const problems = problemsAfter((data) => {
      const hosts = at(data, "scenario", "network", "hosts") as unknown as Data[];
      delete hosts[1]?.fs;
      delete hosts[1]?.users;
      at(data, "objectives", 4, "check", "of", 1).host = "range-srv-01";
    });
    expect(problems.join("\n")).toContain('host "range-srv-01" has no filesystem');
  });

  it("broken YAML, an empty file, and a file that isn't a mission", () => {
    expect(problemsWith("title: [unclosed", "fx-welcome.yaml")[0]).toMatch(/isn't valid YAML/);
    expect(problemsWith("", "fx-welcome.yaml")).toEqual([
      "The file is empty. A mission file starts with its id, slug, version and title.",
    ]);
    expect(problemsWith("- a list\n", "fx-welcome.yaml")[0]).toMatch(/^Should be a mission/);
  });

  it("lists every problem at once", () => {
    const problems = problemsAfter((data) => {
      delete at(data, "briefing").authorization;
      delete data.hook;
      delete at(data, "objectives", 0).why;
    });
    expect(problems).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

describe("mission helpers", () => {
  it("normalizes answers: trimmed, lowercase, single spaces", () => {
    expect(normalizeAnswer("  Wait   for the\tLetter ")).toBe("wait for the letter");
  });

  it("turns a mission's scenario into the engine's spec, without the seed", () => {
    const spec = toScenarioSpec(welcome);
    expect(spec.id).toBe("fx-welcome");
    expect(spec).not.toHaveProperty("seed");
    expect(spec.session).toEqual({ host: "range-ws-01", user: "recruit" });
    expect(
      toScenarioSpec({ ...welcome, scenario: { ...welcome.scenario, id: "custom-range" } }).id,
    ).toBe("custom-range");
  });

  it("names list items by id where they have one, and counts positions from 1", () => {
    const data = { objectives: [{ id: "a" }, { id: "b", check: { of: [{}, {}] } }], goals: ["x"] };
    expect(formatIssuePath(["objectives", 1, "check", "of", 1, "kind"], data)).toBe(
      "objectives[b].check.of[2].kind",
    );
    expect(formatIssuePath(["goals", 0], data)).toBe("goals[1]");
    expect(formatIssuePath([], data)).toBe("");
  });

  it("returns problems instead of throwing", () => {
    const result = parseMission({ id: "x" });
    expect(result.success).toBe(false);
    expect(parseMission(parseYaml(WELCOME_SOURCE)).success).toBe(true);
  });
});

describe("the cast and the skills", () => {
  it("match the story bible's quick reference", () => {
    expect(CAST_IDS).toEqual([
      "mentor-noor",
      "teammate-theo",
      "teammate-kit",
      "teammate-idris",
      "client-roz",
    ]);
    for (const id of CAST_IDS) {
      expect(CAST[id].id).toBe(id);
      expect(CAST[id].initials).toMatch(/^[A-Z]{2}$/);
    }
    // Only the mentor gets the mentor style; clients share the teammate style.
    expect(CAST_IDS.filter((id) => CAST[id].tone === "mentor")).toEqual(["mentor-noor"]);
  });

  it("describe every skill in words without banned words", () => {
    for (const id of SKILL_IDS) {
      expect(SKILLS[id].id).toBe(id);
      expect(findBannedWords(`${SKILLS[id].label} ${SKILLS[id].description}`)).toEqual([]);
    }
  });
});
