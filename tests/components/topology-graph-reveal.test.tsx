import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TopologyGraph } from "@/features/network-visualizer";
import type { DiscoveredTopology, TopologyNode, TopologyNodeState } from "@/sim/types";

/**
 * How new hosts arrive on the network map.
 *
 * A scan that finds a few hosts pops them in: that's the reveal moment the map is built around.
 * A batch far larger than anyone could follow doesn't, because each pop is an SVG transform
 * animation the browser repaints every frame while it runs, and a couple of hundred at once cost
 * the map a third of its frame rate. That was measured, not guessed:
 * tests/e2e/network-map-performance.spec.ts prints the numbers on a real browser. This test is the
 * cheap lock on the behaviour that fix depends on — jsdom has no paint, so it can only check which
 * cards were asked to animate.
 *
 * The threshold itself is MAX_POPPING_NODES in topology-graph.tsx. This test only pins down that
 * a handful animates and a flood doesn't, so the number can be tuned without rewriting the test.
 */

const STATES: readonly TopologyNodeState[] = ["detected", "enumerated", "accessed"];

/** A one-subnet network of `hosts` machines. The first `n` of any size are always the same hosts. */
function topologyOf(hosts: number): DiscoveredTopology {
  const nodes: TopologyNode[] = Array.from({ length: hosts }, (_, index) => ({
    hostId: `h${index.toString().padStart(3, "0")}`,
    label: `host-${index.toString().padStart(3, "0")}`,
    ips: [`10.0.0.${10 + index}`],
    subnets: ["10.0.0.0/24"],
    state: index === 0 ? "accessed" : STATES[index % STATES.length]!,
    services: [],
    firstSeenTick: index,
    via: "netscan",
    isSessionHost: index === 0,
  }));
  return {
    nodes,
    subnets: [
      {
        cidr: "10.0.0.0/24",
        name: "office",
        hostIds: nodes.map((node) => node.hostId),
        containsSessionHost: true,
      },
    ],
    links: [],
    sessionHostId: "h000",
    counts: {
      hosts,
      found: Math.max(0, hosts - 1),
      services: 0,
      byState: { unknown: 0, detected: 0, enumerated: 0, accessed: hosts },
    },
  };
}

/** The cards currently carrying an entrance animation. */
const popping = (container: HTMLElement): number =>
  container.querySelectorAll("[data-host-id] .animate-pop").length;

describe("the network map's reveal", () => {
  it("pops in the handful of hosts a scan usually finds", () => {
    const { container, rerender } = render(<TopologyGraph topology={topologyOf(2)} />);
    expect(popping(container)).toBe(0);

    rerender(<TopologyGraph topology={topologyOf(6)} />);
    // The four that just arrived, and only those: the two already there stay put.
    expect(popping(container)).toBe(4);
    expect(container.querySelectorAll("[data-host-id]")).toHaveLength(6);
  });

  it("lets a flood of hosts appear without animating every one of them", () => {
    const { container, rerender } = render(<TopologyGraph topology={topologyOf(2)} />);

    rerender(<TopologyGraph topology={topologyOf(200)} />);
    expect(container.querySelectorAll("[data-host-id]")).toHaveLength(200);
    expect(popping(container)).toBe(0);
  });

  it("goes back to popping once the discoveries are small again", () => {
    const { container, rerender } = render(<TopologyGraph topology={topologyOf(2)} />);
    rerender(<TopologyGraph topology={topologyOf(200)} />);
    expect(popping(container)).toBe(0);

    rerender(<TopologyGraph topology={topologyOf(203)} />);
    expect(popping(container)).toBe(3);
  });
});
