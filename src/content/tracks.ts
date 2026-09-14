/**
 * The Learning Center's tracks: short, ordered paths through the lessons
 * (md-files/09-learning-center.md, '"Start Here" track'). A track is a recommendation, never a
 * gate: nothing is saved (md-files/03-app-state-and-privacy.md), so every lesson is open, and the
 * track never nags about lessons skipped.
 *
 * tests/unit/lesson-content.test.ts checks that every id here is a real lesson, in order, and that
 * the Start Here track is level 0 and ends by handing off to the first mission.
 */

export interface Track {
  readonly id: string;
  readonly title: string;
  /** One line for someone deciding where to begin. */
  readonly description: string;
  /** Lesson ids, in reading order. */
  readonly lessons: readonly string[];
}

export const START_HERE: Track = {
  id: "start-here",
  title: "Start here",
  description:
    "Six short lessons for someone who has never studied computers. About 3 minutes each, and each one ends with something to try.",
  lessons: [
    "start-ethical-hacking",
    "start-computer",
    "start-terminal",
    "start-network",
    "start-internet",
    "start-how-to-learn",
  ],
};

export const TRACKS: readonly Track[] = [START_HERE];
