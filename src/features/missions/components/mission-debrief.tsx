"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { ArrowRightIcon, CheckIcon, SparkleIcon } from "@/components/ui/icons";
import { MissionComplete } from "@/components/ui/mission-complete";
import type { Mission } from "@/content/schemas/mission";
import { SKILLS } from "@/content/skills";
import { cx } from "@/lib/cx";
import { rewardSummary, type MissionRunAction, type MissionRunState } from "../run/mission-run";
import { MissionText } from "./mission-text";
import type { MissionLinks } from "./types";

const LINK = cx(
  "rounded-sm font-medium text-accent underline-offset-4 hover:underline",
  FOCUS_RING,
);

interface MissionDebriefProps {
  mission: Mission;
  run: MissionRunState;
  links: MissionLinks;
  dispatch: (action: MissionRunAction) => void;
}

function Block({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="rounded-xl border border-subtle bg-surface-raised p-5">
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      <div className="mt-2 leading-7 text-secondary">{children}</div>
    </section>
  );
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/**
 * The debrief: the celebration first (what you did, the skills you practised, the bonus objectives
 * and secrets you found, what you learned), then the ethics note, how a defender stops this, some
 * further reading, and the next mission with its tease. Hints never appear here: using one is
 * never a mark against anyone.
 */
export function MissionDebrief({ mission, run, links, dispatch }: MissionDebriefProps) {
  const { debrief } = mission;
  const rewards = rewardSummary(mission, run);
  const secretsLeft = rewards.secretsTotal - rewards.secretsFound.length;
  const bonusLeft = rewards.bonusTotal - rewards.bonusFound.length;
  const rootRef = useRef<HTMLDivElement>(null);

  // Focus the "Mission complete" heading, so keyboard and screen reader users start at the top.
  useEffect(() => {
    rootRef.current?.querySelector<HTMLElement>("h1")?.focus();
  }, []);

  return (
    <div ref={rootRef} className="mx-auto max-w-3xl space-y-6">
      <MissionComplete
        missionTitle={mission.title}
        skills={mission.skills.map((skill) => SKILLS[skill].label)}
        headingLevel="h1"
      >
        <MissionText text={debrief.summary} />
      </MissionComplete>

      {(rewards.bonusTotal > 0 || rewards.secretsTotal > 0) && (
        <section
          aria-labelledby="debrief-extras"
          className="rounded-xl border border-reward bg-surface-raised p-5"
        >
          <h2
            id="debrief-extras"
            className="flex items-center gap-2 text-lg font-semibold text-reward"
          >
            <SparkleIcon className="size-5" />
            For the curious
          </h2>
          <ul className="mt-3 space-y-2 leading-7">
            {rewards.bonusTotal > 0 && (
              <li>
                <span className="font-semibold text-primary">
                  {rewards.bonusFound.length} of {rewards.bonusTotal}{" "}
                  {plural(rewards.bonusTotal, "bonus objective", "bonus objectives")} done
                </span>
                {rewards.bonusFound.length > 0 && (
                  <span className="text-secondary">
                    : {rewards.bonusFound.map((objective) => objective.name).join(", ")}
                  </span>
                )}
              </li>
            )}
            {rewards.secretsTotal > 0 && (
              <li>
                <span className="font-semibold text-primary">
                  {rewards.secretsFound.length} of {rewards.secretsTotal}{" "}
                  {plural(rewards.secretsTotal, "secret", "secrets")} found
                </span>
                {rewards.secretsFound.length > 0 && (
                  <span className="text-secondary">
                    : {rewards.secretsFound.map((objective) => objective.name).join(", ")}
                  </span>
                )}
              </li>
            )}
          </ul>
          {(secretsLeft > 0 || bonusLeft > 0) && (
            <p className="mt-2 text-sm leading-6 text-secondary">
              {secretsLeft > 0
                ? `${secretsLeft === 1 ? "1 secret is" : `${secretsLeft} secrets are`} still hidden.`
                : `${bonusLeft === 1 ? "1 bonus objective is" : `${bonusLeft} bonus objectives are`} still open.`}{" "}
              Keep exploring now, or replay any time to hunt for{" "}
              {secretsLeft + bonusLeft === 1 ? "it" : "them"}.
            </p>
          )}
        </section>
      )}

      <Block id="debrief-learned" title="What you learned">
        <ul className="space-y-1.5">
          {debrief.whatYouLearned.map((line) => (
            <li key={line} className="flex gap-2 text-primary">
              <CheckIcon className="mt-1.5 size-4 shrink-0 text-status-success" />
              <span>
                <MissionText text={line} />
              </span>
            </li>
          ))}
        </ul>
      </Block>

      <Block id="debrief-ethics" title="Doing this for real">
        <p>
          <MissionText text={debrief.ethicsNote} />
        </p>
      </Block>

      <Block id="debrief-defence" title="How defenders stop this">
        <p>
          <MissionText text={debrief.defensiveTakeaway} />
        </p>
      </Block>

      {links.furtherReading.length > 0 && (
        <Block id="debrief-reading" title="Read more">
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {links.furtherReading.map((lesson) => (
              <li key={lesson.id}>
                <Link href={`/learn/${lesson.id}`} className={LINK}>
                  {lesson.title}
                </Link>
              </li>
            ))}
          </ul>
        </Block>
      )}

      <section
        aria-labelledby="debrief-next"
        className="rounded-xl border border-accent bg-accent-subtle p-5"
      >
        <h2 id="debrief-next" className="text-sm font-semibold tracking-wide text-accent">
          Next time
        </h2>
        <p className="mt-2 text-lg leading-8 text-primary">
          <MissionText text={debrief.nextTease} />
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {links.next ? (
            <ButtonLink
              href={`/missions/${links.next.slug}`}
              variant="primary"
              icon={<ArrowRightIcon />}
            >
              Next mission: {links.next.title}
            </ButtonLink>
          ) : (
            <ButtonLink href="/missions" variant="primary" icon={<ArrowRightIcon />}>
              See all missions
            </ButtonLink>
          )}
          <Button variant="secondary" onClick={() => dispatch({ type: "resume" })}>
            Keep exploring this mission
          </Button>
          <Button variant="ghost" onClick={() => dispatch({ type: "restart" })}>
            Play it again
          </Button>
        </div>
      </section>
    </div>
  );
}
