/**
 * The sandbox's practice machines, in picker order. Adding one is a content file and a line here.
 */
import { LOG_BOX } from "./log-box";
import { SINGLE_COMPUTER } from "./single-computer";
import { SMALL_NETWORK } from "./small-network";
import type { SandboxScenario } from "./types";

export type { SandboxScenario } from "./types";

export const SANDBOX_SCENARIOS: readonly SandboxScenario[] = [
  SINGLE_COMPUTER,
  SMALL_NETWORK,
  LOG_BOX,
];

export function getSandboxScenario(id: string): SandboxScenario | undefined {
  return SANDBOX_SCENARIOS.find((scenario) => scenario.id === id);
}
