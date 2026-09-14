"use client";

import type { ReactNode } from "react";
import { CharacterMessage } from "@/components/ui/character-message";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { getCastMember } from "@/content/cast";
import { cx } from "@/lib/cx";
import type { StoryEntry } from "../run/mission-run";
import { MissionText, plainMissionText } from "./mission-text";

interface StoryPanelProps {
  entries: readonly StoryEntry[];
  /** Where the newest lines start: they're all shown in full, the last one typing itself out. */
  batchStart: number;
  /** Shown under the newest message: the learner's move, when the story is waiting on a choice. */
  yourMove?: ReactNode;
}

function Message({ entry, typewriter }: { entry: StoryEntry; typewriter: boolean }) {
  const member = getCastMember(entry.speaker);
  const speaker = member
    ? { name: member.name, role: member.role, initials: member.initials }
    : { name: entry.speaker };
  const tone = member?.tone ?? "teammate";
  // The newest line types itself out; code spans need the plain renderer, so those skip it.
  return typewriter && !entry.text.includes("`") ? (
    <CharacterMessage speaker={speaker} tone={tone} typewriter>
      {entry.text}
    </CharacterMessage>
  ) : (
    <CharacterMessage speaker={speaker} tone={tone}>
      <MissionText text={entry.text} />
    </CharacterMessage>
  );
}

/**
 * The team chat: story beats and replies as the phase 02 CharacterMessage, newest shown in full at
 * the top of the workspace, earlier ones one click away. New lines are read out politely.
 */
export function StoryPanel({ entries, batchStart, yourMove }: StoryPanelProps) {
  const start = Math.min(Math.max(0, batchStart), Math.max(0, entries.length - 1));
  const latest = entries.slice(start);
  const earlier = entries.slice(0, start);

  return (
    <section
      aria-labelledby="story-panel-title"
      className="rounded-xl border border-subtle bg-surface-raised p-4"
    >
      <h2 id="story-panel-title" className="sr-only">
        Team chat
      </h2>
      {earlier.length > 0 && (
        <details className="mb-4">
          <summary
            className={cx(
              "cursor-pointer rounded-sm text-sm font-medium text-secondary",
              FOCUS_RING,
            )}
          >
            Earlier messages ({earlier.length})
          </summary>
          <ol className="mt-3 space-y-4 border-l border-subtle pl-3">
            {earlier.map((entry) => (
              <li key={entry.id}>
                <Message entry={entry} typewriter={false} />
              </li>
            ))}
          </ol>
        </details>
      )}
      <div aria-live="polite" aria-atomic="true">
        {latest.length > 0 ? (
          <div key={latest[0]?.id} className="space-y-4">
            <p className="sr-only">
              {latest
                .map(
                  (entry) =>
                    `${getCastMember(entry.speaker)?.name ?? entry.speaker} says: ${plainMissionText(entry.text)}`,
                )
                .join(" ")}
            </p>
            {latest.map((entry, index) => (
              <div key={entry.id} aria-hidden="true">
                <Message entry={entry} typewriter={index === latest.length - 1} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-secondary">The team will chat here as you go.</p>
        )}
      </div>
      {yourMove && <div className="mt-4">{yourMove}</div>}
    </section>
  );
}
