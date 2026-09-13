import { stdout } from "../core/output";
import type { OutputLine } from "../core/types";
import type { ToolHelp } from "./types";

/** Every tool's help carries the same simulation notice. */
export const SIMULATED_NOTICE =
  "SIMULATED: this tool only works inside Hacker Simulation's practice network. It never contacts a real computer.";

/** Renders a tool's help as terminal lines: one-liner first, then detail, then the concept. */
export function renderHelp(name: string, help: ToolHelp): OutputLine[] {
  const lines: string[] = [`${name} - ${help.oneLiner}`, "", SIMULATED_NOTICE, "", "USAGE"];
  lines.push(...help.usage.map((usage) => `  ${usage}`));
  lines.push("", "WHAT IT DOES", ...help.description.map((paragraph) => `  ${paragraph}`));
  if (help.options?.length) {
    const width = Math.max(...help.options.map((option) => option.flags.length));
    lines.push("", "OPTIONS");
    for (const option of help.options)
      lines.push(`  ${option.flags.padEnd(width + 3)}${option.text}`);
  }
  if (help.examples?.length) {
    lines.push("", "EXAMPLES");
    for (const example of help.examples)
      lines.push(`  ${example.command}`, `      ${example.text}`);
  }
  lines.push("", "WHY IT MATTERS", ...help.concept.map((paragraph) => `  ${paragraph}`));
  return lines.map(stdout);
}
