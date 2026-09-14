import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GLOSSARY } from "@/content/glossary";
import type { Mission } from "@/content/schemas/mission";
import {
  describeDeadReference,
  findDeadReferences,
  type ContentCatalog,
  type LessonReferences,
  type MissionReferences,
} from "@/content/references";
import {
  compileLessonBody,
  loadLessonCatalog,
  renderLessonBody,
  type LessonCatalog,
} from "@/features/learning/server";
import { loadMissionCatalog } from "@/features/missions/server";
import { listTools } from "@/sim";

/**
 * CI fails on a dead cross-reference anywhere in the learning content
 * (md-files/09-learning-center.md, "Content model"): lesson prerequisites, related missions and
 * commands, glossary terms in frontmatter and in <Term>, glossary cross-links, and every mission's
 * `concepts`. It also builds and renders every lesson, so a broken one never ships.
 */

/** Missions and their `concepts`, from the mission catalog in src/content/missions. */
const missionReferences = (missions: readonly Mission[]): MissionReferences[] =>
  missions.map((mission) => ({ id: mission.id, concepts: mission.concepts }));

/** Each mission's debrief `furtherReading` entries that aren't lessons, as `mission id → lesson id`. */
const deadFurtherReading = (missions: readonly Mission[], lessonIds: ReadonlySet<string>) =>
  missions.flatMap((mission) =>
    mission.debrief.furtherReading
      .filter((id) => !lessonIds.has(id))
      .map((id) => `mission ${mission.id} → debrief.furtherReading: no lesson with id "${id}"`),
  );

const MISSIONS = loadMissionCatalog().missions;

/**
 * The real glossary without its links to lessons, for checking the fixture lessons: those links
 * point at the real lessons, and are checked against them in "the real content".
 */
const GLOSSARY_TERMS_ONLY = GLOSSARY.map((entry) => ({ ...entry, relatedLessons: [] }));

/** Every command a learner can type: the simulated tools and the Linux command set (ls, cd, …). */
const COMMANDS: readonly string[] = listTools().map((tool) => tool.name);

async function lessonReferences(catalog: LessonCatalog): Promise<LessonReferences[]> {
  return Promise.all(
    catalog.lessons.map(async (lesson) => {
      const compiled = await compileLessonBody(lesson.body, lesson.id);
      return { ...lesson, termsInBody: compiled.termIds, missionsInBody: compiled.missionIds };
    }),
  );
}

describe("the real content", () => {
  const lessons = loadLessonCatalog();

  it("has no dead cross-references", async () => {
    const dead = findDeadReferences({
      lessons: await lessonReferences(lessons),
      glossary: GLOSSARY,
      missions: missionReferences(MISSIONS),
      commands: COMMANDS,
    });
    expect(dead.map(describeDeadReference)).toEqual([]);
  });

  it("has no dead further reading in mission debriefs", () => {
    const lessonIds = new Set(lessons.lessons.map((lesson) => lesson.id));
    expect(deadFurtherReading(MISSIONS, lessonIds)).toEqual([]);
  });

  it("has no loops in lesson prerequisites", () => {
    expect(lessons.graph.cycles).toEqual([]);
  });

  // Compiling and rendering all 28 lessons takes 3 to 5 seconds, right at Vitest's 5-second
  // default, so it gets a timeout that fits the work.
  it("builds and renders every lesson", { timeout: 30_000 }, async () => {
    for (const lesson of lessons.lessons) {
      const { content } = await renderLessonBody(lesson.body, lesson.id);
      expect(renderToStaticMarkup(content), lesson.id).not.toBe("");
    }
  });

  it("knows the engine's commands", () => {
    expect(COMMANDS).toEqual(
      expect.arrayContaining([
        "netscan",
        "webprobe",
        "logview",
        "hashid",
        "ls",
        "cd",
        "chmod",
        "man",
      ]),
    );
  });
});

describe("the fixture lessons", () => {
  it("resolve against the real glossary and commands", async () => {
    const catalog = loadLessonCatalog(join(import.meta.dirname, "fixtures", "lessons"));
    const lessons = await lessonReferences(catalog);
    expect(lessons.find((lesson) => lesson.id === "fx-ports")?.termsInBody).toEqual([
      "port",
      "service",
    ]);
    const dead = findDeadReferences({
      lessons,
      glossary: GLOSSARY_TERMS_ONLY,
      missions: [],
      commands: COMMANDS,
    });
    expect(dead.map(describeDeadReference)).toEqual([]);
  });
});

describe("the fixture missions", () => {
  it("resolve against the fixture lessons", async () => {
    const lessons = loadLessonCatalog(join(import.meta.dirname, "fixtures", "lessons"));
    const missions = loadMissionCatalog(
      join(import.meta.dirname, "fixtures", "missions", "valid"),
    ).missions;
    const dead = findDeadReferences({
      lessons: await lessonReferences(lessons),
      glossary: GLOSSARY_TERMS_ONLY,
      missions: missionReferences(missions),
      commands: COMMANDS,
    });
    expect(dead.map(describeDeadReference)).toEqual([]);
    expect(
      deadFurtherReading(missions, new Set(lessons.lessons.map((lesson) => lesson.id))),
    ).toEqual([]);
    // And a mission naming a lesson that doesn't exist is caught.
    expect(deadFurtherReading(missions, new Set())).toEqual([
      'mission fx-welcome → debrief.furtherReading: no lesson with id "fx-ports"',
    ]);
  });
});

describe("findDeadReferences", () => {
  const lesson = (overrides: Partial<LessonReferences> & { id: string }): LessonReferences => ({
    prerequisites: [],
    relatedMissions: [],
    relatedCommands: [],
    glossaryTerms: [],
    ...overrides,
  });

  const catalog: ContentCatalog = {
    lessons: [
      lesson({ id: "net-ip" }),
      lesson({
        id: "net-ports",
        prerequisites: ["net-ip", "net-basics"],
        relatedMissions: ["net-01", "net-99"],
        relatedCommands: ["netscan", "nmap"],
        glossaryTerms: ["port", "portal"],
        termsInBody: ["port", "banner", "banner"],
      }),
    ],
    glossary: [
      { id: "port", relatedTerms: ["banner", "service"], relatedLessons: ["net-ports", "web-01"] },
    ],
    missions: [
      { id: "net-01", concepts: ["net-ports"] },
      { id: "web-01", concepts: ["web-http"] },
    ],
    commands: ["netscan"],
  };

  it("finds every kind of dead reference, once each", () => {
    expect(findDeadReferences(catalog).map(describeDeadReference)).toEqual([
      'lesson net-ports → prerequisites: no lesson with id "net-basics"',
      'lesson net-ports → relatedMissions: no mission with id "net-99"',
      'lesson net-ports → relatedCommands: no command with id "nmap"',
      'lesson net-ports → glossaryTerms: no glossary term with id "portal"',
      'lesson net-ports → <Term> in body: no glossary term with id "banner"',
      'glossary port → relatedTerms: no glossary term with id "banner"',
      'glossary port → relatedTerms: no glossary term with id "service"',
      'glossary port → relatedLessons: no lesson with id "web-01"',
      'mission web-01 → concepts: no lesson with id "web-http"',
    ]);
  });

  it("finds nothing in a sound catalog", () => {
    expect(
      findDeadReferences({
        lessons: [lesson({ id: "a", glossaryTerms: ["port"], termsInBody: ["port"] })],
        glossary: [{ id: "port", relatedTerms: [], relatedLessons: ["a"] }],
        missions: [{ id: "m", concepts: ["a"] }],
        commands: [],
      }),
    ).toEqual([]);
  });
});
