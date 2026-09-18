import { CampaignSchema, type Campaign } from "../schemas/campaign";

/**
 * The main campaign: Candlewright Security's cases, in the order the story tells them
 * (md-files/remaining.md, Part 2, "The story world"). A recommendation, never a gate: every mission
 * is open from the start, and a learner may play any of them first.
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
    {
      id: "the-handover",
      title: "The handover",
      narrative:
        "The note at the theatre and a quiet week at a library turn out to be the same story. You look at how a password eleven people share protects none of them, then rebuild four nights from the records a computer keeps by itself — and find that the person who opened the door and the person who walked through it were not the same person.",
      lines: [
        {
          speaker: "teammate-theo",
          text: "Two streets from the bakery, a community theatre found a note on its box office computer. They've asked us to look, and their committee signed this morning.",
        },
        {
          speaker: "teammate-kit",
          text: "Whoever left it wanted us to know they'd been there. I would very much like to know who they are. Theo says that's where I stop, and Theo's right.",
        },
      ],
      missions: ["crypto-01", "forensics-01"],
      closing: {
        speaker: "teammate-idris",
        text: "Two timelines, one account name. The theatre and the library were never two cases. Somebody finds the doors, somebody else walks through them — and there's a third address in the library's logs belonging to people who haven't noticed yet.",
      },
    },
  ],
  upNext:
    "Chapter 3 isn't written yet. It starts with that third address: people who never asked us for help, whose name we read in somebody else's log file. Theo has to pick up the phone and explain himself, and they get to say no. Until it's here, every mission stays open to play again, and each one hides a secret or two.",
});
