/**
 * Plain-text transcripts of a replay: each command, its output, its exit code and its events.
 * Used by golden tests, bug reports, and (in phase 10) as the mentor's view of a session.
 */
import { formatArgv } from "./output";
import type { ReplayStep } from "./replay";
import { stableStringify } from "./stable-json";

export function renderTranscript(steps: readonly ReplayStep[]): string {
  const lines: string[] = [];
  for (const { command, output, events, exitCode } of steps) {
    lines.push(`$ ${formatArgv(command.argv)}`.trimEnd());
    if (command.stdin !== undefined)
      lines.push(`  (with ${command.stdin.length} characters piped in)`);
    // Trailing spaces are trimmed so editors can't silently change a committed golden file.
    for (const line of output)
      lines.push(`${line.stream === "stderr" ? "!" : " "} ${line.text}`.trimEnd());
    lines.push(`[exit ${exitCode}]`);
    for (const { type, ...fields } of events) lines.push(`  @ ${type} ${stableStringify(fields)}`);
    lines.push("");
  }
  return lines.join("\n");
}
