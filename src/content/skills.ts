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

/**
 * Which picture goes with a skill. Content can't import React, so a skill names its icon and the
 * UI draws it (`SkillBadge` in the missions feature). Every icon sits next to the skill's name:
 * the picture never carries the meaning alone.
 */
export const SKILL_ICON_IDS = [
  "terminal",
  "network",
  "globe",
  "key",
  "footprints",
  "shield",
] as const;

export type SkillIcon = (typeof SKILL_ICON_IDS)[number];

export interface SkillInfo {
  readonly id: Skill;
  /** Shown on filters, mission cards, the campaign map and the debrief. */
  readonly label: string;
  /** What practising this skill means, in one line of words a beginner already knows. */
  readonly description: string;
  readonly icon: SkillIcon;
}

export const SKILLS: Readonly<Record<Skill, SkillInfo>> = {
  linux: {
    id: "linux",
    label: "Linux",
    description: "Finding your way around files, folders, users and commands on a server",
    icon: "terminal",
  },
  networking: {
    id: "networking",
    label: "Networking",
    description: "Finding the computers on a network and what each one offers",
    icon: "network",
  },
  web: {
    id: "web",
    label: "The web",
    description: "Looking at how websites answer, and spotting what they give away",
    icon: "globe",
  },
  crypto: {
    id: "crypto",
    label: "Cryptography",
    description: "Recognising how passwords and secrets are scrambled and stored",
    icon: "key",
  },
  forensics: {
    id: "forensics",
    label: "Forensics",
    description: "Working out what happened on a computer from the traces left behind",
    icon: "footprints",
  },
  "blue-team": {
    id: "blue-team",
    label: "Defending",
    description: "Fixing weak spots and making sure they stay fixed",
    icon: "shield",
  },
};

/** The skills in their fixed order, for keys and legends. */
export const SKILL_LIST: readonly SkillInfo[] = SKILL_IDS.map((id) => SKILLS[id]);
