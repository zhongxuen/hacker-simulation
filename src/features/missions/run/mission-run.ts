import type { AnswerCheck, Mission, Objective, StoryBeat } from "@/content/schemas/mission";
import { normalizeAnswer } from "@/content/schemas/mission-helpers";
import type { SimEvent, SimState } from "@/sim/types";
import { evaluateObjectives, eventMatches, isMissionComplete } from "../evaluate";

/**
 * One mission run, as pure data (md-files/06-mission-system.md prompt 06.4, and
 * md-files/03-app-state-and-privacy.md, "Keep the door open, cheaply"): the phase, the engine's
 * latest state, every event since the run started, the answers submitted, the ticks earned, the
 * story beats played, and the hints shown. Everything that changes it is `missionRunReducer`, so
 * the React store (useMissionRun), headless play (`pnpm mission:play`) and the tests all run the
 * same code.
 *
 * It lives in memory only. Nothing here is ever written to storage: leaving or reloading the page
 * ends the run.
 */

export type MissionPhase = "briefing" | "workspace" | "debrief";

/** A line in the mission's story feed: a story beat, or a character's reply to a choice. */
export interface StoryEntry {
  readonly id: number;
  readonly kind: "beat" | "reply";
  readonly speaker: StoryBeat["speaker"];
  readonly text: string;
}

/** What happened to the learner's latest answer for an objective. */
export interface AnswerFeedback {
  readonly answer: string;
  readonly accepted: boolean;
  /** A character's reply, for a choice that has one. */
  readonly reply?: { readonly speaker: StoryBeat["speaker"]; readonly text: string };
}

export interface MissionRunState {
  readonly phase: MissionPhase;
  /** Goes up with every restart, so the terminal starts a fresh session. */
  readonly attempt: number;
  /** The engine's latest state: null until the run starts. */
  readonly sim: SimState | null;
  /** Every event since the run started, across machine resets: event checks look at all of them. */
  readonly events: readonly SimEvent[];
  /** Answers submitted, by objective id, oldest first. */
  readonly answers: Readonly<Record<string, readonly string[]>>;
  /** Objectives ticked, in the order they were ticked. Once earned, a tick stays. */
  readonly completed: readonly string[];
  /** Indexes into `mission.story` of the beats already played. Each plays once per run. */
  readonly beatsPlayed: readonly number[];
  /** The story feed, oldest first. */
  readonly story: readonly StoryEntry[];
  /**
   * Where the lines added by the latest change start in `story`: the newest "batch", shown in full
   * together (Start mission can play two beats at once, and an answer can add a reply and a beat).
   */
  readonly storyBatchStart: number;
  /** The latest answer for each objective, and what came of it. */
  readonly feedback: Readonly<Record<string, AnswerFeedback>>;
  /** How many hint tiers are showing for each objective (0 to 3). Hints are free. */
  readonly hintsShown: Readonly<Record<string, number>>;
  /** Secrets (hidden objectives) found and not yet acknowledged, for the secret-found toast. */
  readonly newSecrets: readonly string[];
  /** Command lines run in this attempt, and Reset machine presses: shown in no score, ever. */
  readonly commandsRun: number;
  readonly resets: number;
  /**
   * Command lines that didn't work (the engine reported an error, or a command exited non-zero).
   * Only the mentor's "Want a nudge?" chip reads it (phase 10), and never as a score.
   */
  readonly failedCommands: number;
  /**
   * When Start mission and the first "See your debrief" were pressed (milliseconds, from the page),
   * or null. The post-mission review says roughly how long the mission took (phase 10). The times
   * come in with the action, so the reducer stays pure.
   */
  readonly startedAt: number | null;
  readonly finishedAt: number | null;
  /** The learner's notes on hosts in the network map's details panel, by host id. */
  readonly notes: Readonly<Record<string, string>>;
}

/** The longest a note on one host may be. Notes live in memory only, but still have a size. */
export const MAX_NOTE_LENGTH = 2000;

export type MissionRunAction =
  /** Start mission: from the briefing into the workspace, with the machine's starting state. */
  | { readonly type: "start"; readonly sim: SimState; readonly at?: number }
  /** A command ran in the terminal: its events and the engine's new state. */
  | { readonly type: "command"; readonly events: readonly SimEvent[]; readonly sim: SimState }
  /** Reset machine: the scenario's starting state again. Ticks already earned stay. */
  | { readonly type: "reset"; readonly sim: SimState }
  /** The learner submitted an answer, typed or picked. */
  | { readonly type: "answer"; readonly objectiveId: string; readonly answer: string }
  /** Show the next hint tier for an objective. */
  | { readonly type: "hint"; readonly objectiveId: string }
  /** The secret-found toast for this objective was seen. */
  | { readonly type: "acknowledgeSecret"; readonly objectiveId: string }
  /** Go to the debrief. Only once the mission is complete. */
  | { readonly type: "debrief"; readonly at?: number }
  /** Back from the debrief to the workspace, to keep exploring. */
  | { readonly type: "resume" }
  /** Restart mission: back to the briefing with a fresh run. */
  | { readonly type: "restart" }
  /** The learner edited their note on a host in the network map. Empty text removes it. */
  | { readonly type: "note"; readonly hostId: string; readonly text: string };

export const HINT_TIERS = 3;

export function createMissionRun(attempt = 0): MissionRunState {
  return {
    phase: "briefing",
    attempt,
    sim: null,
    events: [],
    answers: {},
    completed: [],
    beatsPlayed: [],
    story: [],
    storyBatchStart: 0,
    feedback: {},
    hintsShown: {},
    newSecrets: [],
    commandsRun: 0,
    resets: 0,
    failedCommands: 0,
    startedAt: null,
    finishedAt: null,
    notes: {},
  };
}

/** Every change to a run. Pure: the same run and action always give the same result. */
export function missionRunReducer(
  mission: Mission,
  run: MissionRunState,
  action: MissionRunAction,
): MissionRunState {
  const next = reduce(mission, run, action);
  return next.story.length > run.story.length && next.attempt === run.attempt
    ? { ...next, storyBatchStart: run.story.length }
    : next;
}

function reduce(mission: Mission, run: MissionRunState, action: MissionRunAction): MissionRunState {
  switch (action.type) {
    case "start": {
      if (run.phase !== "briefing") return run;
      const started: MissionRunState = {
        ...run,
        phase: "workspace",
        sim: action.sim,
        startedAt: action.at ?? null,
      };
      const beats = mission.story.flatMap((beat, index) => (beat.on === "start" ? [index] : []));
      return advance(mission, playBeats(mission, started, beats), []);
    }
    case "command":
      if (run.phase === "briefing") return run;
      return advance(
        mission,
        {
          ...run,
          sim: action.sim,
          events: [...run.events, ...action.events],
          commandsRun: run.commandsRun + 1,
          failedCommands: run.failedCommands + (commandFailed(action.events) ? 1 : 0),
        },
        action.events,
      );
    case "reset":
      if (run.phase === "briefing") return run;
      return advance(mission, { ...run, sim: action.sim, resets: run.resets + 1 }, []);
    case "answer":
      return answer(mission, run, action.objectiveId, action.answer);
    case "hint": {
      const shown = run.hintsShown[action.objectiveId] ?? 0;
      if (shown >= HINT_TIERS || !Object.hasOwn(mission.hints, action.objectiveId)) return run;
      return { ...run, hintsShown: { ...run.hintsShown, [action.objectiveId]: shown + 1 } };
    }
    case "acknowledgeSecret":
      return { ...run, newSecrets: run.newSecrets.filter((id) => id !== action.objectiveId) };
    case "debrief":
      return run.phase === "workspace" && isMissionComplete(mission, run.completed)
        ? {
            ...run,
            phase: "debrief",
            newSecrets: [],
            finishedAt: run.finishedAt ?? action.at ?? null,
          }
        : run;
    case "resume":
      return run.phase === "debrief" ? { ...run, phase: "workspace" } : run;
    case "restart":
      return createMissionRun(run.attempt + 1);
    case "note": {
      if (run.phase === "briefing") return run;
      const notes: Record<string, string> = { ...run.notes };
      const text = action.text.slice(0, MAX_NOTE_LENGTH);
      if (text.trim() === "") delete notes[action.hostId];
      else notes[action.hostId] = text;
      return { ...run, notes };
    }
  }
}

/** Whether a command line didn't work: the engine reported an error, or a command exited non-zero. */
function commandFailed(events: readonly SimEvent[]): boolean {
  return events.some(
    (event) =>
      event.type === "command.error" || (event.type === "command.run" && event.exitCode !== 0),
  );
}

/** Adds these beats to the story feed, once each, in the order given. */
function playBeats(
  mission: Mission,
  run: MissionRunState,
  indexes: readonly number[],
): MissionRunState {
  const fresh = indexes.filter((index) => !run.beatsPlayed.includes(index));
  if (fresh.length === 0) return run;
  let nextId = run.story.length;
  return {
    ...run,
    beatsPlayed: [...run.beatsPlayed, ...fresh],
    story: [
      ...run.story,
      ...fresh.flatMap((index) => {
        const beat = mission.story[index];
        return beat
          ? [{ id: nextId++, kind: "beat" as const, speaker: beat.speaker, text: beat.text }]
          : [];
      }),
    ],
  };
}

/**
 * Re-checks the objectives after something changed, keeps every tick earned, and plays the beats
 * it triggers, in this order: beats for `newEvents` (story order), beats for newly ticked
 * objectives (objective order, then story order), then the `complete` beats if the mission just
 * finished. Newly found secrets queue up for their toast.
 */
function advance(
  mission: Mission,
  run: MissionRunState,
  newEvents: readonly SimEvent[],
): MissionRunState {
  if (!run.sim) return run;
  const holding = evaluateObjectives(mission, run.sim, run.events, run.answers);
  const newlyTicked = holding.filter((id) => !run.completed.includes(id));
  const wasComplete = isMissionComplete(mission, run.completed);
  const completed = [...run.completed, ...newlyTicked];
  const nowComplete = isMissionComplete(mission, completed);

  const beats: number[] = [];
  mission.story.forEach((beat, index) => {
    const on = beat.on;
    if (
      typeof on === "object" &&
      "event" in on &&
      newEvents.some((event) => event.type === on.event && eventMatches(event, on.match))
    ) {
      beats.push(index);
    }
  });
  for (const id of newlyTicked) {
    mission.story.forEach((beat, index) => {
      if (typeof beat.on === "object" && "objective" in beat.on && beat.on.objective === id) {
        beats.push(index);
      }
    });
  }
  if (nowComplete && !wasComplete) {
    mission.story.forEach((beat, index) => {
      if (beat.on === "complete") beats.push(index);
    });
  }

  const hidden = new Set(mission.objectives.filter((o) => o.hidden).map((o) => o.id));
  const secrets = newlyTicked.filter((id) => hidden.has(id));

  return playBeats(
    mission,
    {
      ...run,
      completed,
      newSecrets: secrets.length > 0 ? [...run.newSecrets, ...secrets] : run.newSecrets,
    },
    beats,
  );
}

/** Records an answer, ticks what it earns, and adds a character's reply to the feed. */
function answer(
  mission: Mission,
  run: MissionRunState,
  objectiveId: string,
  submitted: string,
): MissionRunState {
  const objective = mission.objectives.find((candidate) => candidate.id === objectiveId);
  const text = submitted.trim();
  if (
    run.phase !== "workspace" ||
    !objective ||
    text === "" ||
    !canAnswer(mission, run, objective)
  ) {
    return run;
  }

  const check = objective.check as AnswerCheck;
  const choice = check.choices?.find(
    (candidate) => normalizeAnswer(candidate.text) === normalizeAnswer(text),
  );
  const reply = choice?.reply;
  // The reply goes in the feed first, before any beats the answer triggers.
  const answered: MissionRunState = {
    ...run,
    answers: { ...run.answers, [objectiveId]: [...(run.answers[objectiveId] ?? []), text] },
    story: reply ? [...run.story, { id: run.story.length, kind: "reply", ...reply }] : run.story,
  };
  const next = advance(mission, answered, []);

  return {
    ...next,
    feedback: {
      ...run.feedback,
      [objectiveId]: {
        answer: text,
        accepted: next.completed.includes(objectiveId),
        ...(reply && { reply }),
      },
    },
  };
}

// ---------------------------------------------------------------------------------------------
// What the runner shows
// ---------------------------------------------------------------------------------------------

/** The first main objective not ticked yet: where the learner is in the mission. */
export function currentObjective(mission: Mission, run: MissionRunState): Objective | undefined {
  return mission.objectives.find(
    (objective) => !objective.optional && !run.completed.includes(objective.id),
  );
}

/**
 * Whether an answer box (or choice buttons) shows for this objective now. An answer objective
 * opens once every main objective above it is done, so a story's choices come in the order the
 * story tells them. Bonus answer objectives are open from the start. Ticked ones are closed.
 */
export function canAnswer(mission: Mission, run: MissionRunState, objective: Objective): boolean {
  if (objective.check.kind !== "answer" || objective.hidden) return false;
  if (run.completed.includes(objective.id)) return false;
  return objective.optional || currentObjective(mission, run)?.id === objective.id;
}

/**
 * The checklist: main and bonus objectives in mission order, then the secrets found so far.
 * Secrets stay off the list until they're found.
 */
export function visibleObjectives(mission: Mission, run: MissionRunState): Objective[] {
  return [
    ...mission.objectives.filter((objective) => !objective.hidden),
    ...run.completed
      .map((id) => mission.objectives.find((objective) => objective.id === id))
      .filter((objective): objective is Objective => objective?.hidden === true),
  ];
}

export interface RewardSummary {
  readonly bonusFound: readonly Objective[];
  readonly bonusTotal: number;
  readonly secretsFound: readonly Objective[];
  readonly secretsTotal: number;
}

/** Bonus objectives and secrets found in this run, for the debrief ("1 of 1 secret found"). */
export function rewardSummary(mission: Mission, run: MissionRunState): RewardSummary {
  const bonus = mission.objectives.filter((objective) => objective.optional && !objective.hidden);
  const secrets = mission.objectives.filter((objective) => objective.hidden);
  const done = (objective: Objective) => run.completed.includes(objective.id);
  return {
    bonusFound: bonus.filter(done),
    bonusTotal: bonus.length,
    secretsFound: secrets.filter(done),
    secretsTotal: secrets.length,
  };
}

/**
 * Attempts that didn't work so far: command lines that errored, and answers that weren't accepted.
 * The mentor's "Want a nudge?" chip counts the ones since the last tick (phase 10). Never a score.
 */
export function failedAttempts(run: MissionRunState): number {
  const rejectedAnswers = Object.entries(run.answers).reduce(
    (sum, [objectiveId, answers]) =>
      sum + Math.max(0, answers.length - (run.completed.includes(objectiveId) ? 1 : 0)),
    0,
  );
  return run.failedCommands + rejectedAnswers;
}

/** The time from Start mission to the debrief, in minutes, or null when either is unknown. */
export function runMinutes(run: MissionRunState): number | null {
  return run.startedAt === null || run.finishedAt === null
    ? null
    : Math.max(0, run.finishedAt - run.startedAt) / 60_000;
}

/** A run is in progress while the learner is in the workspace and the mission isn't finished. */
export function isRunInProgress(mission: Mission, run: MissionRunState): boolean {
  return run.phase === "workspace" && !isMissionComplete(mission, run.completed);
}
