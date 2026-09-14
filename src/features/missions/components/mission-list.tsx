"use client";

import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowRightIcon } from "@/components/ui/icons";
import { MISSION_DIFFICULTIES, type MissionDifficulty } from "@/content/schemas/mission";
import { SKILL_IDS, SKILLS, type Skill } from "@/content/skills";
import { cx } from "@/lib/cx";
import { DIFFICULTY_LABELS, MissionText } from "./mission-text";
import type { MissionSummary } from "./mission-summary";

const CHIP = cx(
  "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium",
  "border-strong text-secondary hover:border-accent hover:text-primary",
  "aria-pressed:border-accent aria-pressed:bg-accent-subtle aria-pressed:text-primary",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
);

/**
 * The mission list, filterable by skill and difficulty. Every mission is open from the start:
 * "Best after" is a suggestion, and the first mission is marked "Start here".
 */
export function MissionList({
  missions,
  startHereId,
}: {
  missions: readonly MissionSummary[];
  startHereId: string;
}) {
  const [skill, setSkill] = useState<Skill | null>(null);
  const [difficulty, setDifficulty] = useState<MissionDifficulty | null>(null);
  const id = useId();
  const skills = SKILL_IDS.filter((candidate) =>
    missions.some((m) => m.skills.includes(candidate)),
  );
  const difficulties = MISSION_DIFFICULTIES.filter((candidate) =>
    missions.some((m) => m.difficulty === candidate),
  );
  const shown = missions.filter(
    (mission) =>
      (skill === null || mission.skills.includes(skill)) &&
      (difficulty === null || mission.difficulty === difficulty),
  );

  return (
    <div>
      <div className="space-y-3">
        <div
          role="group"
          aria-labelledby={`${id}-skill`}
          className="flex flex-wrap items-center gap-2"
        >
          <span id={`${id}-skill`} className="mr-1 text-sm font-semibold text-secondary">
            Skill
          </span>
          <button
            type="button"
            aria-pressed={skill === null}
            onClick={() => setSkill(null)}
            className={CHIP}
          >
            All
          </button>
          {skills.map((candidate) => (
            <button
              key={candidate}
              type="button"
              aria-pressed={skill === candidate}
              onClick={() => setSkill(skill === candidate ? null : candidate)}
              className={CHIP}
            >
              {SKILLS[candidate].label}
            </button>
          ))}
        </div>
        <div
          role="group"
          aria-labelledby={`${id}-level`}
          className="flex flex-wrap items-center gap-2"
        >
          <span id={`${id}-level`} className="mr-1 text-sm font-semibold text-secondary">
            Level
          </span>
          <button
            type="button"
            aria-pressed={difficulty === null}
            onClick={() => setDifficulty(null)}
            className={CHIP}
          >
            All
          </button>
          {difficulties.map((candidate) => (
            <button
              key={candidate}
              type="button"
              aria-pressed={difficulty === candidate}
              onClick={() => setDifficulty(difficulty === candidate ? null : candidate)}
              className={CHIP}
            >
              {DIFFICULTY_LABELS[candidate]}
            </button>
          ))}
        </div>
      </div>

      <p aria-live="polite" className="mt-4 text-sm text-muted">
        {shown.length === missions.length
          ? `${missions.length} ${missions.length === 1 ? "mission" : "missions"}, all open to play.`
          : `Showing ${shown.length} of ${missions.length} missions.`}
      </p>

      {shown.length === 0 ? (
        <EmptyState
          className="mt-4"
          title="No missions match those filters yet"
          description="More missions are on the way. Clear a filter to see the rest."
        />
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((mission) => (
            <li key={mission.id}>
              <Card href={`/missions/${mission.slug}`} className="flex items-start gap-4">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold">{mission.title}</span>
                    {mission.id === startHereId && (
                      <Badge tone="accent" appearance="solid">
                        Start here
                      </Badge>
                    )}
                  </span>
                  <span className="mt-1 block leading-7 text-secondary">
                    <MissionText text={mission.hook} />
                  </span>
                  <span className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge>{DIFFICULTY_LABELS[mission.difficulty]}</Badge>
                    <span className="text-sm text-secondary">
                      About {mission.estimatedMinutes} min
                    </span>
                    {mission.skills.map((candidate) => (
                      <Badge key={candidate} tone="accent">
                        {SKILLS[candidate].label}
                      </Badge>
                    ))}
                  </span>
                  {mission.bestAfter.length > 0 && (
                    <span className="mt-2 block text-sm text-muted">
                      Best after: {mission.bestAfter.join(", ")}
                    </span>
                  )}
                </span>
                <ArrowRightIcon aria-hidden="true" className="mt-1 size-5 shrink-0 text-accent" />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
