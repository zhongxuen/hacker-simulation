/**
 * The product's top-level sections, in sidebar order.
 *
 * Every section has a plain-language subtitle, so someone who has never heard the word "sandbox"
 * knows what's there before clicking (md-files/02-design-system-and-app-shell.md).
 */

export type AppSectionId =
  "campaign" | "missions" | "sandbox" | "terminal" | "network" | "learn" | "settings";

export interface AppSection {
  readonly id: AppSectionId;
  readonly href: string;
  /** The nav label and the top bar title. */
  readonly label: string;
  /** What the section is for, in words a beginner already knows. */
  readonly subtitle: string;
  /** Other words a learner might search the command palette with. */
  readonly keywords: readonly string[];
}

export const APP_SECTIONS: readonly AppSection[] = [
  {
    id: "campaign",
    href: "/campaign",
    label: "Campaign",
    subtitle: "Your story, one mission at a time",
    keywords: ["story", "chapters", "path"],
  },
  {
    id: "missions",
    href: "/missions",
    label: "Missions",
    subtitle: "Story episodes, 5 to 20 minutes",
    keywords: ["episodes", "play", "tasks"],
  },
  {
    id: "sandbox",
    href: "/sandbox",
    label: "Sandbox",
    subtitle: "Practice freely, nothing can break",
    keywords: ["practice", "playground", "try"],
  },
  {
    id: "terminal",
    href: "/terminal",
    label: "Terminal",
    subtitle: "Control a computer by typing",
    keywords: ["command line", "commands", "shell", "console"],
  },
  {
    id: "network",
    href: "/network",
    label: "Network",
    subtitle: "See what you've discovered",
    keywords: ["map", "computers", "topology"],
  },
  {
    id: "learn",
    href: "/learn",
    label: "Learn",
    subtitle: "Every idea explained in plain words",
    keywords: ["lessons", "guides", "glossary", "help"],
  },
  {
    id: "settings",
    href: "/settings",
    label: "Settings",
    subtitle: "Change how the app works",
    keywords: ["preferences", "options", "animations", "motion"],
  },
];

export function getAppSection(id: AppSectionId): AppSection {
  const section = APP_SECTIONS.find((candidate) => candidate.id === id);
  if (!section) throw new Error(`Unknown app section "${id}".`);
  return section;
}

/** The section a pathname is in (`/missions/intro-01` is in Missions), or undefined if none. */
export function sectionForPathname(pathname: string): AppSection | undefined {
  return APP_SECTIONS.find(
    (section) => pathname === section.href || pathname.startsWith(`${section.href}/`),
  );
}
