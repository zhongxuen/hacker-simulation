/**
 * Where the "Start here" button takes the learner, so a beginner never has to decide where to go.
 */
export interface NextStep {
  readonly href: string;
  /** The step's name, as the learner sees it. */
  readonly title: string;
  /** One short line of context under the title. */
  readonly detail: string;
}

/**
 * The first mission. Nothing is saved between visits (md-files/03-app-state-and-privacy.md), so
 * every visit starts here: the campaign is a recommended order, not a record of progress.
 */
export const FIRST_STEP: NextStep = {
  href: "/missions/intro-01",
  title: "Welcome to the team",
  detail: "Your first mission, about 8 minutes",
};
