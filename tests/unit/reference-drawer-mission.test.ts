import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { toScenarioSpec } from "@/content/schemas/mission";
import { staticMentorSession } from "@/features/mentor";
import { createMissionRun, missionRunReducer, type MissionRunState } from "@/features/missions";
import { loadMissionCatalog } from "@/features/missions/server";
import {
  createTerminalSession,
  promptFor,
  sessionSnapshot,
  submitLine,
  type TerminalSession,
  type TerminalSessionState,
} from "@/features/terminal";
import { MissionWorkspace } from "../../src/features/missions/components/mission-workspace";

/**
 * The reference drawer mid-mission (md-files/09-learning-center.md, prompt 09.5: "Test that opening
 * and closing the drawer mid-mission loses nothing"). Vitest runs in plain Node, so this renders
 * the real workspace, part-way through net-01, with the drawer open and with it closed, and checks
 * that everything but the drawer itself is identical: the terminal's whole screen, the prompt, the
 * objectives, the map and the team chat. The drawer has no action in the run reducer and never
 * touches the terminal session, so there's nothing for opening or closing it to lose.
 */

const mission = loadMissionCatalog().getMissionById("net-01")!;
const LINES = ["ifconfig", "netscan 10.40.1.0/24", "cat from-idris.txt"];

/** net-01 part-way through: the terminal session and the mission run after a few commands. */
function midMission(): { terminal: TerminalSessionState; run: MissionRunState } {
  let terminal = createTerminalSession({
    scenario: toScenarioSpec(mission),
    seed: mission.scenario.seed,
  });
  let run = missionRunReducer(mission, createMissionRun(), { type: "start", sim: terminal.sim });
  for (const line of LINES) {
    terminal = submitLine(terminal, line);
    run = missionRunReducer(mission, run, {
      type: "command",
      events: terminal.lastEvents,
      sim: terminal.sim,
    });
  }
  return { terminal, run };
}

/** The TerminalSession the workspace renders, over a fixed session state. */
function sessionFor(state: TerminalSessionState): TerminalSession {
  return {
    state,
    sim: state.sim,
    blocks: state.blocks,
    history: state.inputHistory,
    prompt: promptFor(state.sim),
    cwd: state.sim.session.cwd,
    submit: () => undefined,
    interrupt: () => {},
    clear: () => {},
    reset: () => {},
    snapshot: () => sessionSnapshot(state),
    suggestions: [],
    complete: (input, cursor) => ({ input, cursor, choices: [] }),
    ghost: () => "",
    search: () => undefined,
  };
}

function render(state: TerminalSessionState, run: MissionRunState, referenceOpen: boolean): string {
  return renderToStaticMarkup(
    createElement(MissionWorkspace, {
      mission,
      run,
      dispatch: () => {},
      session: sessionFor(state),
      mentor: staticMentorSession(),
      startTour: false,
      headingRef: { current: null },
      mapTip: false,
      onDismissMapTip: () => {},
      initialReferenceOpen: referenceOpen,
    }),
  );
}

/** The markup with the drawer's own <section role="dialog"> cut out. */
function withoutDrawer(html: string): { rest: string; drawer: string } {
  const start = html.indexOf('<section role="dialog"');
  expect(start).toBeGreaterThan(-1);
  const tags = /<section\b|<\/section>/g;
  tags.lastIndex = start;
  let depth = 0;
  let end = -1;
  for (let match = tags.exec(html); match; match = tags.exec(html)) {
    depth += match[0] === "</section>" ? -1 : 1;
    if (depth === 0) {
      end = match.index + match[0].length;
      break;
    }
  }
  expect(end).toBeGreaterThan(start);
  return { rest: html.slice(0, start) + html.slice(end), drawer: html.slice(start, end) };
}

describe("the reference drawer in a mission", () => {
  const { terminal, run } = midMission();
  const closed = render(terminal, run, false);
  const open = render(terminal, run, true);

  it("leaves everything else in the workspace exactly as it was", () => {
    const expanded = (html: string, value: boolean) =>
      html.replace(`aria-expanded="${value}" aria-haspopup="dialog"`, "REFERENCE-BUTTON");
    expect(expanded(withoutDrawer(open).rest, true)).toBe(
      expanded(withoutDrawer(closed).rest, false),
    );
  });

  it("keeps the terminal's whole screen, commands and output, whether it's open or not", () => {
    for (const html of [open, closed]) {
      for (const line of LINES) expect(html).toContain(`aria-label="Command: ${line}"`);
      expect(html).toContain("10.40.1.23");
      expect(html).toContain('role="log"');
      expect(html).toMatch(/<input[^>]*aria-label="Command, in ~"/);
    }
  });

  it("shows the drawer only when open, over the workspace rather than instead of it", () => {
    expect(withoutDrawer(open).drawer).not.toMatch(/^<section[^>]*hidden=""/);
    expect(withoutDrawer(closed).drawer).toMatch(/^<section[^>]*hidden=""/);
    expect(withoutDrawer(open).drawer).toContain("Your last command:");
  });

  it("has no say over the run: a run replayed without it is identical", () => {
    // The run was built without ever touching the drawer; rebuilding it gives the same result, and
    // the reducer has no drawer action to change it with.
    expect(midMission().run).toEqual(run);
    expect(run.completed).toContain("find-yourself");
  });
});
