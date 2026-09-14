import type { MissionPhase } from "../run/mission-run";

/** A link to another mission, resolved on the server from the catalog. */
export interface MissionLink {
  readonly slug: string;
  readonly title: string;
}

/** A link to a lesson, resolved on the server from the lesson catalog. */
export interface LessonLink {
  readonly id: string;
  readonly title: string;
}

/** Where a mission sits in the campaign: "Chapter 1: First shift · Episode 2". */
export interface ChapterLink {
  readonly number: number;
  readonly title: string;
  readonly episode: number;
}

/** The mission to play next, and the chapter it opens when it starts a new one. */
export interface NextMissionLink extends MissionLink {
  readonly startsChapter?: { readonly number: number; readonly title: string };
}

/**
 * Everything the runner links to, resolved by the page from the mission's own data and the
 * campaign: its prerequisites ("Best after"), its concepts and further reading (lessons), where it
 * sits in the campaign, and the next mission in chapter order. The runner never looks any of it up
 * by mission id itself.
 */
export interface MissionLinks {
  readonly bestAfter: readonly MissionLink[];
  readonly concepts: readonly LessonLink[];
  readonly furtherReading: readonly LessonLink[];
  /** The mission's chapter and episode, when it's part of the campaign. */
  readonly chapter?: ChapterLink;
  /** The mission to play next, or null at the end of the line. */
  readonly next: NextMissionLink | null;
  /** At the end of the campaign: what's coming next (the campaign's `upNext`). */
  readonly campaignEnd?: string;
}

/** What the page around the runner needs: the top bar's progress and the leave guard. */
export interface MissionRunStatus {
  readonly phase: MissionPhase;
  /** In the workspace with main objectives still open: leaving would lose the run. */
  readonly inProgress: boolean;
  /** Main objectives done, and in total. */
  readonly done: number;
  readonly total: number;
}
