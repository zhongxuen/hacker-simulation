import type { TerminalBlock } from "@/features/terminal";

/**
 * The mentor transcript: the learner's recent commands and what the computer showed, sent to the
 * mentor route so Noor's hint can speak to what they actually tried (md-files/10-ai-mentor.md,
 * prompt 10.1). It is the only learner text that ever leaves the browser, and only when the learner
 * asks for a hint (md-files/03-app-state-and-privacy.md, "Sent, but not kept").
 *
 * It is untrusted, in two directions:
 *  - Forging it only changes the learner's own hint (there is no account and nothing is stored), so
 *    it never needs authenticating.
 *  - It is always treated as data, never instructions: the prompt wraps it in a delimited block and
 *    the caps here (plus the server's body-size cap) keep it small and cheap.
 *
 * The same caps run on both sides: `buildMentorTranscript` trims client-side before sending, and the
 * request schema trims again server-side, so the model never sees more than this regardless of what
 * a forged body contains.
 */

/** One command the learner ran, and the output it produced, both already trimmed. */
export interface MentorTranscriptEntry {
  /** The command line the learner typed. */
  readonly input: string;
  /** What the computer showed, without the beginner explainer lines or colour codes. */
  readonly output: string;
}

export type MentorTranscript = readonly MentorTranscriptEntry[];

/** Only the last few commands matter for a hint, and they bound the prompt's size. */
export const MAX_TRANSCRIPT_COMMANDS = 12;
/** The longest any single line (a command, or one line of output) may be, in characters. */
export const MAX_LINE_CHARS = 200;
/** The most lines of output kept per command. */
export const MAX_OUTPUT_LINES = 20;
/** The most characters kept for one command's output, after the per-line caps. */
export const MAX_ENTRY_OUTPUT_CHARS = 1500;
/** A hard cap on the whole transcript's characters, oldest commands dropped first. */
export const MAX_TRANSCRIPT_CHARS = 6000;

/** Cuts `text` to `max` characters, marking that it was shortened. */
function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

/** One line, to a single line (no newlines) and the per-line character cap. */
function trimLine(line: string): string {
  return truncate(line.replace(/[\r\n]+/g, " ").trimEnd(), MAX_LINE_CHARS);
}

/** Output text, capped to a number of lines, per-line length, and a total. */
function trimOutput(output: string): string {
  const lines = output.split("\n").slice(0, MAX_OUTPUT_LINES).map(trimLine);
  const joined = lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return truncate(joined, MAX_ENTRY_OUTPUT_CHARS);
}

/** The number of characters an entry contributes, for the total cap. */
function entryChars(entry: MentorTranscriptEntry): number {
  return entry.input.length + entry.output.length;
}

/**
 * Applies the caps to a transcript: keeps the last few entries, trims each, then drops the oldest
 * while the total is over the character cap. Pure, so the server can run the exact same trimming.
 */
export function capTranscript(entries: MentorTranscript): MentorTranscriptEntry[] {
  const trimmed = entries
    .slice(-MAX_TRANSCRIPT_COMMANDS)
    .map((entry) => ({ input: trimLine(entry.input), output: trimOutput(entry.output) }))
    .filter((entry) => entry.input !== "");

  let total = trimmed.reduce((sum, entry) => sum + entryChars(entry), 0);
  while (trimmed.length > 1 && total > MAX_TRANSCRIPT_CHARS) {
    const dropped = trimmed.shift();
    if (dropped) total -= entryChars(dropped);
  }
  // If one entry alone is still over the cap, its own field caps already bounded it.
  return trimmed;
}

/**
 * Turns the terminal's blocks into a capped transcript for the mentor. Only real command blocks
 * count (not the terminal's own notes), and the beginner explainer lines are dropped, so the model
 * sees what a plain terminal would show.
 */
export function buildMentorTranscript(blocks: readonly TerminalBlock[]): MentorTranscriptEntry[] {
  const entries = blocks
    .filter((block) => block.kind === "command" && block.input.trim() !== "" && !block.interrupted)
    .map((block) => ({
      input: block.input,
      output: block.lines
        .filter((line) => line.kind !== "explain")
        .map((line) => line.text)
        .join("\n"),
    }));
  return capTranscript(entries);
}
