/**
 * The mission feature's public API for client and server code alike: objective evaluation and
 * progress, the in-memory run (its pure reducer, headless play, and the React store), and the
 * runner UI. Loading missions and playthroughs reads files, so it lives in
 * `@/features/missions/server`.
 *
 * Missions themselves (their schema and types, the cast, the skills) are content: import those
 * from `@/content`.
 */
export {
  eventMatches,
  evaluateObjectives,
  isMissionComplete,
  mainObjectives,
  missionProgress,
  type ObjectiveProgress,
  type SubmittedAnswers,
} from "./evaluate";

export {
  canAnswer,
  createMissionRun,
  currentObjective,
  HINT_TIERS,
  isRunInProgress,
  missionRunReducer,
  rewardSummary,
  visibleObjectives,
  type AnswerFeedback,
  type MissionPhase,
  type MissionRunAction,
  type MissionRunState,
  type RewardSummary,
  type StoryEntry,
} from "./run/mission-run";
export { useMissionRun, type MissionRun } from "./run/use-mission-run";
export {
  formatPlaythrough,
  playMission,
  type PlayResult,
  type PlayStep,
  type PlayStepResult,
} from "./run/play";
export { verifyPlaythrough, type PlaythroughCheck } from "./run/verify";

export { MissionRunner, type MissionRunnerProps } from "./components/mission-runner";
export { MissionList } from "./components/mission-list";
export { summarizeMission, type MissionSummary } from "./components/mission-summary";
export { DIFFICULTY_LABELS, MissionText } from "./components/mission-text";
export type { LessonLink, MissionLink, MissionLinks, MissionRunStatus } from "./components/types";
