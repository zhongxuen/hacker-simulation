import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { campaignMissionIds, MAIN_CAMPAIGN } from "@/content/campaigns";
import { CampaignSchema } from "@/content/schemas/campaign";
import { findBannedWords } from "@/content/voice";
import { CampaignMap, summarizeMission } from "@/features/missions";
import { loadMissionCatalog } from "@/features/missions/server";

/**
 * The campaign map (md-files/08-campaign-and-story.md, prompt 08.2), rendered to HTML in plain
 * Node: it comes entirely from the campaign data, every mission can be started from it, the first
 * one is marked "Start here", and nothing is locked or marked done.
 */

const catalog = loadMissionCatalog();
const titles = new Map(catalog.missions.map((mission) => [mission.id, mission.title]));
const summaries = catalog.missions.map((mission) => summarizeMission(mission, titles));

const render = (campaign = MAIN_CAMPAIGN) =>
  renderToStaticMarkup(createElement(CampaignMap, { campaign, missions: summaries }));

const html = render();
const text = html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'");

describe("CampaignMap", () => {
  it("shows every chapter with its framing and its cast lines", () => {
    for (const [index, chapter] of MAIN_CAMPAIGN.chapters.entries()) {
      expect(text).toContain(`Chapter ${index + 1}`);
      expect(text).toContain(chapter.title);
      for (const line of chapter.lines) {
        expect(text).toContain(line.text.replace(/`/g, " ").split(" ")[0]);
      }
    }
    expect(text).toContain("Noor Halvorsen");
    expect(text).toContain("Roz Kowalczyk");
  });

  it("links to every mission in the campaign, in order", () => {
    const links = [...html.matchAll(/href="\/missions\/([a-z0-9-]+)"/g)].map((match) => match[1]);
    // The Start here entry comes first, then every episode in chapter order.
    expect(links).toEqual(["intro-01", ...campaignMissionIds(MAIN_CAMPAIGN)]);
  });

  it("marks the first mission Start here, and offers a big way in", () => {
    expect(text).toContain("Not sure where to begin? Start here.");
    expect(text).toContain("Start your first mission");
    expect((html.match(/>Start here</g) ?? []).length).toBe(1);
  });

  it("has no locked or completed states", () => {
    expect(text).not.toMatch(/\b(locked|unlock|completed|progress|XP|streak)\b/i);
  });

  it("shows each mission's hook, time, level and skills", () => {
    for (const id of campaignMissionIds(MAIN_CAMPAIGN)) {
      const mission = catalog.getMissionById(id);
      expect(text).toContain(mission?.title);
      expect(text).toContain(`About ${mission?.estimatedMinutes} min`);
    }
    for (const skill of ["Linux", "Networking", "Defending"]) expect(text).toContain(skill);
  });

  it("follows the voice-and-tone rules", () => {
    expect(findBannedWords(text)).toEqual([]);
  });

  it("draws whatever chapters the data has", () => {
    const second = CampaignSchema.parse({
      ...MAIN_CAMPAIGN,
      chapters: [
        ...MAIN_CAMPAIGN.chapters,
        {
          id: "second-shift",
          title: "Second shift",
          narrative: "A made-up chapter, to prove nothing is hardcoded.",
          lines: [{ speaker: "teammate-kit", text: "Round two!" }],
          // Not a real mission: the map skips ids it has no card for.
          missions: ["a-99"],
        },
      ],
    });
    const extra = render(second);
    expect(extra).toContain("Chapter 2");
    expect(extra).toContain("Second shift");
    expect(extra).toContain("Round two!");
  });
});
