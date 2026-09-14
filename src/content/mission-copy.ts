import type { Mission, ObjectiveCheck } from "./schemas/mission";

/**
 * Every string a learner reads in a mission, with where it's written, so tests can hold mission
 * copy to md-files/voice-and-tone.md (for example, `findBannedWords` from src/content/voice.ts).
 *
 * The scenario's file contents, web pages and service banners are left out on purpose: they're
 * realistic terminal output, the one place the banned words may appear. So are accepted answers
 * with no choices, which the learner types and never sees.
 */

export interface MissionCopy {
  /** Where the text lives in the mission file: `objectives[find-note].why`, `story[2].text`. */
  readonly path: string;
  readonly text: string;
}

export function missionCopy(mission: Mission): MissionCopy[] {
  const copy: MissionCopy[] = [];
  const add = (path: string, text: string) => copy.push({ path, text });

  add("title", mission.title);
  add("hook", mission.hook);
  mission.learningGoals.forEach((goal, index) => add(`learningGoals[${index + 1}]`, goal));
  add("briefing.scenario", mission.briefing.scenario);
  add("briefing.role", mission.briefing.role);
  add("briefing.authorization", mission.briefing.authorization);
  mission.story.forEach((beat, index) => add(`story[${index + 1}].text`, beat.text));

  for (const objective of mission.objectives) {
    const at = `objectives[${objective.id}]`;
    if (objective.name !== undefined) add(`${at}.name`, objective.name);
    add(`${at}.description`, objective.description);
    add(`${at}.why`, objective.why);
    add(`${at}.success`, objective.success);
    checkCopy(objective.check, `${at}.check`, add);
  }

  for (const [objectiveId, tiers] of Object.entries(mission.hints)) {
    tiers.forEach((hint, index) => add(`hints.${objectiveId}[${index + 1}]`, hint));
  }

  const { debrief } = mission;
  add("debrief.summary", debrief.summary);
  debrief.whatYouLearned.forEach((line, index) =>
    add(`debrief.whatYouLearned[${index + 1}]`, line),
  );
  add("debrief.ethicsNote", debrief.ethicsNote);
  add("debrief.defensiveTakeaway", debrief.defensiveTakeaway);
  add("debrief.nextTease", debrief.nextTease);

  return copy;
}

/** Choices are shown as buttons, and their replies as character lines. */
function checkCopy(
  check: ObjectiveCheck,
  path: string,
  add: (path: string, text: string) => void,
): void {
  switch (check.kind) {
    case "answer":
      check.choices?.forEach((choice, index) => {
        add(`${path}.choices[${index + 1}].text`, choice.text);
        if (choice.reply) add(`${path}.choices[${index + 1}].reply.text`, choice.reply.text);
      });
      return;
    case "all":
    case "any":
      check.of.forEach((inner, index) => checkCopy(inner, `${path}.of[${index + 1}]`, add));
      return;
    default:
      return;
  }
}
