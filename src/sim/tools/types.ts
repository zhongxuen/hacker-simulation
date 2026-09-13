import type { Rng } from "../core/rng";
import type { SimResult, SimState } from "../core/types";

/**
 * Educational help for one tool, shown by `<tool> --help` (and by `man` in phase 05). Written for
 * a complete beginner first: a plain-language one-liner, then the detail, then why it matters.
 */
export interface ToolHelp {
  /** Readable in five seconds: what the tool does, in everyday words. */
  readonly oneLiner: string;
  readonly usage: readonly string[];
  /** Plain-language explanation, one paragraph per entry. Define every term on first use. */
  readonly description: readonly string[];
  readonly options?: readonly { readonly flags: string; readonly text: string }[];
  readonly examples?: readonly { readonly command: string; readonly text: string }[];
  /** Why this matters in security work, including the ethics of using it for real. */
  readonly concept: readonly string[];
}

/** What a tool gets besides its arguments and the state. Built fresh by `step` for every command. */
export interface ToolContext {
  /** Seeded from the run's seed and this command's tick. */
  readonly rng: Rng;
  /** This command's time, read once from the injected clock. */
  readonly now: number;
  /** The command number this run is on (state.tick after this command). */
  readonly tick: number;
  /** Text piped in, if any. */
  readonly stdin?: string;
}

/**
 * A simulated tool: a pure function from arguments and state to a result. Tool names never match
 * real tools, and their output is representative rather than a copy of any real tool's.
 */
export interface Tool {
  readonly name: string;
  readonly help: ToolHelp;
  readonly run: (args: readonly string[], state: SimState, ctx: ToolContext) => SimResult;
}

/** A tool as a list entry: its name and its help's one-liner. */
export interface ToolSummary {
  readonly name: string;
  readonly summary: string;
}

export interface ToolRegistry {
  get(name: string): Tool | undefined;
  has(name: string): boolean;
  /** Tool names, sorted. */
  names(): readonly string[];
}
