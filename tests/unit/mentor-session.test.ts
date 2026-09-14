import { describe, expect, it, vi } from "vitest";
import {
  buildFallbackReview,
  canRevealHint,
  createMentorStore,
  HINT_COOLDOWN_MS,
  hintsFor,
  nextHintTier,
  type MentorDeps,
  type ReviewFacts,
} from "@/features/mentor";
import { loadMissionCatalog } from "@/features/missions/server";

/**
 * The mentor store (md-files/10-ai-mentor.md, prompts 10.3 and 10.4): everything the mentor says in
 * one attempt, held in memory. Requests are injected, so nothing here touches the network: the tests
 * pin the hint ladder's rules (tier 1 at once, later tiers after the cooldown, never past tier 3,
 * never for a secret), streaming, explanations, and that the review is only ever written once.
 */

const mission = loadMissionCatalog().getMissionById("net-01")!;
const STEP = "check-doors";
const secret = mission.objectives.find((objective) => objective.hidden)!;

/** A promise with its resolve function, so a test decides when a reply lands. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fakeDeps(start = 1_000_000) {
  let now = start;
  const hint = vi.fn<MentorDeps["requestHint"]>();
  const explain = vi.fn<MentorDeps["requestExplain"]>();
  const review = vi.fn<MentorDeps["requestReview"]>();
  const deps: MentorDeps = {
    requestHint: hint,
    requestExplain: explain,
    requestReview: review,
    now: () => now,
  };
  return { deps, hint, explain, review, advance: (ms: number) => (now += ms) };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the hint ladder", () => {
  it("shows tier 1 at once, streams Noor's words, then lands her final text", async () => {
    const { deps, hint } = fakeDeps();
    const reply = deferred<{ mode: "model"; text: string }>();
    hint.mockImplementation((options) => {
      options.onText?.("Have a look");
      return reply.promise;
    });
    const store = createMentorStore(mission, deps);

    expect(store.askHint(STEP, [{ input: "ls", output: "notes.txt" }])).toBe(true);
    expect(hint).toHaveBeenCalledTimes(1);
    expect(hint.mock.calls[0]?.[0]).toMatchObject({
      objectiveId: STEP,
      tier: 1,
      transcript: [{ input: "ls", output: "notes.txt" }],
    });
    expect(hintsFor(store.getState(), STEP)).toEqual([
      expect.objectContaining({ tier: 1, status: "writing", text: "Have a look" }),
    ]);

    reply.resolve({ mode: "model", text: "Have a look at the open door." });
    await flush();
    expect(hintsFor(store.getState(), STEP)[0]).toMatchObject({
      status: "model",
      text: "Have a look at the open door.",
    });
    expect(store.getState().lastReply).toMatchObject({ mode: "model" });
  });

  it("waits out the cooldown before the next tier, and never goes past tier 3", async () => {
    const { deps, hint, advance } = fakeDeps();
    hint.mockImplementation(async (options) => ({
      mode: "fallback",
      text: mission.hints[STEP]?.[options.tier - 1] ?? "",
    }));
    const store = createMentorStore(mission, deps);

    expect(store.askHint(STEP, [])).toBe(true);
    expect(store.askHint(STEP, [])).toBe(false); // cooldown
    advance(HINT_COOLDOWN_MS - 1);
    expect(canRevealHint(store.getState(), mission, STEP, deps.now())).toBe(false);
    advance(1);
    expect(store.askHint(STEP, [])).toBe(true);
    advance(HINT_COOLDOWN_MS);
    expect(store.askHint(STEP, [])).toBe(true);
    advance(HINT_COOLDOWN_MS);
    expect(nextHintTier(store.getState(), mission, STEP)).toBeUndefined();
    expect(store.askHint(STEP, [])).toBe(false);
    expect(hint.mock.calls.map(([options]) => options.tier)).toEqual([1, 2, 3]);

    await flush();
    // Fallback text is the authored tier, verbatim, and the panel learns Noor used her notes.
    expect(hintsFor(store.getState(), STEP).map((entry) => entry.text)).toEqual(
      mission.hints[STEP],
    );
    expect(store.getState().lastReply?.mode).toBe("fallback");
  });

  it("gives no hint for a secret, which ships none", () => {
    const { deps, hint } = fakeDeps();
    const store = createMentorStore(mission, deps);
    expect(store.askHint(secret.id, [])).toBe(false);
    expect(hint).not.toHaveBeenCalled();
  });

  it("keeps each objective's ladder separate", () => {
    const { deps, hint } = fakeDeps();
    hint.mockReturnValue(new Promise(() => {}));
    const store = createMentorStore(mission, deps);
    const other = mission.objectives.find((o) => !o.hidden && o.id !== STEP)!;
    expect(store.askHint(STEP, [])).toBe(true);
    expect(store.askHint(other.id, [])).toBe(true); // no cooldown carried across steps
    expect(hintsFor(store.getState(), other.id)).toHaveLength(1);
  });

  it("stops requests in flight when the attempt ends", () => {
    const { deps, hint } = fakeDeps();
    hint.mockReturnValue(new Promise(() => {}));
    const store = createMentorStore(mission, deps);
    store.askHint(STEP, []);
    const signal = hint.mock.calls[0]?.[0].signal;
    expect(signal?.aborted).toBe(false);
    store.abortAll();
    expect(signal?.aborted).toBe(true);
  });
});

describe("explanations", () => {
  it("adds each question with its reply, and sends the fallback written ahead of time", async () => {
    const { deps, explain } = fakeDeps();
    explain.mockImplementation(async (options) => ({ mode: "fallback", text: options.fallback }));
    const store = createMentorStore(mission, deps);
    store.explain({
      question: {
        kind: "output",
        command: "cat nope",
        text: "cat: nope: No such file or directory",
        scope: "line",
        error: true,
      },
      transcript: [],
      fallback: "There's no file called nope here.",
      objectiveId: STEP,
    });
    store.explain({
      question: { kind: "term", termId: "port", term: "Port" },
      transcript: [],
      fallback: "A numbered door.",
    });
    expect(store.getState().explanations.map((entry) => entry.status)).toEqual([
      "writing",
      "writing",
    ]);
    expect(explain.mock.calls[0]?.[0]).toMatchObject({
      missionId: "net-01",
      objectiveId: STEP,
      subject: { kind: "output", scope: "line", error: true },
    });
    expect(explain.mock.calls[1]?.[0].subject).toEqual({ kind: "term", termId: "port" });

    await flush();
    expect(store.getState().explanations.map((entry) => [entry.status, entry.text])).toEqual([
      ["fallback", "There's no file called nope here."],
      ["fallback", "A numbered door."],
    ]);
  });
});

describe("the post-mission review", () => {
  const facts: ReviewFacts = {
    missionTitle: mission.title,
    objectives: [],
    minutes: 6,
    commandLines: ["ls"],
    resets: 0,
    lessonIds: ["net-ports"],
  };

  it("is asked for once per attempt, however many times the debrief renders", async () => {
    const { deps, review } = fakeDeps();
    review.mockResolvedValue({ mode: "fallback", review: buildFallbackReview(facts) });
    const store = createMentorStore(mission, deps);
    store.requestReview(facts, []);
    store.requestReview(facts, []);
    expect(store.getState().review.status).toBe("writing");
    await flush();
    store.requestReview(facts, []);
    expect(review).toHaveBeenCalledTimes(1);
    expect(store.getState().review).toMatchObject({ status: "fallback" });
    expect(store.getState().review.review?.wellDone).toContain(mission.title);
  });
});
