import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { toScenarioSpec, type Mission } from "@/content/schemas/mission";
import { findBannedWords } from "@/content/voice";
import {
  buildFallbackReview,
  FROM_NOTES_LABEL,
  HINTS_ARE_FREE,
  initialMentorState,
  MentorPanel,
  MentorReviewCard,
  NudgeChip,
  staticMentorSession,
  type MentorReview,
  type MentorState,
  type ReviewFacts,
} from "@/features/mentor";
import { createMissionRun, missionRunReducer, type MissionLinks } from "@/features/missions";
import { loadMissionCatalog } from "@/features/missions/server";
import {
  createTerminalSession,
  promptFor,
  sessionSnapshot,
  submitLine,
  Terminal,
  type TerminalSession,
  type TerminalSessionState,
} from "@/features/terminal";
import { MissionDebrief } from "../../src/features/missions/components/mission-debrief";
import { MissionWorkspace } from "../../src/features/missions/components/mission-workspace";

/**
 * The mentor UI (md-files/10-ai-mentor.md, prompts 10.3 and 10.4), rendered to HTML: Noor's panel
 * (hints as progressive disclosure, which hint you're on, "Hints are free", the typing indicator,
 * the calm fallback), the rule that the panel never opens by itself, the nudge chip, "Explain this"
 * in the terminal, and the post-mission review on the debrief.
 */

const catalog = loadMissionCatalog();
const mission = catalog.getMissionById("linux-01") as Mission;
const STEP = "look-around";

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

function panel(state: MentorState, open = true) {
  return renderToStaticMarkup(
    createElement(MentorPanel, {
      open,
      onClose: () => {},
      mission,
      completed: [],
      objectiveId: STEP,
      onSelectObjective: () => {},
      state,
      onAskHint: () => {},
      onOpenReference: () => {},
    }),
  );
}

describe("the mentor panel", () => {
  it("is hidden until opened", () => {
    expect(panel(initialMentorState(), false)).toMatch(/^<section[^>]*hidden=""/);
    expect(panel(initialMentorState())).not.toMatch(/^<section[^>]*hidden=""/);
  });

  it("is Noor, says hints are free, and says which hint you're on", () => {
    const empty = text(panel(initialMentorState()));
    expect(empty).toContain("Ask Noor");
    expect(empty).toContain("Noor Halvorsen");
    expect(empty).toContain(HINTS_ARE_FREE);
    expect(empty).toContain("No hints open for this step yet. Hint 1 is a nudge.");
    expect(empty).toContain("Show me a hint");

    const one = text(
      panel({
        ...initialMentorState(),
        hints: { [STEP]: [{ tier: 1, shownAt: 0, status: "model", text: "Try looking around." }] },
      }),
    );
    expect(one).toContain("You're on hint 1 of 3: a nudge.");
    expect(one).toContain("Hint 1 of 3 · a nudge");
    expect(one).toContain("Try looking around.");
    expect(one).toContain("Show me another hint");
  });

  it("shows the typing indicator while Noor writes, and nothing scary when she's offline", () => {
    const writing = text(
      panel({
        ...initialMentorState(),
        hints: { [STEP]: [{ tier: 1, shownAt: 0, status: "writing", text: "" }] },
      }),
    );
    expect(writing).toContain("Noor is writing…");

    const authored = mission.hints[STEP]![0];
    const offline = text(
      panel({
        ...initialMentorState(),
        hints: { [STEP]: [{ tier: 1, shownAt: 0, status: "fallback", text: authored }] },
        lastReply: { id: 1, mode: "fallback", text: authored },
      }),
    );
    expect(offline).toContain(authored);
    expect(offline).toContain(FROM_NOTES_LABEL);
    expect(offline).toContain("live help is resting right now");
    expect(offline).not.toMatch(/\berror\b|went wrong|failed|unavailable/i);
  });

  it("says when every hint for a step is open, and points at other help", () => {
    const all = text(
      panel({
        ...initialMentorState(),
        hints: {
          [STEP]: ([1, 2, 3] as const).map((tier) => ({
            tier,
            shownAt: 0,
            status: "fallback" as const,
            text: mission.hints[STEP]![tier - 1]!,
          })),
        },
      }),
    );
    expect(all).toContain("That's every hint for this step.");
    expect(all).not.toContain("Show me another hint");
  });

  it("shows each explanation under the question the learner asked", () => {
    const html = text(
      panel({
        ...initialMentorState(),
        explanations: [
          {
            id: 1,
            question: { kind: "term", termId: "permission", term: "Permission" },
            status: "model",
            text: "A rule about who may do what with a file.",
          },
          {
            id: 2,
            question: {
              kind: "output",
              command: "cat nope",
              text: "cat: nope: No such file or directory",
              scope: "line",
              error: true,
            },
            status: "writing",
            text: "",
          },
        ],
      }),
    );
    expect(html).toContain("What does Permission mean?");
    expect(html).toContain("A rule about who may do what with a file.");
    expect(html).toContain("What does this error mean? cat: nope: No such file or directory");
    expect(html).toContain("Noor is writing…");
  });

  it("uses none of the banned words", () => {
    const html = text(
      panel({
        ...initialMentorState(),
        hints: { [STEP]: [{ tier: 1, shownAt: 0, status: "fallback", text: "x" }] },
        lastReply: { id: 1, mode: "fallback", text: "x" },
      }),
    );
    expect(findBannedWords(html)).toEqual([]);
  });
});

/** The TerminalSession the components render, over a fixed session state. */
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

function terminalAfter(...lines: string[]): TerminalSessionState {
  let state = createTerminalSession({
    scenario: toScenarioSpec(mission),
    seed: mission.scenario.seed,
  });
  for (const line of lines) state = submitLine(state, line);
  return state;
}

describe("the workspace never opens the mentor by itself", () => {
  const terminal = terminalAfter("ls", "cat nope.txt", "sl", "cd /nowhere");
  const run = missionRunReducer(mission, createMissionRun(), { type: "start", sim: terminal.sim });
  const html = renderToStaticMarkup(
    createElement(MissionWorkspace, {
      mission,
      run,
      dispatch: () => {},
      session: sessionFor(terminal),
      mentor: staticMentorSession(),
      startTour: false,
      headingRef: { current: null },
      mapTip: false,
      onDismissMapTip: () => {},
    }),
  );

  it("renders Noor's panel closed, with an Ask Noor button to open it", () => {
    const dialogs = [...html.matchAll(/<section role="dialog"[^>]*>/g)].map((match) => match[0]);
    expect(dialogs).toHaveLength(2); // the Reference, then Noor
    for (const dialog of dialogs) expect(dialog).toContain('hidden=""');
    expect(text(html)).toContain("Ask Noor");
  });

  it("offers Explain this in the terminal and a hint on each step, but no nudge on arrival", () => {
    expect(text(html)).toContain("Explain this");
    expect(text(html)).toContain("Show me a hint");
    expect(text(html)).not.toContain("Want a nudge?");
  });
});

describe("the nudge chip", () => {
  it("offers a nudge and can be hidden", () => {
    const html = renderToStaticMarkup(
      createElement(NudgeChip, { onAccept: () => {}, onDismiss: () => {} }),
    );
    expect(text(html)).toContain("Want a nudge?");
    expect(text(html)).toContain("Hints are free.");
    expect(html).toContain('aria-label="No thanks, hide this"');
    expect(findBannedWords(text(html))).toEqual([]);
  });
});

describe("Explain this in the terminal", () => {
  const state = terminalAfter("ls -la", "cat nope.txt");
  const render = (withExplain: boolean) =>
    renderToStaticMarkup(
      createElement(Terminal, {
        session: sessionFor(state),
        ...(withExplain && { onExplain: () => {} }),
      }),
    );

  it("appears only when something can explain it", () => {
    expect(text(render(true))).toContain("Explain this");
    expect(render(true)).toContain(">Explain</button>");
    expect(text(render(false))).not.toContain("Explain this");
    expect(render(false)).not.toContain(">Explain</button>");
  });

  it("keeps the per-line shortcut out of the tab order and the accessibility tree", () => {
    for (const match of render(true).matchAll(/<button[^>]*>Explain<\/button>/g)) {
      expect(match[0]).toContain('tabindex="-1"');
      expect(match[0]).toContain('aria-hidden="true"');
    }
  });
});

const facts: ReviewFacts = {
  missionTitle: mission.title,
  objectives: mission.objectives
    .filter((objective) => !objective.optional)
    .map((objective) => ({
      id: objective.id,
      description: objective.description,
      kind: "main" as const,
      done: true,
      hintsOpened: 1,
    })),
  minutes: 9,
  commandLines: ["ls", "cat welcome-from-roz.txt"],
  resets: 0,
  lessonIds: ["linux-permissions", "linux-logs"],
};

const LINKS: MissionLinks = {
  bestAfter: [],
  concepts: [{ id: "linux-permissions", title: "File permissions" }],
  furtherReading: [{ id: "linux-logs", title: "Reading logs" }],
  next: null,
};

const modelReview: MentorReview = {
  wellDone: "You read Roz's note before touching anything else.",
  approach: "You looked around, then followed the notes.",
  efficientSteps: ["Reading the README first saved a search."],
  detours: ["`ls -l` shows the lock straight away."],
  tryNext: [
    { lessonId: "linux-permissions", why: "It goes deeper into the letters you read." },
    { lessonId: "unknown-lesson", why: "Never shown." },
  ],
  signOff: "See you on the next shift.",
};

function card(state: Parameters<typeof MentorReviewCard>[0]["state"]) {
  return renderToStaticMarkup(
    createElement(MentorReviewCard, {
      state,
      facts,
      lessonTitle: (id) =>
        [...LINKS.concepts, ...LINKS.furtherReading].find((lesson) => lesson.id === id)?.title,
      onRequest: () => {},
    }),
  );
}

describe("the post-mission review", () => {
  it("waits to be asked, and says it's feedback, not a grade", () => {
    const idle = text(card({ status: "idle" }));
    expect(idle).toContain("Ask Noor to look back at my run");
    expect(idle).toContain("It isn't a grade");
    expect(idle).not.toMatch(/\bhints?\b/i);
  });

  it("shows Noor reading while she writes", () => {
    expect(text(card({ status: "writing" }))).toContain("Noor is reading through your run…");
  });

  it("leads with what went well, then the approach, and frames lessons as try next", () => {
    const html = card({ status: "model", review: modelReview });
    const words = text(html);
    const order = [
      modelReview.wellDone,
      "How you went about it",
      "What went smoothly",
      "Worth knowing for next time",
      "Try next",
      "Your run at a glance",
    ].map((part) => words.indexOf(part));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain('href="/learn/linux-permissions"');
    expect(html).not.toContain("unknown-lesson");
    expect(words).toContain("Hints opened 5, and they're always free");
    expect(words).not.toMatch(/weakness|grade:|score/i);
    expect(words).not.toContain(FROM_NOTES_LABEL);
  });

  it("falls back to the template, in Noor's voice, saying it was written ahead of time", () => {
    const words = text(card({ status: "fallback", review: buildFallbackReview(facts) }));
    expect(words).toContain(`You finished every main objective in ${mission.title}.`);
    expect(words).toContain(FROM_NOTES_LABEL);
    expect(words).toContain("File permissions");
    expect(findBannedWords(words)).toEqual([]);
  });

  it("sits on the debrief right after the celebration, before what you learned", () => {
    const main = mission.objectives.filter((o) => !o.optional).map((o) => o.id);
    const html = text(
      renderToStaticMarkup(
        createElement(MissionDebrief, {
          mission,
          run: { ...createMissionRun(), phase: "debrief", completed: main },
          links: LINKS,
          dispatch: () => {},
          mentor: staticMentorSession({
            ...initialMentorState(),
            review: { status: "model", review: modelReview },
          }),
          terminal: { history: ["ls"], blocks: [] },
        }),
      ),
    );
    const complete = html.indexOf("Mission complete");
    const review = html.indexOf("Looking back with Noor");
    const learned = html.indexOf("What you learned");
    expect(complete).toBeGreaterThan(-1);
    expect(review).toBeGreaterThan(complete);
    expect(learned).toBeGreaterThan(review);
  });
});
