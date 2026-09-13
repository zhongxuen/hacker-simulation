import { describe, expect, it } from "vitest";
import { SANDBOX_SCENARIOS } from "@/content/sandbox";
import { findBannedWords } from "@/content/voice";
import { createTerminalSession, submitLine } from "@/features/terminal";
import { createInitialState, selectTopology } from "@/sim";

/** The sandbox's practice machines (md-files/05-terminal-module.md, prompt 05.6). */
describe.each(SANDBOX_SCENARIOS.map((scenario) => [scenario.id, scenario] as const))(
  "sandbox scenario %s",
  (id, sandbox) => {
    it("builds with the engine, on the Range", () => {
      const state = createInitialState(sandbox.scenario, sandbox.seed);
      expect(state.scenarioId).toBe(id);
      for (const host of Object.values(state.network.hosts)) {
        expect(host.interfaces.every((iface) => iface.ip.startsWith("192.168.60."))).toBe(true);
        expect(
          host.hostname === host.id || host.hostname.endsWith(".range.candlewright.example"),
        ).toBe(true);
      }
    });

    it("has a short, plain description", () => {
      expect(sandbox.description.length).toBeLessThan(120);
      for (const text of [
        sandbox.title,
        sandbox.description,
        ...sandbox.tryThis.map((idea) => idea.why),
      ]) {
        expect(findBannedWords(text), text).toEqual([]);
      }
    });

    it("suggests commands that work", () => {
      let session = createTerminalSession({ scenario: sandbox.scenario, seed: sandbox.seed });
      for (const { command } of sandbox.tryThis) {
        session = submitLine(session, command);
        const block = session.blocks.at(-1);
        expect(block?.exitCode, command).toBe(0);
        expect(
          block?.lines.some((line) => line.error),
          command,
        ).toBe(false);
      }
    });
  },
);

describe("the small network", () => {
  it("fills the map as the learner scans", () => {
    const sandbox = SANDBOX_SCENARIOS.find((scenario) => scenario.id === "sandbox-network");
    if (!sandbox) throw new Error("missing");
    let session = createTerminalSession({ scenario: sandbox.scenario, seed: sandbox.seed });
    // "Found" counts other computers that answered, not the learner's own.
    expect(selectTopology(session.sim).counts.found).toBe(0);
    session = submitLine(session, "netscan 192.168.60.0/24");
    // The printer ignores pings, so a plain sweep finds three of the four.
    expect(selectTopology(session.sim).counts.found).toBe(3);
    session = submitLine(session, "netscan 192.168.60.0/24 -p common --no-ping");
    expect(selectTopology(session.sim).counts.found).toBe(4);
  });
});
