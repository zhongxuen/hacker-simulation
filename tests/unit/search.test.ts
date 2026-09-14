import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GLOSSARY } from "@/content/glossary";
import { commandOf, ReferenceDrawer, referenceSuggestions } from "@/features/learning";
import { buildSearchIndex, listLessons } from "@/features/learning/server";
import { isSearchIndex, searchIndex, type SearchEntry } from "@/lib/search";
import { listTools } from "@/sim";
import { GET } from "../../src/app/search-index.json/route";

/**
 * Search and the in-mission reference (md-files/09-learning-center.md, prompt 09.5): one index over
 * every lesson, glossary word and command manual page, built at build time, searched in the browser
 * in well under 100 ms, and the reference drawer's suggestions.
 */

const index = buildSearchIndex();
const entries = index.entries;
const ids = (found: readonly SearchEntry[]) => found.map((entry) => entry.id);

describe("the search index", () => {
  it("covers every lesson, glossary word and command, once each", () => {
    const lessons = listLessons();
    expect(entries.filter((entry) => entry.kind === "lesson")).toHaveLength(lessons.length);
    expect(entries.filter((entry) => entry.kind === "term")).toHaveLength(GLOSSARY.length);
    expect(entries.filter((entry) => entry.kind === "command")).toHaveLength(listTools().length);
    expect(new Set(ids(entries)).size).toBe(entries.length);
  });

  it("points every entry at a page that exists", () => {
    const lessonIds = new Set(listLessons().map((lesson) => lesson.id));
    const termIds = new Set(GLOSSARY.map((entry) => entry.id));
    const commands = new Set(listTools().map((tool) => tool.name));
    for (const entry of entries) {
      const [path, anchor] = entry.href.split("#");
      if (entry.kind === "lesson")
        expect(lessonIds.has(path?.replace("/learn/", "") ?? "")).toBe(true);
      if (entry.kind === "term")
        expect([path, termIds.has(anchor ?? "")]).toEqual(["/learn/glossary", true]);
      if (entry.kind === "command") {
        expect([path, commands.has(anchor ?? "")]).toEqual(["/learn/commands", true]);
      }
    }
  });

  it("stays small enough to load in a moment", () => {
    expect(JSON.stringify(index).length).toBeLessThan(200_000);
  });

  it("is served as a static file in the shape the browser checks for", async () => {
    const served: unknown = await GET().json();
    expect(isSearchIndex(served)).toBe(true);
    expect(isSearchIndex({ version: 2, entries: [] })).toBe(false);
    expect(isSearchIndex({ version: 1, entries: [{ id: 1 }] })).toBe(false);
  });
});

describe("searchIndex", () => {
  it("finds lessons, words and commands together, best first", () => {
    const found = ids(searchIndex(entries, "port"));
    expect(found[0]).toBe("term:port");
    expect(found).toContain("lesson:net-ports");
    expect(found).toContain("command:netscan");
    expect(ids(searchIndex(entries, "ls"))[0]).toBe("command:ls");
  });

  it("ignores case, accents and extra spaces, and needs every word", () => {
    expect(ids(searchIndex(entries, "  IP   Address "))[0]).toBe("term:ip-address");
    expect(ids(searchIndex(entries, "pérmissions"))).toContain("lesson:linux-permissions");
    expect(searchIndex(entries, "port zebra")).toEqual([]);
    expect(searchIndex(entries, "   ")).toEqual([]);
  });

  it("limits each kind and filters by kind", () => {
    const limited = searchIndex(entries, "a", { perKind: 2 });
    for (const kind of ["lesson", "term", "command"] as const) {
      expect(limited.filter((entry) => entry.kind === kind).length).toBeLessThanOrEqual(2);
    }
    expect(
      searchIndex(entries, "file", { kinds: ["command"] }).every((e) => e.kind === "command"),
    ).toBe(true);
  });

  /** The spec's budget is 100 ms per search; each takes well under a millisecond on its own. */
  it("answers every query in under 100 ms", () => {
    const queries = [
      "p",
      "po",
      "port",
      "ports and",
      "linux",
      "who am i",
      "hash",
      "fire",
      "x",
      "tcp handshake",
    ];
    searchIndex(entries, "warm up");
    for (const query of queries) {
      const start = performance.now();
      searchIndex(entries, query, { perKind: 5 });
      expect(performance.now() - start).toBeLessThan(100);
    }
  });
});

describe("the reference drawer", () => {
  it("suggests the mission's lessons first, then lessons that point at it", () => {
    const { forMission } = referenceSuggestions(entries, {
      missionId: "net-01",
      // net-ports twice, as when a lesson is both a concept and further reading.
      missionLessonIds: ["net-ip-basics", "net-ports", "nope", "net-ports"],
    });
    expect(ids(forMission).slice(0, 2)).toEqual(["lesson:net-ip-basics", "lesson:net-ports"]);
    expect(forMission.every((entry) => entry.kind === "lesson")).toBe(true);
    expect(new Set(ids(forMission)).size).toBe(forMission.length);
  });

  it("suggests lessons about the last command", () => {
    const { forCommand } = referenceSuggestions(entries, {
      missionId: "net-01",
      missionLessonIds: [],
      lastCommand: "netscan",
    });
    expect(forCommand.length).toBeGreaterThan(0);
    expect(forCommand.every((entry) => entry.commands?.includes("netscan"))).toBe(true);
    expect(commandOf("  sudo cat /etc/shadow")).toBe("sudo");
    expect(commandOf("")).toBeUndefined();
  });

  it("renders over the page without replacing anything, and hides when closed", () => {
    const props = {
      onClose: () => {},
      missionId: "net-01",
      missionLessonIds: ["net-ports"],
      lastCommand: "netscan",
    };
    const open = renderToStaticMarkup(createElement(ReferenceDrawer, { ...props, open: true }));
    expect(open).toContain('role="dialog"');
    expect(open).toContain('aria-modal="false"');
    expect(open).toContain("Read the manual for");
    expect(open).toContain("Look something up");
    const closed = renderToStaticMarkup(createElement(ReferenceDrawer, { ...props, open: false }));
    expect(closed).toMatch(/<section[^>]*hidden=""/);
  });
});
