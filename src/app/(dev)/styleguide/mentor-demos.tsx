"use client";

/**
 * Live demos and frozen pictures for the "Mentor" section. They need state or callbacks, which a
 * server component can't hand to client components. Nothing here calls the mentor routes: every
 * reply is written out below.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  buildFallbackReview,
  MentorBubble,
  MentorReviewCard,
  NudgeChip,
  TypingIndicator,
  type MentorReplyStatus,
  type MentorReview,
  type MentorReviewState,
  type ReviewFacts,
} from "@/features/mentor";

const noop = () => {};

const HINT_TEXT: Readonly<Record<MentorReplyStatus, string>> = {
  writing: "",
  model:
    "Good instinct listing the folder first. Now look at the last three letters for `database.conf`: they're the rules for everyone else.",
  fallback: "Every file has a lock that says who may read it. There's a way to make `ls` show it.",
};

/** One hint bubble, in one of its three states. */
export function HintBubbleDemo({ status }: { status: MentorReplyStatus }) {
  return (
    <div className="w-md max-w-full">
      <MentorBubble
        reply={{ status, text: HINT_TEXT[status] }}
        label={`Hint ${status === "fallback" ? 1 : 2} of 3 · ${status === "fallback" ? "a nudge" : "the idea"}`}
      />
    </div>
  );
}

export function TypingIndicatorDemo() {
  return <TypingIndicator label="Noor is writing…" />;
}

/** The nudge chip: dismiss it, then bring it back. */
export function NudgeChipDemo() {
  const [shown, setShown] = useState(true);
  return shown ? (
    <NudgeChip onAccept={noop} onDismiss={() => setShown(false)} />
  ) : (
    <Button variant="secondary" size="sm" onClick={() => setShown(true)}>
      Show the chip again
    </Button>
  );
}

export function NudgeChipPicture() {
  return <NudgeChip onAccept={noop} onDismiss={noop} />;
}

const FACTS: ReviewFacts = {
  missionTitle: "Reading the machine",
  objectives: [
    { id: "a", description: "Look around with `ls`", kind: "main", done: true, hintsOpened: 0 },
    { id: "b", description: "Read the notes", kind: "main", done: true, hintsOpened: 1 },
    { id: "c", description: "Lock the file", kind: "main", done: true, hintsOpened: 2 },
    {
      id: "d",
      name: "Read the Label",
      description: "Read `man chmod`",
      kind: "bonus",
      done: true,
      hintsOpened: 0,
    },
  ],
  minutes: 9,
  commandLines: ["ls", "cat welcome-from-roz.txt", "ls -l /srv/orders/config", "sudo chmod 640 x"],
  resets: 0,
  lessonIds: ["linux-permissions", "sec-least-privilege"],
};

const LESSON_TITLES: Readonly<Record<string, string>> = {
  "linux-permissions": "File permissions",
  "sec-least-privilege": "Least privilege",
};

const MODEL_REVIEW: MentorReview = {
  wellDone:
    "You checked who could read `database.conf` with `ls -l` before you changed anything. That's exactly how analysts work.",
  approach:
    "You looked around, followed Roz's notes to the settings folder, found the password, then locked the file.",
  efficientSteps: ["Reading the README first took you straight to the settings."],
  detours: [
    "`ls -l` on the folder shows every file's lock at once, so you can skip opening each one.",
  ],
  tryNext: [
    { lessonId: "linux-permissions", why: "It goes deeper into the letters you read today." },
    { lessonId: "sec-least-privilege", why: "The idea behind the fix you made." },
  ],
  signOff: "One locked file, one happy bakery. See you on the next shift.",
};

/** The review card in one state; the idle one is live and plays through to the template. */
export function ReviewCardDemo({ state }: { state: MentorReviewState["status"] }) {
  const [live, setLive] = useState<MentorReviewState>(() =>
    state === "model"
      ? { status: "model", review: MODEL_REVIEW }
      : state === "fallback"
        ? { status: "fallback", review: buildFallbackReview(FACTS) }
        : { status: state },
  );
  useEffect(() => {
    if (live.status !== "writing" || state !== "idle") return;
    const timer = window.setTimeout(
      () => setLive({ status: "fallback", review: buildFallbackReview(FACTS) }),
      1500,
    );
    return () => window.clearTimeout(timer);
  }, [live.status, state]);

  return (
    <div className="w-2xl max-w-full">
      <MentorReviewCard
        state={live}
        facts={FACTS}
        lessonTitle={(id) => LESSON_TITLES[id]}
        onRequest={() => setLive({ status: "writing" })}
      />
    </div>
  );
}
