import type { Mission } from "@/content/schemas/mission";
import {
  requestMentorExplain,
  requestMentorHint,
  requestMentorReview,
  type RequestMentorExplainOptions,
  type RequestMentorHintOptions,
  type RequestMentorReviewOptions,
} from "../client";
import {
  HINT_TIERS,
  nextTierUnlockTime,
  type ExplainSubject,
  type HintTier,
  type MentorMode,
  type MentorTextResult,
} from "../protocol";
import type { MentorReview, MentorReviewResult, ReviewFacts } from "../review";
import type { MentorTranscript } from "../transcript";

/**
 * Everything the mentor has said in one mission attempt (md-files/10-ai-mentor.md, prompts 10.3 and
 * 10.4): the hint tiers shown for each objective and Noor's words for them, the explanations the
 * learner asked for, and the post-mission review. It lives in memory only, for one attempt: the
 * mission runner holds one store per attempt, across the workspace and the debrief, so a re-render,
 * closing the mentor panel, or going back and forth to the debrief never asks the model again.
 * Restart mission starts a fresh store. Nothing here is ever written to storage.
 *
 * The store is plain TypeScript (no React), so its rules are tested in Node with fake requests; the
 * React hook (use-mentor-session.ts) only subscribes to it.
 */

/** `writing` while the text streams in, then `model` (Noor's words) or `fallback` (written ahead). */
export type MentorReplyStatus = "writing" | MentorMode;

export interface MentorReply {
  readonly status: MentorReplyStatus;
  readonly text: string;
}

/** One hint tier shown for an objective. */
export interface MentorHintEntry extends MentorReply {
  readonly tier: HintTier;
  /** When it was shown, for the cooldown before the next tier. */
  readonly shownAt: number;
}

/** What the learner asked Noor to explain, as the panel shows it back to them. */
export type ExplainQuestion =
  | (Extract<ExplainSubject, { kind: "output" }> & { readonly kind: "output" })
  | { readonly kind: "term"; readonly termId: string; readonly term: string };

export interface MentorExplanation extends MentorReply {
  readonly id: number;
  readonly question: ExplainQuestion;
}

export interface MentorReviewState {
  readonly status: "idle" | MentorReplyStatus;
  readonly review?: MentorReview;
}

export interface MentorState {
  /** Hint tiers shown so far, by objective id, in tier order. */
  readonly hints: Readonly<Record<string, readonly MentorHintEntry[]>>;
  /** Explanations, oldest first. */
  readonly explanations: readonly MentorExplanation[];
  readonly review: MentorReviewState;
  /**
   * The newest finished hint or explanation: read out to screen readers once it has landed, and its
   * mode lets the panel say plainly when Noor is answering from her notes (the model is switched
   * off, busy, or unavailable). `id` counts up, so the same words twice still count as new.
   */
  readonly lastReply?: { readonly id: number; readonly mode: MentorMode; readonly text: string };
}

/** The most explanations kept in the panel; older ones drop off the top. */
export const MAX_EXPLANATIONS = 20;

export function initialMentorState(): MentorState {
  return { hints: {}, explanations: [], review: { status: "idle" } };
}

// ---------------------------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------------------------

const NO_HINTS: readonly MentorHintEntry[] = [];

export function hintsFor(state: MentorState, objectiveId: string): readonly MentorHintEntry[] {
  return state.hints[objectiveId] ?? NO_HINTS;
}

/** The tier the next hint would be, or undefined when the objective has none left (or none at all). */
export function nextHintTier(
  state: MentorState,
  mission: Mission,
  objectiveId: string,
): HintTier | undefined {
  if (!Object.hasOwn(mission.hints, objectiveId)) return undefined;
  const shown = hintsFor(state, objectiveId).length;
  return shown < HINT_TIERS.length ? ((shown + 1) as HintTier) : undefined;
}

/** When the next tier unlocks: undefined before the first (tier 1 is available at once). */
export function nextHintUnlockAt(state: MentorState, objectiveId: string): number | undefined {
  const last = hintsFor(state, objectiveId).at(-1);
  return last === undefined ? undefined : nextTierUnlockTime(last.shownAt);
}

/** Whether a hint can be shown now: there's a tier left, and the cooldown after the last has passed. */
export function canRevealHint(
  state: MentorState,
  mission: Mission,
  objectiveId: string,
  now: number,
): boolean {
  if (nextHintTier(state, mission, objectiveId) === undefined) return false;
  const unlockAt = nextHintUnlockAt(state, objectiveId);
  return unlockAt === undefined || now >= unlockAt;
}

// ---------------------------------------------------------------------------------------------
// The store
// ---------------------------------------------------------------------------------------------

export interface MentorDeps {
  readonly requestHint: (options: RequestMentorHintOptions) => Promise<MentorTextResult>;
  readonly requestExplain: (options: RequestMentorExplainOptions) => Promise<MentorTextResult>;
  readonly requestReview: (options: RequestMentorReviewOptions) => Promise<MentorReviewResult>;
  readonly now: () => number;
}

export interface ExplainRequest {
  readonly question: ExplainQuestion;
  readonly transcript: MentorTranscript;
  /** The explanation written ahead of time, shown if the mentor is unavailable. */
  readonly fallback: string;
  /** The objective the learner is on, for context. */
  readonly objectiveId?: string;
}

/** What the UI works with: the state, and the three ways to ask the mentor something. */
export interface MentorSession {
  readonly state: MentorState;
  /**
   * Shows the next hint tier for an objective and asks Noor to personalise it. Returns false (and
   * does nothing) when there's no tier left or the cooldown hasn't passed.
   */
  askHint(objectiveId: string, transcript: MentorTranscript): boolean;
  /** Asks Noor to explain a line, a result, an error or a word. */
  explain(request: ExplainRequest): void;
  /** Asks Noor to look back at the run, once per attempt. */
  requestReview(facts: ReviewFacts, transcript: MentorTranscript): void;
}

export interface MentorStore extends Omit<MentorSession, "state"> {
  getState(): MentorState;
  subscribe(listener: () => void): () => void;
  /** Stops every request in flight (the attempt ended). */
  abortAll(): void;
}

function subjectOf(question: ExplainQuestion): ExplainSubject {
  return question.kind === "term"
    ? { kind: "term", termId: question.termId }
    : {
        kind: "output",
        command: question.command,
        text: question.text,
        scope: question.scope,
        error: question.error,
      };
}

export function createMentorStore(
  mission: Mission,
  overrides: Partial<MentorDeps> = {},
): MentorStore {
  const deps: MentorDeps = {
    requestHint: requestMentorHint,
    requestExplain: requestMentorExplain,
    requestReview: requestMentorReview,
    now: () => Date.now(),
    ...overrides,
  };
  let state = initialMentorState();
  let nextExplanationId = 1;
  const listeners = new Set<() => void>();
  const inFlight = new Set<AbortController>();

  const set = (next: MentorState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  const track = () => {
    const controller = new AbortController();
    inFlight.add(controller);
    return controller;
  };

  const updateHint = (
    objectiveId: string,
    tier: HintTier,
    change: (entry: MentorHintEntry) => MentorHintEntry,
  ) => {
    const entries = hintsFor(state, objectiveId);
    if (!entries.some((entry) => entry.tier === tier)) return;
    set({
      ...state,
      hints: {
        ...state.hints,
        [objectiveId]: entries.map((entry) => (entry.tier === tier ? change(entry) : entry)),
      },
    });
  };

  const updateExplanation = (
    id: number,
    change: (entry: MentorExplanation) => MentorExplanation,
  ) => {
    if (!state.explanations.some((entry) => entry.id === id)) return;
    set({
      ...state,
      explanations: state.explanations.map((entry) => (entry.id === id ? change(entry) : entry)),
    });
  };

  let replyCount = 0;
  const finished = (result: MentorTextResult) =>
    set({ ...state, lastReply: { id: ++replyCount, mode: result.mode, text: result.text } });

  // A streamed chunk only lands while the reply is still being written, so a trailing chunk never
  // overwrites the final text.
  const streaming =
    (text: string) =>
    <T extends MentorReply>(entry: T): T =>
      entry.status === "writing" ? { ...entry, text } : entry;

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    abortAll() {
      for (const controller of inFlight) controller.abort();
      inFlight.clear();
    },

    askHint(objectiveId, transcript) {
      const now = deps.now();
      const tier = nextHintTier(state, mission, objectiveId);
      if (tier === undefined || !canRevealHint(state, mission, objectiveId, now)) return false;
      set({
        ...state,
        hints: {
          ...state.hints,
          [objectiveId]: [
            ...hintsFor(state, objectiveId),
            { tier, shownAt: now, status: "writing", text: "" },
          ],
        },
      });
      const controller = track();
      deps
        .requestHint({
          mission,
          objectiveId,
          tier,
          transcript,
          signal: controller.signal,
          onText: (text) => updateHint(objectiveId, tier, streaming(text)),
        })
        .then((result) => {
          updateHint(objectiveId, tier, (entry) => ({
            ...entry,
            status: result.mode,
            text: result.text,
          }));
          finished(result);
        })
        .catch(() => {
          // Only an abort reaches here: the attempt ended, and this store goes with it.
        })
        .finally(() => inFlight.delete(controller));
      return true;
    },

    explain({ question, transcript, fallback, objectiveId }) {
      const id = nextExplanationId++;
      set({
        ...state,
        explanations: [
          ...state.explanations,
          { id, question, status: "writing" as const, text: "" },
        ].slice(-MAX_EXPLANATIONS),
      });
      const controller = track();
      deps
        .requestExplain({
          missionId: mission.id,
          ...(objectiveId !== undefined && { objectiveId }),
          subject: subjectOf(question),
          transcript,
          fallback,
          signal: controller.signal,
          onText: (text) => updateExplanation(id, streaming(text)),
        })
        .then((result) => {
          updateExplanation(id, (entry) => ({ ...entry, status: result.mode, text: result.text }));
          finished(result);
        })
        .catch(() => {})
        .finally(() => inFlight.delete(controller));
    },

    requestReview(facts, transcript) {
      if (state.review.status !== "idle") return;
      set({ ...state, review: { status: "writing" } });
      const controller = track();
      deps
        .requestReview({ missionId: mission.id, facts, transcript, signal: controller.signal })
        .then((result) => set({ ...state, review: { status: result.mode, review: result.review } }))
        .catch(() => set({ ...state, review: { status: "idle" } }))
        .finally(() => inFlight.delete(controller));
    },
  };
}

/** A session that never asks anything: for the styleguide, and for rendering in tests. */
export function staticMentorSession(state: MentorState = initialMentorState()): MentorSession {
  return {
    state,
    askHint: () => false,
    explain: () => {},
    requestReview: () => {},
  };
}
