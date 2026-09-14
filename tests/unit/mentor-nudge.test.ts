import { describe, expect, it } from "vitest";
import { toScenarioSpec, type Mission } from "@/content/schemas/mission";
import { NUDGE_FAILED_ATTEMPTS, NUDGE_IDLE_MS, seemsStuck } from "@/features/mentor";
import {
  createMissionRun,
  failedAttempts,
  missionRunReducer,
  runMinutes,
  type MissionRunAction,
  type MissionRunState,
} from "@/features/missions";
import { loadMissionCatalog } from "@/features/missions/server";
import { createTerminalSession, submitLine, type TerminalSessionState } from "@/features/terminal";

/**
 * The "Want a nudge?" chip's threshold (md-files/10-ai-mentor.md, prompt 10.3: "repeated failed
 * attempts or minutes without progress"), and the facts it reads from the run: attempts that didn't
 * work (commands that errored, answers that weren't it), counted from the learner's last tick. Plus
 * the run's start and finish times, which the post-mission review uses. None of it is ever a score.
 */

const linux = loadMissionCatalog().getMissionById("linux-01") as Mission;

describe("seemsStuck", () => {
  it("offers a nudge after a few attempts that didn't work, or a few idle minutes", () => {
    expect(NUDGE_FAILED_ATTEMPTS).toBe(3);
    expect(NUDGE_IDLE_MS).toBe(180_000);
    expect(seemsStuck({ failuresSinceProgress: 0, idle: false })).toBe(false);
    expect(seemsStuck({ failuresSinceProgress: 2, idle: false })).toBe(false);
    expect(seemsStuck({ failuresSinceProgress: 3, idle: false })).toBe(true);
    expect(seemsStuck({ failuresSinceProgress: 0, idle: true })).toBe(true);
    expect(seemsStuck({ failuresSinceProgress: 1, idle: false }, 1)).toBe(true);
  });
});

/** Plays lines in linux-01 through the real terminal session and the run reducer. */
function play(lines: readonly string[], actions: readonly MissionRunAction[] = []) {
  let terminal: TerminalSessionState = createTerminalSession({
    scenario: toScenarioSpec(linux),
    seed: linux.scenario.seed,
  });
  let run: MissionRunState = missionRunReducer(linux, createMissionRun(), {
    type: "start",
    sim: terminal.sim,
    at: 1_000,
  });
  for (const line of lines) {
    const before = terminal.run;
    terminal = submitLine(terminal, line);
    if (terminal.run !== before) {
      run = missionRunReducer(linux, run, {
        type: "command",
        events: terminal.lastEvents,
        sim: terminal.sim,
      });
    }
  }
  for (const action of actions) run = missionRunReducer(linux, run, action);
  return run;
}

describe("failedAttempts", () => {
  it("counts commands that errored and answers that weren't accepted, never successes", () => {
    const run = play(["ls", "cat nope.txt", "sl", "cd /nowhere"]);
    expect(run.failedCommands).toBe(3);
    expect(failedAttempts(run)).toBe(3);
  });

  it("counts a wrong answer, and not the right one that ticked it", () => {
    const steps = ["ls", "cat /srv/orders/README.txt", "cat /srv/orders/config/database.conf"];
    const wrong = play(steps, [
      { type: "answer", objectiveId: "who-can-read", answer: "Its owner and its group" },
    ]);
    expect(failedAttempts(wrong)).toBe(1);
    const right = missionRunReducer(linux, wrong, {
      type: "answer",
      objectiveId: "who-can-read",
      answer: "Every account on this computer",
    });
    expect(right.completed).toContain("who-can-read");
    expect(failedAttempts(right)).toBe(1);
  });
});

describe("the run's start and finish times", () => {
  it("records Start mission and the first trip to the debrief, from the action", () => {
    const run = play(
      [
        "ls",
        "cat /srv/orders/README.txt",
        "cat /srv/orders/config/database.conf",
        "sudo chmod 640 /srv/orders/config/database.conf",
      ],
      [
        { type: "answer", objectiveId: "who-can-read", answer: "Every account on this computer" },
        { type: "debrief", at: 1_000 + 8 * 60_000 },
        { type: "resume" },
        { type: "debrief", at: 1_000 + 20 * 60_000 },
      ],
    );
    expect(run.phase).toBe("debrief");
    expect(run.startedAt).toBe(1_000);
    expect(run.finishedAt).toBe(1_000 + 8 * 60_000);
    expect(runMinutes(run)).toBe(8);
  });

  it("is unknown when the actions carry no time (headless play)", () => {
    expect(runMinutes(createMissionRun())).toBeNull();
  });
});
