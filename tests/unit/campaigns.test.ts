import { describe, expect, it } from "vitest";
import {
  bestAfter,
  campaignMissionIds,
  campaignProblems,
  CAMPAIGNS,
  chapterOf,
  MAIN_CAMPAIGN,
  nextMission,
  startHereMissionId,
} from "@/content/campaigns";
import { CampaignSchema, type Campaign, type CampaignInput } from "@/content/schemas/campaign";
import { SKILL_ICON_IDS, SKILL_IDS, SKILL_LIST, SKILLS } from "@/content/skills";
import { findBannedWords } from "@/content/voice";
import { loadMissionCatalog } from "@/features/missions/server";
import { FIRST_STEP } from "@/lib/next-step";

/**
 * Campaigns as data (md-files/08-campaign-and-story.md, prompt 08.1): every campaign points at
 * real missions, the helpers follow chapter order across chapter boundaries, "Best after" comes
 * from prerequisites, and nothing is ever locked.
 */

const catalog = loadMissionCatalog();
const missionIds = catalog.missions.map((mission) => mission.id);

/** Two chapters with made-up mission ids, for the helpers. */
const TWO_CHAPTERS: Campaign = CampaignSchema.parse({
  id: "fixture",
  title: "Fixture campaign",
  description: "Two chapters, for the helper tests.",
  chapters: [
    {
      id: "one",
      title: "One",
      narrative: "The first chapter.",
      lines: [{ speaker: "mentor-noor", text: "Chapter one." }],
      missions: ["a-01", "a-02"],
    },
    {
      id: "two",
      title: "Two",
      narrative: "The second chapter.",
      lines: [{ speaker: "teammate-theo", text: "Chapter two." }],
      missions: ["b-01", "b-02"],
    },
  ],
} satisfies CampaignInput);

describe("the campaigns", () => {
  it.each(CAMPAIGNS.map((campaign) => [campaign.id, campaign] as const))(
    "%s points only at missions that exist",
    (_id, campaign) => {
      expect(campaignProblems(campaign, missionIds)).toEqual([]);
    },
  );

  it("fails the check when a campaign names a mission that doesn't exist", () => {
    const broken = CampaignSchema.parse({
      ...MAIN_CAMPAIGN,
      chapters: [{ ...MAIN_CAMPAIGN.chapters[0], missions: ["intro-01", "net-99"] }],
    });
    expect(campaignProblems(broken, missionIds)).toEqual([
      'campaign main → chapter first-shift: there\'s no mission with the id "net-99".',
    ]);
  });

  it("opens Chapter 1 with intro-01, where Start here and the landing page point", () => {
    expect(MAIN_CAMPAIGN.chapters[0]?.missions).toEqual(["intro-01", "linux-01", "net-01"]);
    expect(startHereMissionId(MAIN_CAMPAIGN)).toBe("intro-01");
    expect(FIRST_STEP.href).toBe(`/missions/${startHereMissionId(MAIN_CAMPAIGN)}`);
  });

  it("gives every Chapter 1 mission at least one bonus objective and one secret", () => {
    for (const id of MAIN_CAMPAIGN.chapters[0]?.missions ?? []) {
      const mission = catalog.getMissionById(id);
      const bonus = mission?.objectives.filter(
        (objective) => objective.optional && !objective.hidden,
      );
      const secrets = mission?.objectives.filter((objective) => objective.hidden);
      expect(bonus?.length, id).toBeGreaterThan(0);
      expect(secrets?.length, id).toBeGreaterThan(0);
    }
  });

  it("follows the voice-and-tone rules in every line", () => {
    for (const campaign of CAMPAIGNS) {
      const copy = [
        campaign.title,
        campaign.description,
        campaign.upNext ?? "",
        ...campaign.chapters.flatMap((chapter) => [
          chapter.title,
          chapter.narrative,
          ...chapter.lines.map((line) => line.text),
          chapter.closing?.text ?? "",
        ]),
      ];
      expect(copy.flatMap(findBannedWords)).toEqual([]);
    }
  });

  const chapter = (id: string, speaker: string, missions: string[]) => ({
    id,
    title: id,
    narrative: "A chapter.",
    lines: [{ speaker, text: "Hello." }],
    missions,
  });
  const messagesFor = (chapters: unknown[]) =>
    CampaignSchema.safeParse({
      id: "bad",
      title: "Bad",
      description: "Bad.",
      chapters,
    }).error?.issues.map((issue) => issue.message) ?? [];

  it("rejects a speaker outside the cast", () => {
    // The Hollow Latch never speak (md-files/story-bible.md), so they have no speaker id.
    expect(messagesFor([chapter("one", "hollow-latch", ["a-01"])])).toEqual([
      expect.stringContaining("Use a speaker from the cast"),
    ]);
  });

  it("rejects a mission placed in two chapters", () => {
    expect(
      messagesFor([
        chapter("one", "mentor-noor", ["a-01"]),
        chapter("two", "teammate-kit", ["a-01"]),
      ]),
    ).toEqual(['"a-01" is already in chapter "one". A mission belongs to one chapter.']);
  });
});

describe("nextMission", () => {
  it("walks the chapter in order", () => {
    expect(nextMission(TWO_CHAPTERS, "a-01")).toMatchObject({
      missionId: "a-02",
      chapterNumber: 1,
      episode: 2,
      startsChapter: false,
    });
  });

  it("crosses into the next chapter after a chapter's last mission", () => {
    expect(nextMission(TWO_CHAPTERS, "a-02")).toMatchObject({
      missionId: "b-01",
      chapterNumber: 2,
      episode: 1,
      startsChapter: true,
    });
    expect(nextMission(TWO_CHAPTERS, "a-02")?.chapter.id).toBe("two");
  });

  it("has nothing after the campaign's last mission, or for a mission outside it", () => {
    expect(nextMission(TWO_CHAPTERS, "b-02")).toBeUndefined();
    expect(nextMission(TWO_CHAPTERS, "z-99")).toBeUndefined();
  });

  it("plays Chapter 1 in story order", () => {
    expect(nextMission(MAIN_CAMPAIGN, "intro-01")?.missionId).toBe("linux-01");
    expect(nextMission(MAIN_CAMPAIGN, "linux-01")?.missionId).toBe("net-01");
  });

  it("finds each mission's chapter and episode", () => {
    expect(campaignMissionIds(TWO_CHAPTERS)).toEqual(["a-01", "a-02", "b-01", "b-02"]);
    expect(chapterOf(TWO_CHAPTERS, "b-02")).toMatchObject({ chapterNumber: 2, episode: 2 });
    expect(chapterOf(TWO_CHAPTERS, "nope")).toBeUndefined();
  });
});

describe("bestAfter", () => {
  const missions = [
    { id: "m-1", prerequisites: [] },
    { id: "m-2", prerequisites: ["m-1"] },
    { id: "m-3", prerequisites: ["m-2", "gone", "m-1"] },
  ];

  it("lists the missions a mission's prerequisites name, in the order written", () => {
    expect(bestAfter("m-3", missions).map((mission) => mission.id)).toEqual(["m-2", "m-1"]);
    expect(bestAfter("m-1", missions)).toEqual([]);
    expect(bestAfter("unknown", missions)).toEqual([]);
  });

  it("matches the real missions' prerequisites", () => {
    expect(bestAfter("net-01", catalog.missions).map((mission) => mission.id)).toEqual([
      "linux-01",
    ]);
  });
});

describe("the skill taxonomy's display metadata", () => {
  it("gives every skill a name, a one-line beginner description and an icon", () => {
    expect(SKILL_LIST.map((skill) => skill.id)).toEqual([...SKILL_IDS]);
    for (const id of SKILL_IDS) {
      const skill = SKILLS[id];
      expect(skill.id).toBe(id);
      expect(skill.label.length).toBeGreaterThan(0);
      expect(skill.description).not.toMatch(/[\r\n]/);
      expect(findBannedWords(skill.description)).toEqual([]);
      expect(SKILL_ICON_IDS).toContain(skill.icon);
    }
  });
});
