import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Mission } from "@/content/schemas/mission";
import {
  createMissionRun,
  MissionRunner,
  type MissionLinks,
  type MissionRunState,
} from "@/features/missions";
import { loadMissionCatalog } from "@/features/missions/server";
import { MissionDebrief } from "../../src/features/missions/components/mission-debrief";

/**
 * Rewards inside a mission (md-files/08-campaign-and-story.md, prompt 08.3), rendered to HTML: the
 * debrief celebrates the skills practised and the bonus objectives and secrets found ("n of m"),
 * invites a replay when some are left, never mentions hints, and "Next mission" follows chapter
 * order. The briefing shows "Best after" and the mission's place in the campaign.
 */

const catalog = loadMissionCatalog();
const mission = (id: string): Mission => {
  const found = catalog.getMissionById(id);
  if (!found) throw new Error(`no mission ${id}`);
  return found;
};

const NO_LINKS: MissionLinks = { bestAfter: [], concepts: [], furtherReading: [], next: null };

/** A finished run: every main objective ticked, plus the given extras, with hints used. */
function finishedRun(of: Mission, extras: readonly string[]): MissionRunState {
  const main = of.objectives.filter((objective) => !objective.optional).map((o) => o.id);
  return {
    ...createMissionRun(),
    phase: "debrief",
    completed: [...main, ...extras],
    hintsShown: Object.fromEntries(Object.keys(of.hints).map((id) => [id, 3])),
  };
}

const debrief = (of: Mission, run: MissionRunState, links: MissionLinks = NO_LINKS) =>
  renderToStaticMarkup(
    createElement(MissionDebrief, { mission: of, run, links, dispatch: () => {} }),
  )
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");

describe("the debrief", () => {
  const linux = mission("linux-01");
  const secret = linux.objectives.find((objective) => objective.hidden);
  const bonus = linux.objectives.find((objective) => objective.optional && !objective.hidden);

  it("celebrates the skills practised", () => {
    const text = debrief(linux, finishedRun(linux, []));
    expect(text).toContain("Mission complete");
    expect(text).toContain("Skills you practised");
    expect(text).toContain("Linux");
  });

  it("counts secrets and bonus objectives as n of m, and invites a replay for the rest", () => {
    const none = debrief(linux, finishedRun(linux, []));
    expect(none).toContain("0 of 1 secret found");
    expect(none).toContain("0 of 1 bonus objective done");
    expect(none).toContain("replay any time");

    const all = debrief(linux, finishedRun(linux, [secret?.id ?? "", bonus?.id ?? ""]));
    expect(all).toContain("1 of 1 secret found");
    expect(all).toContain(`: ${secret?.name}`);
    expect(all).not.toContain("replay any time");
  });

  it("never mentions hints, however many were used", () => {
    expect(debrief(linux, finishedRun(linux, []))).not.toMatch(/\bhints?\b/i);
  });

  it("points Next mission along the chapter, and says when a new chapter starts", () => {
    const text = debrief(linux, finishedRun(linux, []), {
      ...NO_LINKS,
      chapter: { number: 1, title: "First shift", episode: 2 },
      next: { slug: "net-01", title: "Mapping the network" },
    });
    expect(text).toContain("Next mission: Mapping the network");

    const crossing = debrief(linux, finishedRun(linux, []), {
      ...NO_LINKS,
      next: {
        slug: "net-02",
        title: "Curtain call",
        startsChapter: { number: 2, title: "Second shift" },
      },
    });
    expect(crossing).toContain("Chapter 2, Second shift, starts with the next mission.");
  });

  it("closes the campaign with what's next and a way back to the map", () => {
    const net = mission("net-01");
    const text = debrief(net, finishedRun(net, []), {
      ...NO_LINKS,
      chapter: { number: 1, title: "First shift", episode: 3 },
      campaignEnd: "Chapter 2 is being written.",
    });
    expect(text).toContain("Chapter 2 is being written.");
    expect(text).toContain("Back to the campaign");
  });
});

describe("the briefing", () => {
  it("shows Best after, the chapter, and that every mission is open", () => {
    const html = renderToStaticMarkup(
      createElement(MissionRunner, {
        mission: mission("net-01"),
        links: {
          ...NO_LINKS,
          bestAfter: [{ slug: "linux-01", title: "Reading the machine" }],
          chapter: { number: 1, title: "First shift", episode: 3 },
        },
      }),
    ).replace(/&#x27;/g, "'");
    expect(html).toContain('href="/missions/linux-01"');
    expect(html).toContain("Best after:");
    expect(html).toContain("Every mission is open, so you can start here too.");
    expect(html).toContain("Chapter 1: First shift, episode 3");
    expect(html).toContain("Skills you'll practise");
  });
});
