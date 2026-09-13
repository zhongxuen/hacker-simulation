import type { ScenarioSpec } from "@/sim/types";

/**
 * A practice machine for the sandbox (md-files/05-terminal-module.md, prompt 05.6): a scenario
 * with no objectives, set on the Range, Candlewright's practice lab (md-files/story-bible.md,
 * "World facts": range.candlewright.example, 192.168.60.0/24). Every machine there is a practice
 * copy that resets.
 */
export interface SandboxScenario {
  /** Stable id: also the engine scenario's id. */
  readonly id: string;
  /** Shown on the picker. */
  readonly title: string;
  /** One line a beginner can read in five seconds. */
  readonly description: string;
  /** A few commands worth trying first, shown next to the terminal. */
  readonly tryThis: readonly { readonly command: string; readonly why: string }[];
  /** Show the network map beside the terminal. */
  readonly showMap: boolean;
  readonly seed: number;
  readonly scenario: ScenarioSpec;
}
