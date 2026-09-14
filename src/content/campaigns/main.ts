import { CampaignSchema, type Campaign } from "../schemas/campaign";

/**
 * The main campaign: Candlewright Security's cases, in the order the story tells them
 * (md-files/story-bible.md, "Chapter 1"). A recommendation, never a gate: every mission is open
 * from the start, and a learner may play any of them first.
 *
 * Parsed on import, so a malformed campaign fails loudly the first time anything uses it.
 * tests/unit/campaigns.test.ts also checks every mission id against the mission files.
 */
export const MAIN_CAMPAIGN: Campaign = CampaignSchema.parse({
  id: "main",
  title: "Your first cases at Candlewright",
  description:
    "You're the newest recruit at Candlewright Security, a small team of good-guy hackers. Organisations ask the team to find their weak spots before someone else does, and sign a letter saying exactly what may be tested.",
  chapters: [
    {
      id: "first-shift",
      title: "First shift",
      narrative:
        "Your first week at Candlewright. You learn the rules on the Range, the team's practice lab, then take your first real case: a bakery whose order server is acting strangely.",
      lines: [
        {
          speaker: "mentor-noor",
          text: "Welcome to Candlewright! I'm Noor, your mentor. We find weak spots in computers before anyone else does, and only when the owner asks us to.",
        },
        {
          speaker: "client-roz",
          text: "I bake bread. I don't know what a port is. I want to know nobody's poking around in my ordering system.",
        },
      ],
      missions: ["intro-01", "linux-01", "net-01"],
      closing: {
        speaker: "teammate-idris",
        text: "I've found another note signed `- HL`. This one is on a community theatre's box office computer, two streets away.",
      },
    },
  ],
  upNext:
    "Chapter 2 is being written. Until then, every mission here is open to play again, and most of them hide a secret or two.",
});
