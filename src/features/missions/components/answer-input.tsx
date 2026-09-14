"use client";

import { useId, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CharacterMessage } from "@/components/ui/character-message";
import { getCastMember } from "@/content/cast";
import type { AnswerCheck, Objective } from "@/content/schemas/mission";
import { normalizeAnswer } from "@/content/schemas/mission-helpers";
import { cx } from "@/lib/cx";
import type { AnswerFeedback } from "../run/mission-run";
import { MissionText } from "./mission-text";

interface AnswerInputProps {
  objective: Objective;
  /** Answers already submitted for this objective, oldest first. */
  tried: readonly string[];
  feedback: AnswerFeedback | undefined;
  onAnswer: (answer: string) => void;
  /**
   * The input sits under the team chat, where a choice's reply already shows as the newest message:
   * don't repeat it here.
   */
  inChat?: boolean;
}

/**
 * How the learner answers an `answer` objective: a button per choice when the mission gives
 * choices, or a text box. A choice that isn't accepted gets its character's reply, a "Not this one"
 * label (never colour alone), and the learner picks again. Nothing is a fail screen.
 */
export function AnswerInput({
  objective,
  tried,
  feedback,
  onAnswer,
  inChat = false,
}: AnswerInputProps) {
  const check = objective.check as AnswerCheck;
  const id = useId();
  const [text, setText] = useState("");
  const triedSet = new Set(tried.map(normalizeAnswer));
  const replySpeaker = feedback?.reply ? getCastMember(feedback.reply.speaker) : undefined;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (text.trim() === "") return;
    onAnswer(text);
    setText("");
  };

  return (
    <div className="space-y-3">
      {check.choices ? (
        <fieldset>
          <legend className="sr-only">
            <MissionText text={objective.description} />
          </legend>
          <ul className="flex flex-col gap-2">
            {check.choices.map((choice) => {
              const wasTried = triedSet.has(normalizeAnswer(choice.text));
              return (
                <li key={choice.text}>
                  <button
                    type="button"
                    onClick={() => onAnswer(choice.text)}
                    className={cx(
                      "flex w-full items-start justify-between gap-3 rounded-lg border px-4 py-3 text-left leading-6 font-medium transition-colors",
                      "border-strong bg-surface-base text-primary hover:border-accent hover:bg-surface-overlay",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
                    )}
                  >
                    <span>
                      <MissionText text={choice.text} />
                    </span>
                    {wasTried && (
                      <Badge tone="warning" className="shrink-0">
                        Not this one
                      </Badge>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ) : (
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <label htmlFor={`${id}-answer`} className="sr-only">
            Your answer
          </label>
          <input
            id={`${id}-answer`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="Type your answer"
            className="h-10 min-w-0 flex-1 rounded-md border border-strong bg-surface-base px-3 font-mono text-primary placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          />
          <Button type="submit" variant="secondary">
            Check my answer
          </Button>
        </form>
      )}

      <div aria-live="polite" className="empty:hidden">
        {feedback && !feedback.accepted && (
          <div className="animate-rise-in space-y-2">
            {feedback.reply && replySpeaker ? (
              inChat ? (
                <p className="text-sm leading-6 text-secondary">
                  {replySpeaker.name} replied above. Pick again.
                </p>
              ) : (
                <CharacterMessage
                  speaker={{
                    name: replySpeaker.name,
                    role: replySpeaker.role,
                    initials: replySpeaker.initials,
                  }}
                  tone={replySpeaker.tone}
                >
                  <MissionText text={feedback.reply.text} />
                </CharacterMessage>
              )
            ) : (
              <p className="leading-7 text-secondary">
                &ldquo;{feedback.answer}&rdquo; isn&apos;t it yet. Check the spelling, or open a
                hint for a nudge.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
