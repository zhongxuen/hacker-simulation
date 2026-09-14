"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LightbulbIcon } from "@/components/ui/icons";
import { ObjectiveTick } from "@/components/ui/objective-tick";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { Mission, Objective } from "@/content/schemas/mission";
import {
  HINT_TIER_LABELS,
  HINTS_ARE_FREE,
  MENTOR_FIRST_NAME,
  type HintTier,
} from "@/features/mentor";
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
import { MissionText } from "./mission-text";

interface ObjectivesPanelProps {
  mission: Mission;
  run: MissionRunState;
  onAnswer: (objectiveId: string, answer: string) => void;
  /** How many hint tiers the mentor has shown for an objective (phase 10). */
  hintsShown: (objectiveId: string) => number;
  /** Show the first hint for an objective, in the mentor panel. */
  onHint: (objectiveId: string) => void;
  /** Open the mentor panel on an objective's hints, where the next one can be asked for. */
  onOpenHints: (objectiveId: string) => void;
  /** The objective whose answer box shows in the story panel instead of here. */
  answeringInStory?: string;
}

/**
 * The live checklist: every main and bonus objective, and each secret once it's found. Each one
 * opens to show why it matters and a way to its hints (three tiers, free, never counted anywhere).
 * The current objective starts open. Ticks and success lines come from ObjectiveTick, instantly.
 *
 * Hints are the mentor's (phase 10), and they live in the mentor panel, so there's one place to
 * read them: "Show me a hint" here shows the first one there, and "See the hints" opens the panel
 * on this step, where the next tier waits for its short cooldown.
 */
export function ObjectivesPanel({
  mission,
  run,
  onAnswer,
  hintsShown,
  onHint,
  onOpenHints,
  answeringInStory,
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
            <HintButton
              objectiveId={objective.id}
              shown={hintsShown(objective.id)}
              onHint={onHint}
              onOpenHints={onOpenHints}
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

/**
 * The way to an objective's hints. Before any is open, it shows the first one (in the mentor panel).
 * After that it says which hint the learner is on, and opens the panel, where the next one waits.
 * Hints are free, and it says so.
 */
function HintButton({
  objectiveId,
  shown,
  onHint,
  onOpenHints,
}: {
  objectiveId: string;
  shown: number;
  onHint: (objectiveId: string) => void;
  onOpenHints: (objectiveId: string) => void;
}) {
  const tier = Math.min(shown, HINT_TIERS) as HintTier;
  return (
    <div className="space-y-1">
      <Button
        variant="ghost"
        size="sm"
        icon={<LightbulbIcon />}
        aria-haspopup="dialog"
        onClick={() => (shown === 0 ? onHint(objectiveId) : onOpenHints(objectiveId))}
      >
        {shown === 0 ? "Show me a hint" : `See ${MENTOR_FIRST_NAME}'s hints`}
      </Button>
      <p className="px-3 text-xs leading-5 text-muted">
        {shown > 0 && `You're on hint ${tier} of ${HINT_TIERS}: ${HINT_TIER_LABELS[tier]}. `}
        {HINTS_ARE_FREE}
      </p>
    </div>
  );
}
