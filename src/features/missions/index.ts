/**
 * The mission feature's public API for client and server code alike: objective evaluation and
 * progress. Loading missions reads files, so it lives in `@/features/missions/server`.
 *
 * Missions themselves (their schema and types, the cast, the skills) are content: import those
 * from `@/content`.
 */
export {
  evaluateObjectives,
  isMissionComplete,
  mainObjectives,
  missionProgress,
  type ObjectiveProgress,
  type SubmittedAnswers,
} from "./evaluate";
