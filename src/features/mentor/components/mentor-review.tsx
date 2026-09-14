"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CharacterMessage } from "@/components/ui/character-message";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { ArrowRightIcon, CheckIcon, LightbulbIcon, SparkleIcon } from "@/components/ui/icons";
import { MENTOR } from "@/content/cast";
import { cx } from "@/lib/cx";
import { runFactLines, type ReviewFacts } from "../review";
import type { MentorReviewState } from "../session/mentor-store";
import { FROM_NOTES_LABEL, MENTOR_FIRST_NAME, MENTOR_SPEAKER } from "./mentor-bubble";
import { CodeSpans, MentorText } from "./mentor-text";
import { TypingIndicator } from "./typing-indicator";

const LINK = cx(
  "inline-flex items-center gap-1 rounded-sm font-medium text-accent underline-offset-4 hover:underline",
  FOCUS_RING,
);

export interface MentorReviewCardProps {
  state: MentorReviewState;
  facts: ReviewFacts;
  /** A lesson's title, from the mission's own lesson links. Lessons without one aren't shown. */
  lessonTitle: (lessonId: string) => string | undefined;
  /** The learner asked for the review. */
  onRequest: () => void;
}

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold tracking-wide text-secondary">{title}</h3>
      <div className="mt-1 leading-7 text-primary">{children}</div>
    </div>
  );
}

/**
 * The post-mission review on the debrief (md-files/10-ai-mentor.md, prompt 10.4). The learner asks
 * for it (their commands only ever leave the browser when they ask the mentor for something), and
 * Noor looks back at the run: something they did well first, their approach, what went smoothly,
 * any scenic routes, and lessons to try next — formative feedback in her voice, never a grade.
 *
 * The review is held with the mission attempt, so re-rendering the debrief, or going back to explore
 * and returning, never asks the model again. When the model is unavailable the template review shows
 * instead: the same facts (objectives, time, hints opened, commands tried), still in Noor's voice.
 */
export function MentorReviewCard({ state, facts, lessonTitle, onRequest }: MentorReviewCardProps) {
  const id = useId();
  const review = state.review;
  const lessons = (review?.tryNext ?? []).flatMap((lesson) => {
    const title = lessonTitle(lesson.lessonId);
    return title ? [{ ...lesson, title }] : [];
  });

  return (
    <section
      aria-labelledby={`${id}-title`}
      aria-busy={state.status === "writing" || undefined}
      className="rounded-xl border border-accent bg-surface-raised p-5"
    >
      <h2 id={`${id}-title`} className="flex items-center gap-2 text-lg font-semibold">
        <SparkleIcon className="size-5 text-accent" />
        Looking back with {MENTOR_FIRST_NAME}
      </h2>
      <p className="mt-1 text-sm leading-6 text-secondary">
        Feedback to help with your next mission. It isn&apos;t a grade, and nothing about it is
        kept.
      </p>

      <div className="mt-4 space-y-5" aria-live="polite">
        {state.status === "idle" && (
          <>
            <CharacterMessage speaker={MENTOR_SPEAKER} tone={MENTOR.tone}>
              Want to look back at your run together? I&apos;ll point out what went well, and a
              lesson or two to try next.
            </CharacterMessage>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button variant="primary" icon={<LightbulbIcon />} onClick={onRequest}>
                Ask {MENTOR_FIRST_NAME} to look back at my run
              </Button>
              <p className="text-sm leading-6 text-muted">
                {MENTOR_FIRST_NAME} reads the commands you ran in this mission to write it.
              </p>
            </div>
          </>
        )}

        {state.status === "writing" && (
          <CharacterMessage speaker={MENTOR_SPEAKER} tone={MENTOR.tone}>
            <TypingIndicator label={`${MENTOR_FIRST_NAME} is reading through your run…`} />
          </CharacterMessage>
        )}

        {review && state.status !== "writing" && state.status !== "idle" && (
          <>
            <CharacterMessage speaker={MENTOR_SPEAKER} tone={MENTOR.tone}>
              <MentorText text={review.wellDone} />
            </CharacterMessage>

            <Part title="How you went about it">
              <MentorText text={review.approach} />
            </Part>

            {review.efficientSteps.length > 0 && (
              <Part title="What went smoothly">
                <ul className="space-y-1.5">
                  {review.efficientSteps.map((step) => (
                    <li key={step} className="flex gap-2">
                      <CheckIcon className="mt-1.5 size-4 shrink-0 text-status-success" />
                      <span>
                        <CodeSpans text={step} />
                      </span>
                    </li>
                  ))}
                </ul>
              </Part>
            )}

            {review.detours.length > 0 && (
              <Part title="Worth knowing for next time">
                <ul className="space-y-1.5">
                  {review.detours.map((detour) => (
                    <li key={detour} className="flex gap-2">
                      <LightbulbIcon className="mt-1.5 size-4 shrink-0 text-accent" />
                      <span>
                        <CodeSpans text={detour} />
                      </span>
                    </li>
                  ))}
                </ul>
              </Part>
            )}

            {lessons.length > 0 && (
              <Part title="Try next">
                <ul className="space-y-2">
                  {lessons.map((lesson) => (
                    <li key={lesson.lessonId}>
                      <Link href={`/learn/${lesson.lessonId}`} className={LINK}>
                        {lesson.title}
                        <ArrowRightIcon className="size-4" />
                      </Link>
                      {lesson.why && (
                        <span className="block text-sm leading-6 text-secondary">
                          <CodeSpans text={lesson.why} />
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </Part>
            )}

            <p className="leading-7 text-primary">
              <CodeSpans text={review.signOff} />
            </p>

            <div className="rounded-lg border border-subtle bg-surface-base p-4">
              <h3 className="text-sm font-semibold tracking-wide text-secondary">
                Your run at a glance
              </h3>
              <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-sm leading-6 sm:grid-cols-[max-content_1fr]">
                {runFactLines(facts).map((line) => (
                  <div key={line.label} className="contents">
                    <dt className="font-medium text-primary">{line.label}</dt>
                    <dd className="text-secondary">
                      <CodeSpans text={line.value} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {state.status === "fallback" && (
              <p className="text-xs leading-5 text-muted">{FROM_NOTES_LABEL}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
