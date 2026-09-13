/**
 * The fixed skill taxonomy (improvement #9 in md-files/00-overview-and-improvements.md). Every
 * mission is tagged with the skills it practises: the mission list filters by them, the debrief
 * names them, and the Learning Center cross-links through them.
 *
 * The list is fixed on purpose. A new skill is a product decision, not something one mission adds
 * for itself, so mission files can only pick from these. Ids are hyphenated to match every other
 * content id (`blue-team`, like the lesson topic of the same name).
 */

export const SKILL_IDS = [
  "linux",
  "networking",
  "web",
  "crypto",
  "forensics",
  "blue-team",
] as const;

export type Skill = (typeof SKILL_IDS)[number];

export interface SkillInfo {
  readonly id: Skill;
  /** Shown on filters, mission cards and the debrief. */
  readonly label: string;
  /** What practising this skill means, in words a beginner already knows. */
  readonly description: string;
}

export const SKILLS: Readonly<Record<Skill, SkillInfo>> = {
  linux: {
    id: "linux",
    label: "Linux",
    description: "Finding your way around files, folders, users and commands on a server",
  },
  networking: {
    id: "networking",
    label: "Networking",
    description: "Finding the computers on a network and what each one offers",
  },
  web: {
    id: "web",
    label: "The web",
    description: "Looking at how websites answer, and spotting what they give away",
  },
  crypto: {
    id: "crypto",
    label: "Cryptography",
    description: "Recognising how passwords and secrets are scrambled and stored",
  },
  forensics: {
    id: "forensics",
    label: "Forensics",
    description: "Working out what happened on a computer from the traces left behind",
  },
  "blue-team": {
    id: "blue-team",
    label: "Defending",
    description: "Fixing weak spots and making sure they stay fixed",
  },
};
