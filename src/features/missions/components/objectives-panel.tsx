"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LightbulbIcon } from "@/components/ui/icons";
import { ObjectiveTick } from "@/components/ui/objective-tick";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Spinner } from "@/components/ui/spinner";
import type { Mission, Objective } from "@/content/schemas/mission";
import {
  buildMentorTranscript,
  nextTierUnlockTime,
  requestMentorHint,
  type HintTier,
} from "@/features/mentor";
import type { TerminalBlock } from "@/features/terminal";
import { cx } from "@/lib/cx";
import { missionProgress } from "../evaluate";
import {
  canAnswer,
  currentObjective,
  HINT_TIERS,
  visibleObjectives,
  type MissionRunState,
} from "../run/mission-run";
import { AnswerInput } from "./answer-input";
import { MissionText, plainMissionText } from "./mission-text";

interface ObjectivesPanelProps {
  mission: Mission;
  run: MissionRunState;
  onAnswer: (objectiveId: string, answer: string) => void;
  onHint: (objectiveId: string) => void;
  /** The objective whose answer box shows in the story panel instead of here. */
  answeringInStory?: string;
  /**
   * The learner's terminal activity, so a hint request can tell Noor what they actually tried
   * (phase 10). Optional: when absent, an empty transcript is sent and hints still work.
   */
  terminalBlocks?: readonly TerminalBlock[];
}

/**
 * The live checklist: every main and bonus objective, and each secret once it's found. Each one
 * opens to show why it matters and its hints (three tiers, free, never counted anywhere). The
 * current objective starts open. Ticks and success lines come from ObjectiveTick, instantly.
 *
 * Hints are the mentor's (phase 10): tier 1 is available at once, later tiers unlock after a short
 * cooldown so the learner gets a moment to try the previous one. When a tier is shown, Noor
 * personalises the authored hint to what the learner tried; while it streams, a small status shows,
 * and if the model is unavailable the authored text shows verbatim, still in Noor's voice.
 */
export function ObjectivesPanel({
  mission,
  run,
  onAnswer,
  onHint,
  answeringInStory,
  terminalBlocks,
}: ObjectivesPanelProps) {
  const current = currentObjective(mission, run);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const progress = missionProgress(mission, run.completed);
  const objectives = visibleObjectives(mission, run);
  const main = objectives.filter((objective) => !objective.optional);
  const extra = objectives.filter((objective) => objective.optional);

  // The current objective is open unless the learner closed it; others open when asked.
  const isOpen = (objective: Objective) =>
    objective.id === current?.id ? !collapsed.has(objective.id) : expanded.has(objective.id);
  const toggle = (objective: Objective) => {
    const set = objective.id === current?.id ? collapsed : expanded;
    const next = new Set(set);
    if (next.has(objective.id)) next.delete(objective.id);
    else next.add(objective.id);
    (objective.id === current?.id ? setCollapsed : setExpanded)(next);
  };

  const item = (objective: Objective) => {
    const done = run.completed.includes(objective.id);
    const open = isOpen(objective);
    const detailsId = `objective-${objective.id}-details`;
    const hints = mission.hints[objective.id];
    const answerable = canAnswer(mission, run, objective);

    const details = (
      <div className="mt-1">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => toggle(objective)}
          className="rounded-sm text-sm font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          {open ? "Hide details" : done ? "Why it mattered" : "Why this matters"}
        </button>
        <div id={detailsId} hidden={!open} className="mt-2 space-y-3">
          <p className="text-sm leading-6 text-secondary">
            <MissionText text={objective.why} />
          </p>
          {!done && answerable && answeringInStory !== objective.id && (
            <AnswerInput
              objective={objective}
              tried={run.answers[objective.id] ?? []}
              feedback={run.feedback[objective.id]}
              onAnswer={(answer) => onAnswer(objective.id, answer)}
            />
          )}
          {!done && answeringInStory === objective.id && (
            <p className="text-sm leading-6 text-secondary">Your move: answer in the team chat.</p>
          )}
          {!done && objective.check.kind === "answer" && !answerable && (
            <p className="text-sm leading-6 text-muted">
              You&apos;ll answer this once the steps above are done.
            </p>
          )}
          {!done && hints && (
            <HintLadder
              mission={mission}
              objective={objective}
              alreadyShown={run.hintsShown[objective.id] ?? 0}
              onHint={onHint}
              terminalBlocks={terminalBlocks}
            />
          )}
        </div>
      </div>
    );

    const label = (
      <>
        {objective.name && (
          <span className="font-semibold text-primary">
            {objective.name}
            {": "}
          </span>
        )}
        <MissionText text={objective.description} />
        {objective.hidden && <span className="sr-only"> (secret)</span>}
      </>
    );

    return (
      <ObjectiveTick
        key={objective.id}
        bonus={objective.optional && !objective.hidden}
        details={details}
        className={cx("rounded-lg px-2 py-2", objective.id === current?.id && "bg-surface-overlay")}
        {...(done
          ? ({
              status: "done",
              success: (
                <span>
                  <MissionText text={objective.success} />
                </span>
              ),
            } as const)
          : ({ status: "open" } as const))}
      >
        {label}
      </ObjectiveTick>
    );
  };

  return (
    <section
      aria-labelledby="objectives-title"
      className="rounded-xl border border-subtle bg-surface-raised"
    >
      <header className="border-b border-subtle px-4 py-3">
        <h2 id="objectives-title" className="text-sm font-semibold tracking-wide">
          Objectives
        </h2>
        <ProgressBar
          className="mt-2"
          label="Main objectives done"
          value={progress.done}
          max={progress.total}
          showValue
        />
      </header>
      <ul className="space-y-1 p-2">{main.map(item)}</ul>
      {extra.length > 0 && (
        <div className="border-t border-subtle p-2">
          <h3 className="px-2 pt-1 text-sm font-semibold text-secondary">For the curious</h3>
          <ul className="mt-1 space-y-1">{extra.map(item)}</ul>
          <p className="px-2 pb-1 text-sm leading-6 text-muted">
            Bonus objectives are optional, and secrets stay hidden until you find them.
          </p>
        </div>
      )}
    </section>
  );
}

/** The mentor's phrasing of one hint tier, kept in memory for the run so a re-render never refetches. */
interface MentorHint {
  /** `writing` while the text streams, then `model` (Noor's rewrite) or `fallback` (authored text). */
  readonly status: "writing" | "model" | "fallback";
  readonly text: string;
}

/**
 * The hint ladder for one objective. Tier 1 is free and immediate; each later tier unlocks after a
 * short cooldown, shown as a calm countdown (never as a penalty — hints are free). Revealing a tier
 * asks Noor to personalise the authored hint; her text streams in, and falls back to the authored
 * text verbatim if the model is unavailable. Tier reveal times and Noor's text live in this
 * component, so they reset with each attempt (nothing is stored) and never refetch on a re-render.
 *
 * `alreadyShown` comes from the run store: after the workspace remounts (back from the debrief),
 * tiers shown before stay shown, in their authored words, with no cooldown and no new request.
 */
function HintLadder({
  mission,
  objective,
  alreadyShown,
  onHint,
  terminalBlocks,
}: {
  mission: Mission;
  objective: Objective;
  alreadyShown: number;
  onHint: (objectiveId: string) => void;
  terminalBlocks?: readonly TerminalBlock[];
}) {
  const authoredTiers = mission.hints[objective.id];
  // Local tier state: reveal timestamps (one per tier shown) and Noor's text per tier. Tiers shown
  // before a remount count as shown long ago, so their cooldown has passed.
  const [revealTimes, setRevealTimes] = useState<readonly number[]>(() =>
    Array.from({ length: Math.min(alreadyShown, HINT_TIERS) }, () => 0),
  );
  const [mentorByTier, setMentorByTier] = useState<Readonly<Record<number, MentorHint>>>({});
  const [now, setNow] = useState(() => Date.now());
  // One array for the ladder's whole life, so the unmount cleanup sees every request made.
  const controllers = useRef<AbortController[]>([]);
  const cooldownId = useId();
  // Read once to a screen reader when a hint's final words land, never while they stream in.
  const [spoken, setSpoken] = useState("");

  const shown = revealTimes.length;
  const lastRevealAt = revealTimes[shown - 1];
  const unlockAt = lastRevealAt === undefined ? undefined : nextTierUnlockTime(lastRevealAt);
  const cooldownLeft = unlockAt === undefined ? 0 : Math.max(0, unlockAt - now);

  // Tick a light clock only while a cooldown is counting down, so the countdown updates.
  useEffect(() => {
    if (unlockAt === undefined || shown >= HINT_TIERS || Date.now() >= unlockAt) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= unlockAt) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [unlockAt, shown]);

  // Abort any in-flight hint request when the ladder unmounts (restart, or leaving the mission).
  useEffect(() => {
    const inFlight = controllers.current;
    return () => {
      for (const controller of inFlight) controller.abort();
    };
  }, []);

  if (!authoredTiers) return null;

  const reveal = () => {
    const tier = (shown + 1) as HintTier;
    // The button stays focusable during a cooldown (aria-disabled), so a press then does nothing.
    if (tier > HINT_TIERS || cooldownLeft > 0) return;
    onHint(objective.id); // keep the run store's tier count in step
    setRevealTimes((times) => [...times, Date.now()]);

    const controller = new AbortController();
    controllers.current.push(controller);
    setMentorByTier((current) => ({ ...current, [tier]: { status: "writing", text: "" } }));
    void requestMentorHint({
      mission,
      objectiveId: objective.id,
      tier,
      transcript: buildMentorTranscript(terminalBlocks ?? []),
      signal: controller.signal,
      onText: (text) =>
        setMentorByTier((current) => {
          const existing = current[tier];
          // Once the final result has landed, don't let a trailing chunk overwrite it.
          if (existing && existing.status !== "writing") return current;
          return { ...current, [tier]: { status: "writing", text } };
        }),
    })
      .then((result) => {
        setMentorByTier((current) => ({
          ...current,
          [tier]: { status: result.mode, text: result.text },
        }));
        setSpoken(`Hint ${tier} from Noor: ${plainMissionText(result.text)}`);
      })
      .catch(() => {
        // Only a caller-triggered abort reaches here; nothing to show.
      });
  };

  const remainingSeconds = Math.ceil(cooldownLeft / 1000);

  return (
    <div className="space-y-2">
      {shown > 0 && (
        <ol className="space-y-2" aria-label="Hints from Noor">
          {Array.from({ length: shown }, (_, index) => {
            const tier = (index + 1) as HintTier;
            const authored = authoredTiers[index] ?? "";
            const mentor = mentorByTier[tier];
            const text = mentor && mentor.text.trim() !== "" ? mentor.text : authored;
            const writing = mentor?.status === "writing" && mentor.text.trim() === "";
            return (
              <li
                key={tier}
                className="rounded-md border border-subtle bg-surface-base px-3 py-2 text-sm leading-6"
              >
                <div className="flex gap-2">
                  <LightbulbIcon className="mt-0.5 size-4 shrink-0 text-accent" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-accent">
                      Noor · hint {tier} of {HINT_TIERS}
                    </p>
                    {writing ? (
                      <p className="mt-1 flex items-center gap-2 text-secondary">
                        <Spinner className="size-4 text-accent" />
                        <span>Noor is writing a hint…</span>
                      </p>
                    ) : (
                      <p className="mt-1 text-secondary">
                        <MissionText text={text} />
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {shown < HINT_TIERS && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* It stays in place, and focusable, while the next tier waits: pressing it then does
              nothing, and focus never drops to the page. */}
          <Button
            variant="ghost"
            size="sm"
            icon={<LightbulbIcon />}
            onClick={reveal}
            aria-disabled={cooldownLeft > 0 || undefined}
            aria-describedby={cooldownLeft > 0 ? cooldownId : undefined}
            className="aria-disabled:cursor-not-allowed aria-disabled:text-muted"
          >
            {shown === 0 ? "Show me a hint" : "Show me another hint"}
          </Button>
          {cooldownLeft > 0 && (
            <p id={cooldownId} className="text-sm leading-6 text-muted">
              Give this one a try.{" "}
              {/* The seconds tick for sighted learners; a screen reader hears a steady sentence. */}
              <span aria-hidden="true">
                Another hint in {remainingSeconds} {remainingSeconds === 1 ? "second" : "seconds"}.
              </span>
              <span className="sr-only">Another hint is ready in a few seconds.</span>
            </p>
          )}
        </div>
      )}

      {shown > 0 && (
        <p className="text-xs leading-5 text-muted">Hints are free. Use as many as you like.</p>
      )}
      <p aria-live="polite" className="sr-only">
        {spoken}
      </p>
    </div>
  );
}
