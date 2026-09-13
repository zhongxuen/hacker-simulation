import { defaultRegistry } from ".";
import type { ToolRegistry, ToolSummary } from "./types";

/**
 * Every registered tool's name and one-line help, sorted by name. For code that lists commands
 * without running them: the Learning Center's cross-link check, search, and the terminal's
 * command list.
 */
export function listTools(registry: ToolRegistry = defaultRegistry): readonly ToolSummary[] {
  return registry.names().flatMap((name) => {
    const tool = registry.get(name);
    return tool ? [{ name, summary: tool.help.oneLiner }] : [];
  });
}
