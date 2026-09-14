import type { MissionDifficulty } from "@/content/schemas/mission";
import { cx } from "@/lib/cx";

/**
 * Mission copy with its `code` spans in code font. Mission files are plain YAML strings, so
 * commands, file names and addresses are marked with backticks (md-files/voice-and-tone.md: "so
 * the learner knows exactly what to type").
 */
export function MissionText({ text, codeClassName }: { text: string; codeClassName?: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((part, index) =>
        part.length > 2 && part.startsWith("`") && part.endsWith("`") ? (
          <code
            key={index}
            className={cx(
              "rounded-sm bg-surface-base px-1 py-0.5 font-mono text-[0.9em] text-primary",
              codeClassName,
            )}
          >
            {part.slice(1, -1)}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** The words of mission copy, without the backticks: for labels and announcements. */
export const plainMissionText = (text: string): string => text.replace(/`/g, "");

/**
 * How each difficulty reads on a mission card. "Easy" is on the banned list
 * (md-files/voice-and-tone.md): if a mission isn't easy for someone, we've told them they're failing.
 */
export const DIFFICULTY_LABELS: Readonly<Record<MissionDifficulty, string>> = {
  intro: "Intro",
  easy: "Beginner",
  medium: "Intermediate",
  hard: "Advanced",
};
