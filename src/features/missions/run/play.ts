import { toScenarioSpec, type Mission } from "@/content/schemas/mission";
import { getCastMember } from "@/content/cast";
import {
  createTerminalSession,
  plainTranscript,
  resetMachine,
  submitLine,
  type TerminalSessionState,
} from "@/features/terminal";
import { isMissionComplete } from "../evaluate";
import {
  createMissionRun,
  missionRunReducer,
  type MissionRunAction,
  type MissionRunState,
} from "./mission-run";

/**
 * Headless play (md-files/06-mission-system.md, prompt 06.6): a mission run driven by a scripted
 * list of steps instead of a person. Command lines go through the terminal's own session code (the
 * same parser and engine as the browser), and everything else through the same run reducer as the
 * UI, so a playthrough that completes here completes in the app.
 */

/** One scripted step. */
export type PlayStep =
  /** Type a command line and press Enter. */
  | { readonly run: string }
  /** Submit an answer for an objective (typed, or a choice's text). */
  | { readonly answer: string; readonly objective: string }
  /** Press Reset machine. */
  | { readonly reset: true };

/** What one step did, for the transcript and for tests. */
export interface PlayStepResult {
  readonly step: PlayStep;
  /** The command and its output, for `run` steps, without the beginner explainer lines. */
  readonly output: string;
  /** Objectives this step ticked. */
  readonly ticked: readonly string[];
  /** Story lines this step added: `Name: text`. */
  readonly story: readonly string[];
  /** For answer steps: whether the answer was accepted. */
  readonly accepted?: boolean;
}

export interface PlayResult {
  readonly run: MissionRunState;
  readonly steps: readonly PlayStepResult[];
  /** Every main objective is ticked. */
  readonly complete: boolean;
  /** Story lines from Start mission, before the first step. */
  readonly opening: readonly string[];
}

const speakerName = (speaker: string) => getCastMember(speaker)?.name ?? speaker;

/** Plays `steps` from Start mission. Pure: the same mission and steps always give the same result. */
export function playMission(mission: Mission, steps: readonly PlayStep[]): PlayResult {
  let terminal: TerminalSessionState = createTerminalSession({
    scenario: toScenarioSpec(mission),
    seed: mission.scenario.seed,
  });
  let run = missionRunReducer(mission, createMissionRun(), { type: "start", sim: terminal.sim });
  const opening = run.story.map((entry) => `${speakerName(entry.speaker)}: ${entry.text}`);
  const results: PlayStepResult[] = [];

  for (const step of steps) {
    const before = run;
    let output = "";
    let action: MissionRunAction;
    if ("run" in step) {
      const previous = terminal;
      terminal = submitLine(terminal, step.run);
      const block = terminal.blocks.at(-1);
      output = block && block.id >= previous.nextId ? plainTranscript([block]) : `$ ${step.run}`;
      action = { type: "command", events: terminal.lastEvents, sim: terminal.sim };
    } else if ("reset" in step) {
      terminal = resetMachine(terminal);
      action = { type: "reset", sim: terminal.sim };
    } else {
      action = { type: "answer", objectiveId: step.objective, answer: step.answer };
    }
    run = missionRunReducer(mission, run, action);
    results.push({
      step,
      output,
      ticked: run.completed.filter((id) => !before.completed.includes(id)),
      story: run.story
        .slice(before.story.length)
        .map((entry) => `${speakerName(entry.speaker)}: ${entry.text}`),
      ...("answer" in step && { accepted: run.feedback[step.objective]?.accepted ?? false }),
    });
  }

  return { run, steps: results, complete: isMissionComplete(mission, run.completed), opening };
}

/** A readable transcript of a playthrough: commands, output, ticks and story, step by step. */
export function formatPlaythrough(mission: Mission, result: PlayResult): string {
  const lines: string[] = [`${mission.title} (${mission.id}, version ${mission.version})`, ""];
  const objective = (id: string) => mission.objectives.find((candidate) => candidate.id === id);
  const story = (entries: readonly string[]) =>
    entries.forEach((entry) => lines.push(`  » ${entry}`));

  story(result.opening);
  for (const step of result.steps) {
    lines.push("");
    if ("run" in step.step) lines.push(step.output);
    else if ("reset" in step.step) lines.push("[Reset machine]");
    else {
      lines.push(
        `[Answer ${step.step.objective}] ${step.step.answer} → ${step.accepted ? "accepted" : "not accepted"}`,
      );
    }
    for (const id of step.ticked) {
      const done = objective(id);
      const label = done?.name ? `${done.name} (${done.hidden ? "secret" : "bonus"})` : id;
      lines.push(`  ✓ ${label}: ${done?.success ?? ""}`);
    }
    story(step.story);
  }

  const main = mission.objectives.filter((candidate) => !candidate.optional);
  const extras = mission.objectives.filter((candidate) => candidate.optional);
  const done = new Set(result.run.completed);
  lines.push(
    "",
    result.complete ? "MISSION COMPLETE" : "Mission not complete",
    `Main objectives: ${main.filter((o) => done.has(o.id)).length} of ${main.length}`,
    `Bonus objectives and secrets: ${extras.filter((o) => done.has(o.id)).length} of ${extras.length}`,
  );
  const missing = main
    .filter((candidate) => !done.has(candidate.id))
    .map((candidate) => candidate.id);
  if (missing.length > 0) lines.push(`Still to do: ${missing.join(", ")}`);
  return lines.join("\n");
}
