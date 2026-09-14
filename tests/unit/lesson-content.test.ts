import { describe, expect, it } from "vitest";
import { START_HERE, TRACKS } from "@/content/tracks";
import { findBannedWords } from "@/content/voice";
import { compileLessonBody, loadLessonCatalog, type Lesson } from "@/features/learning/server";

/**
 * The lessons themselves (md-files/09-learning-center.md, "Writing for beginners", "Pedagogical
 * structure", and prompt 09.4): the initial catalog is all there, every lesson follows the
 * six-section shape, has something to do on its first screen, defines its glossary words with
 * <Term>, keeps to the voice-and-tone rules, and stays fictional. Cross-references are checked in
 * content-references.test.ts.
 */

const catalog = loadLessonCatalog();
const lessons = catalog.lessons;

/** The initial catalog from the "Initial content" section, by topic. */
const EXPECTED_LESSONS = [
  // Start Here (foundations, level 0)
  "start-ethical-hacking",
  "start-computer",
  "start-terminal",
  "start-network",
  "start-internet",
  "start-how-to-learn",
  // Linux
  "linux-filesystem",
  "linux-permissions",
  "linux-users-groups",
  "linux-processes",
  "linux-logs",
  // Networking
  "net-ip-basics",
  "net-ports",
  "net-tcp-handshake",
  "net-dns",
  "net-segmentation",
  // Web
  "web-http",
  "web-cookies-sessions",
  "web-same-origin",
  "web-owasp-top-10",
  // Security fundamentals
  "sec-cia-triad",
  "sec-threat-modelling",
  "sec-defence-in-depth",
  "sec-least-privilege",
  // Ethics and law
  "ethics-authorization",
  "ethics-scope",
  "ethics-responsible-disclosure",
  "ethics-unauthorized-testing",
];

/** The six sections, in order. Level 0 lessons may leave out "how it works" and misconceptions. */
const SECTIONS = [
  {
    name: "The one-sentence version",
    pattern: /^The one-sentence version$/,
    optionalAtLevel0: false,
  },
  { name: "Why it matters…", pattern: /^Why it matters/, optionalAtLevel0: false },
  { name: "How it actually works", pattern: /^How it actually works$/, optionalAtLevel0: true },
  { name: "See it / Try it", pattern: /^(See it|Try it)\b/, optionalAtLevel0: false },
  { name: "In practice", pattern: /^In practice$/, optionalAtLevel0: false },
  { name: "Common misconceptions", pattern: /^Common misconceptions$/, optionalAtLevel0: true },
] as const;

const INTERACTIVE = /<(Quiz|MiniTerminal|Annotated|PacketDiagram)\b/;

/** The body with code, component props and markup removed: what a reader reads as prose. */
function prose(body: string): string {
  return body
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]*`/g, "")
    .replace(/<\/?[A-Z][A-Za-z]*\b[^>]*?>/g, (tag) => tag.replace(/[a-z]+=\{?`[\s\S]*?`\}?/g, ""))
    .replace(/https?:\/\/\S+/g, "");
}

const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));
const eachLesson = lessons.map((lesson) => [lesson.id, lesson] as const);

describe("the lesson catalog", () => {
  it("has every lesson from the initial content list", () => {
    expect(EXPECTED_LESSONS.filter((id) => !byId.has(id))).toEqual([]);
  });

  it("has a complete Start Here track: level 0 foundations, in reading order", () => {
    expect(START_HERE.lessons).toHaveLength(6);
    START_HERE.lessons.forEach((id, index) => {
      const lesson = byId.get(id);
      expect(lesson, id).toBeDefined();
      expect(lesson?.topic, id).toBe("foundations");
      expect(lesson?.level, id).toBe(0);
      if (index > 0) expect(lesson?.prerequisites, id).toContain(START_HERE.lessons[index - 1]);
    });
  });

  it("ends the Start Here track by handing off to the first mission", () => {
    const last = byId.get(START_HERE.lessons.at(-1) ?? "");
    expect(last?.body).toMatch(/<TryIt mission="intro-01"/);
  });

  it("points every track at real lessons", () => {
    for (const track of TRACKS) {
      expect(
        track.lessons.filter((id) => !byId.has(id)),
        track.id,
      ).toEqual([]);
    }
  });

  it("backs the intro-01 gate with the ethics and law lessons", () => {
    for (const id of ["ethics-authorization", "ethics-scope", "ethics-unauthorized-testing"]) {
      expect(byId.get(id)?.relatedMissions, id).toContain("intro-01");
    }
  });
});

describe.each(eachLesson)("lesson %s", (_id, lesson: Lesson) => {
  it("follows the six-section structure, in order", async () => {
    const { toc } = await compileLessonBody(lesson.body, lesson.id);
    const headings = toc.filter((entry) => entry.depth === 2).map((entry) => entry.text);
    const found = SECTIONS.map((section) =>
      headings.findIndex((text) => section.pattern.test(text)),
    );
    const missing = SECTIONS.filter(
      (section, index) => found[index] === -1 && !(section.optionalAtLevel0 && lesson.level === 0),
    ).map((section) => section.name);
    expect(missing).toEqual([]);
    const present = found.filter((index) => index !== -1);
    expect(present).toEqual([...present].sort((a, b) => a - b));
  });

  it("has something to click, type or answer on its first screen", () => {
    const sections = lesson.body.split(/^## /m);
    // sections[0] is anything before the first heading; the first screen is the first two sections.
    expect(INTERACTIVE.test(sections.slice(0, 3).join("## "))).toBe(true);
  });

  it("defines its glossary words with <Term> in the body", async () => {
    const { termIds } = await compileLessonBody(lesson.body, lesson.id);
    expect(lesson.glossaryTerms.filter((id) => !termIds.includes(id))).toEqual([]);
    expect(termIds.length).toBeGreaterThan(0);
  });

  it("uses none of the banned words", () => {
    const text = [
      lesson.title,
      lesson.summary ?? "",
      lesson.analogy ?? "",
      prose(lesson.body),
    ].join("\n");
    expect(findBannedWords(text)).toEqual([]);
  });

  it("keeps every domain and address fictional", () => {
    const text = lesson.body;
    const domains = [...text.matchAll(/\b[a-z0-9-]+\.(?:com|net|org|io|co|uk|gov|edu)\b/gi)]
      .map((match) => match[0])
      .filter((domain) => domain.toLowerCase() !== "example.com");
    const addresses = [...text.matchAll(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g)]
      .map((match) => match[0])
      .filter(
        (ip) => !/^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|127\.|0\.0\.0\.0|255\.)/.test(ip),
      );
    expect([...domains, ...addresses]).toEqual([]);
  });
});
