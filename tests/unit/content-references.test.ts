import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GLOSSARY } from "@/content/glossary";
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
import { listTools } from "@/sim";

/**
 * CI fails on a dead cross-reference anywhere in the learning content
 * (md-files/09-learning-center.md, "Content model"): lesson prerequisites, related missions and
 * commands, glossary terms in frontmatter and in <Term>, glossary cross-links, and every mission's
 * `concepts`. It also builds and renders every lesson, so a broken one never ships.
 */

/**
 * Missions and their `concepts`. Phase 06 adds the mission catalog in src/content/missions; until
 * then there are none, so a lesson that names a mission fails here.
 */
const MISSIONS: readonly MissionReferences[] = [];

/** Every command a learner can type. Phase 05 adds the terminal's own commands (ls, cd, …). */
const COMMANDS: readonly string[] = listTools().map((tool) => tool.name);

async function lessonReferences(catalog: LessonCatalog): Promise<LessonReferences[]> {
  return Promise.all(
    catalog.lessons.map(async (lesson) => ({
      ...lesson,
      termsInBody: (await compileLessonBody(lesson.body, lesson.id)).termIds,
    })),
  );
}

describe("the real content", () => {
  const lessons = loadLessonCatalog();

  it("has no dead cross-references", async () => {
    const dead = findDeadReferences({
      lessons: await lessonReferences(lessons),
      glossary: GLOSSARY,
      missions: MISSIONS,
      commands: COMMANDS,
    });
    expect(dead.map(describeDeadReference)).toEqual([]);
  });

  it("has no loops in lesson prerequisites", () => {
    expect(lessons.graph.cycles).toEqual([]);
  });

  it("builds and renders every lesson", async () => {
    for (const lesson of lessons.lessons) {
      const { content } = await renderLessonBody(lesson.body, lesson.id);
      expect(renderToStaticMarkup(content), lesson.id).not.toBe("");
    }
  });

  it("knows the engine's commands", () => {
    expect(COMMANDS).toEqual(expect.arrayContaining(["netscan", "webprobe", "logview", "hashid"]));
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
      glossary: GLOSSARY,
      missions: [],
      commands: COMMANDS,
    });
    expect(dead.map(describeDeadReference)).toEqual([]);
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
