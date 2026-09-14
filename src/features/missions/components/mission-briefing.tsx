"use client";

import Link from "next/link";
import type { RefObject } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { CheckIcon, PlayIcon } from "@/components/ui/icons";
import type { Mission } from "@/content/schemas/mission";
import { SKILLS } from "@/content/skills";
import { cx } from "@/lib/cx";
import { DIFFICULTY_LABELS, MissionText } from "./mission-text";
import type { MissionLinks } from "./types";

const LINK = cx(
  "rounded-sm font-medium text-accent underline-offset-4 hover:underline",
  FOCUS_RING,
);

interface MissionBriefingProps {
  mission: Mission;
  links: MissionLinks;
  onStart: () => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
}

/**
 * The briefing: short enough to read in 30 seconds. The hook, what you'll learn, the situation,
 * who you are, the written permission that makes it OK, how long it takes, "Best after" links
 * (a suggestion, never a lock), and one big Start mission button.
 */
export function MissionBriefing({ mission, links, onStart, headingRef }: MissionBriefingProps) {
  const { briefing } = mission;

  return (
    <article aria-labelledby="mission-briefing-title" className="mx-auto max-w-3xl">
      <p className="flex flex-wrap items-center gap-2 text-sm text-secondary">
        <span className="font-semibold text-accent">Mission briefing</span>
        <span aria-hidden="true">·</span>
        <span>{DIFFICULTY_LABELS[mission.difficulty]}</span>
        <span aria-hidden="true">·</span>
        <span>About {mission.estimatedMinutes} minutes</span>
      </p>
      <h1
        id="mission-briefing-title"
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 text-3xl font-semibold tracking-tight text-balance outline-none sm:text-4xl"
      >
        {mission.title}
      </h1>
      <p className="mt-3 text-xl leading-8 text-pretty text-primary">
        <MissionText text={mission.hook} />
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <section aria-labelledby="briefing-learn" className="sm:col-span-2">
          <h2 id="briefing-learn" className="text-sm font-semibold tracking-wide text-secondary">
            You&apos;ll learn
          </h2>
          <ul className="mt-2 space-y-1.5">
            {mission.learningGoals.map((goal) => (
              <li key={goal} className="flex gap-2 leading-7">
                <CheckIcon className="mt-1.5 size-4 shrink-0 text-accent" />
                <span>
                  <MissionText text={goal} />
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="briefing-situation">
          <h2
            id="briefing-situation"
            className="text-sm font-semibold tracking-wide text-secondary"
          >
            The situation
          </h2>
          <p className="mt-2 leading-7">
            <MissionText text={briefing.scenario} />
          </p>
        </section>

        <section aria-labelledby="briefing-role">
          <h2 id="briefing-role" className="text-sm font-semibold tracking-wide text-secondary">
            Your role
          </h2>
          <p className="mt-2 leading-7">
            <MissionText text={briefing.role} />
          </p>
        </section>

        <section
          aria-labelledby="briefing-authorization"
          className="rounded-lg border border-l-4 border-subtle border-l-status-info bg-surface-raised px-4 py-3 sm:col-span-2"
        >
          <h2 id="briefing-authorization" className="text-sm font-semibold text-status-info">
            Your written permission
          </h2>
          <p className="mt-1.5 leading-7 text-primary">
            <MissionText text={briefing.authorization} />
          </p>
        </section>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-sm text-secondary">Skills you&apos;ll practise:</span>
        {mission.skills.map((skill) => (
          <Badge key={skill} tone="accent">
            {SKILLS[skill].label}
          </Badge>
        ))}
      </div>

      {(links.bestAfter.length > 0 || links.concepts.length > 0) && (
        <div className="mt-6 space-y-2 text-sm leading-6 text-secondary">
          {links.bestAfter.length > 0 && (
            <p>
              Best after:{" "}
              {links.bestAfter.map((link, index) => (
                <span key={link.slug}>
                  {index > 0 && ", "}
                  <Link href={`/missions/${link.slug}`} className={LINK}>
                    {link.title}
                  </Link>
                </span>
              ))}
              . Every mission is open, so you can start here too.
            </p>
          )}
          {links.concepts.length > 0 && (
            <p>
              New to these ideas? Read up first:{" "}
              {links.concepts.map((link, index) => (
                <span key={link.id}>
                  {index > 0 && ", "}
                  <Link href={`/learn/${link.id}`} className={LINK}>
                    {link.title}
                  </Link>
                </span>
              ))}
              .
            </p>
          )}
        </div>
      )}

      <div className="mt-8 flex flex-col items-start gap-3">
        <Button variant="primary" size="lg" icon={<PlayIcon />} onClick={onStart}>
          Start mission
        </Button>
        <p className="text-sm text-muted">
          Hints are free. Nothing you do here is saved, so it&apos;s yours to try.
        </p>
      </div>
    </article>
  );
}
