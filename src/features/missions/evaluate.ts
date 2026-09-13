import {
  normalizeAnswer,
  type FileStateCheck,
  type Mission,
  type Objective,
  type ObjectiveCheck,
} from "@/content/schemas/mission";
import { inspectPath, userCanAccess, type SimEvent, type SimState } from "@/sim";

/**
 * Objective evaluation (md-files/06-mission-system.md, "Grading flow" and prompt 06.3).
 *
 * One pure function turns a mission, the engine's state, the events so far, and the learner's
 * submitted answers into the objectives that are done. It runs in the browser after every
 * command, and the same code runs in tests and headless play. No server, no storage.
 *
 * It reports what is satisfied *now*. A file check can become false again (fix a file, then break
 * it), so the in-memory mission run (prompt 06.4) keeps the union of every tick it has seen: once
 * earned, a tick stays. Event and command checks look at the whole event stream, so pass every
 * event of the run, not only the last command's.
 */

/** What the learner has submitted for each answer objective, by objective id, oldest first. */
export type SubmittedAnswers = Readonly<Record<string, readonly string[]>>;

/** Ids of the objectives whose checks hold, in the mission's objective order. */
export function evaluateObjectives(
  mission: Pick<Mission, "objectives">,
  state: SimState,
  events: readonly SimEvent[],
  answers: SubmittedAnswers = {},
): string[] {
  return mission.objectives
    .filter((objective) =>
      holds(objective.check, {
        state,
        events,
        answers: Object.hasOwn(answers, objective.id) ? (answers[objective.id] ?? []) : [],
      }),
    )
    .map((objective) => objective.id);
}

interface EvaluationContext {
  readonly state: SimState;
  readonly events: readonly SimEvent[];
  /** Answers submitted for the objective being checked. */
  readonly answers: readonly string[];
}

function holds(check: ObjectiveCheck, ctx: EvaluationContext): boolean {
  switch (check.kind) {
    case "event":
      return ctx.events.some((event) => event.type === check.event && matches(event, check.match));
    case "answer": {
      const accepted = new Set(check.accept.map(normalizeAnswer));
      return ctx.answers.some((answer) => accepted.has(normalizeAnswer(answer)));
    }
    case "fileState":
      return fileHolds(check, ctx.state);
    case "commandRun": {
      const pattern = compiled(check.pattern);
      return ctx.events.some(
        (event) =>
          event.type === "command.run" &&
          (check.anyExitCode === true || event.exitCode === 0) &&
          pattern.test(event.line),
      );
    }
    case "all":
      return check.of.every((inner) => holds(inner, ctx));
    case "any":
      return check.of.some((inner) => holds(inner, ctx));
  }
}

/** Every `match` field equals the event's field of the same name (strict equality). */
function matches(
  event: SimEvent,
  match: Readonly<Record<string, string | number | boolean>> | undefined,
): boolean {
  if (!match) return true;
  const fields: ReadonlyMap<string, unknown> = new Map(Object.entries(event));
  return Object.entries(match).every(
    ([key, value]) => fields.has(key) && fields.get(key) === value,
  );
}

/** Compiled once per pattern. Patterns have no flags, so `test` keeps no state between calls. */
const patterns = new Map<string, RegExp>();

function compiled(pattern: string): RegExp {
  let regex = patterns.get(pattern);
  if (!regex) {
    regex = new RegExp(pattern);
    patterns.set(pattern, regex);
  }
  return regex;
}

const octal = (mode: string) => Number.parseInt(mode, 8);

/**
 * Checks a file against its predicate on the check's host (the learner's own by default). The
 * file is looked at as root, following symlinks unless the predicate asks for `type: symlink`.
 * `readableBy` and `notReadableBy` ask the engine's permission rules for that user, following
 * symlinks the way reading the file would.
 */
function fileHolds(check: FileStateCheck, state: SimState): boolean {
  const { predicate } = check;
  const hostId = check.host ?? state.session.hostId;
  const info = inspectPath(state, hostId, check.path, { follow: predicate.type !== "symlink" });
  if (predicate.exists === false) return !info.exists;
  if (!info.exists) return false;

  const mode = info.mode & 0o7777;
  const canRead = (user: string) => userCanAccess(state, hostId, user, check.path, "r");
  return (
    (predicate.type === undefined || info.kind === predicate.type) &&
    (predicate.mode === undefined || mode === octal(predicate.mode)) &&
    (predicate.modeIncludes === undefined ||
      (mode & octal(predicate.modeIncludes)) === octal(predicate.modeIncludes)) &&
    (predicate.modeExcludes === undefined || (mode & octal(predicate.modeExcludes)) === 0) &&
    (predicate.owner === undefined || info.owner === predicate.owner) &&
    (predicate.group === undefined || info.group === predicate.group) &&
    (predicate.contains === undefined ||
      (info.content !== undefined && info.content.includes(predicate.contains))) &&
    (predicate.notContains === undefined ||
      (info.content !== undefined && !info.content.includes(predicate.notContains))) &&
    (predicate.readableBy === undefined || canRead(predicate.readableBy)) &&
    (predicate.notReadableBy === undefined || !canRead(predicate.notReadableBy))
  );
}

// ---------------------------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------------------------

/** The objectives a mission needs: not bonus, not hidden (hidden objectives are optional). */
export function mainObjectives(mission: Pick<Mission, "objectives">): Objective[] {
  return mission.objectives.filter((objective) => !objective.optional);
}

/** True when every main objective is complete. Bonus and hidden objectives never block it. */
export function isMissionComplete(
  mission: Pick<Mission, "objectives">,
  completedIds: Iterable<string>,
): boolean {
  const done = new Set(completedIds);
  return mainObjectives(mission).every((objective) => done.has(objective.id));
}

export interface ObjectiveProgress {
  /** Main objectives completed. */
  readonly done: number;
  /** Main objectives in the mission. */
  readonly total: number;
}

/** Main objectives done out of total, for the top bar's `ShowMissionProgress`. */
export function missionProgress(
  mission: Pick<Mission, "objectives">,
  completedIds: Iterable<string>,
): ObjectiveProgress {
  const done = new Set(completedIds);
  const main = mainObjectives(mission);
  return { done: main.filter((objective) => done.has(objective.id)).length, total: main.length };
}
