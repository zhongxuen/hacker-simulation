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

/**
 * Everything the runner links to, resolved by the page from the mission's own data: its
 * prerequisites ("Best after"), its concepts and further reading (lessons), and the next mission.
 * The runner never looks any of it up by mission id itself.
 */
export interface MissionLinks {
  readonly bestAfter: readonly MissionLink[];
  readonly concepts: readonly LessonLink[];
  readonly furtherReading: readonly LessonLink[];
  /** The mission to play next, or null at the end of the line. */
  readonly next: MissionLink | null;
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
