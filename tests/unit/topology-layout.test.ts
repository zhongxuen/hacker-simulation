import { describe, expect, it } from "vitest";
import { layoutTopology, nextFocus, type TopologyLayout } from "@/features/network-visualizer";
import {
  clampView,
  fitView,
  MAX_ZOOM,
  MIN_ZOOM,
  revealRect,
  zoomAt,
} from "@/features/network-visualizer/view";
import { createInitialState, fixedClock, selectTopology, step } from "@/sim";
import type {
  DiscoveredTopology,
  HostSpec,
  ScenarioSpec,
  TopologyNode,
  TopologyNodeState,
} from "@/sim/types";

/**
 * The network map's layout (md-files/07-network-visualizer.md, prompt 07.2): deterministic,
 * subnets as columns, hosts in address order, and stable when hosts appear.
 */

// ---------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------

const linux = { family: "linux", name: "Linux" } as const;

/**
 * A big simulated network, discovered through the real engine: `subnets` × `perSubnet` hosts,
 * every one reachable, with the learner on the first. Every subnet gets swept, and every other one
 * port-scanned too, so the map has a mix of states.
 */
function bigTopology(subnets: number, perSubnet: number): DiscoveredTopology {
  const hosts: HostSpec[] = [];
  for (let s = 1; s <= subnets; s += 1) {
    for (let h = 0; h < perSubnet; h += 1) {
      const learner = s === 1 && h === 0;
      hosts.push({
        id: `h-${s}-${h}`,
        hostname: `h-${s}-${h}`,
        interfaces: [{ ip: `10.0.${s}.${10 + h}`, subnet: `10.0.${s}.0/24` }],
        os: linux,
        reachableFrom: ["*"],
        services:
          h % 3 === 0
            ? [{ port: 22, protocol: "tcp", name: "ssh", product: "sshd", version: "9.6" }]
            : [],
        ...(learner && { users: [{ name: "recruit", uid: 1000 }], fs: {} }),
      });
    }
  }
  const spec: ScenarioSpec = {
    id: "big-office",
    network: {
      subnets: Array.from({ length: subnets }, (_, i) => ({
        cidr: `10.0.${i + 1}.0/24`,
        name: `floor-${i + 1}`,
      })),
      hosts,
    },
    session: { host: "h-1-0", user: "recruit" },
  };
  let state = createInitialState(spec, 1);
  for (let s = 1; s <= subnets; s += 1) {
    const argv = ["netscan", `10.0.${s}.0/24`, ...(s % 2 === 0 ? ["-p", "22"] : [])];
    state = step(state, { type: "exec", argv }, fixedClock(0)).state;
  }
  return selectTopology(state);
}

const node = (
  hostId: string,
  ip: string,
  subnets: string[],
  state: TopologyNodeState = "detected",
): TopologyNode => ({
  hostId,
  label: hostId,
  ips: [ip],
  subnets,
  state,
  services: [],
  firstSeenTick: 1,
  via: "netscan",
  isSessionHost: hostId === "ws-01",
});

/** An office network and a server network, joined by a web server with a leg in each. */
const OFFICE: DiscoveredTopology = {
  nodes: [
    node("ws-01", "10.0.1.10", ["10.0.1.0/24"], "accessed"),
    {
      ...node("web-01", "10.0.1.20", ["10.0.1.0/24", "10.0.2.0/24"]),
      ips: ["10.0.1.20", "10.0.2.20"],
    },
    node("printer-01", "10.0.1.30", ["10.0.1.0/24"], "enumerated"),
    node("db-01", "10.0.2.40", ["10.0.2.0/24"]),
  ],
  subnets: [
    {
      cidr: "10.0.1.0/24",
      name: "office",
      hostIds: ["ws-01", "web-01", "printer-01"],
      containsSessionHost: true,
    },
    { cidr: "10.0.2.0/24", name: "servers", hostIds: ["db-01"], containsSessionHost: false },
  ],
  links: [
    { kind: "route", from: "10.0.1.0/24", to: "10.0.2.0/24" },
    { kind: "interface", hostId: "web-01", subnet: "10.0.2.0/24" },
  ],
  sessionHostId: "ws-01",
  counts: {
    hosts: 4,
    found: 3,
    services: 0,
    byState: { unknown: 0, detected: 2, enumerated: 1, accessed: 1 },
  },
};

/** The same topology without one host, as it was before that host was discovered. */
function without(topology: DiscoveredTopology, hostId: string): DiscoveredTopology {
  return {
    ...topology,
    nodes: topology.nodes.filter((n) => n.hostId !== hostId),
    subnets: topology.subnets.map((subnet) => ({
      ...subnet,
      hostIds: subnet.hostIds.filter((id) => id !== hostId),
    })),
    links: topology.links.filter((link) => link.kind === "route" || link.hostId !== hostId),
  };
}

const positions = (layout: TopologyLayout) =>
  new Map(layout.nodes.map((n) => [n.hostId, { x: n.x, y: n.y }]));

const EMPTY: DiscoveredTopology = {
  nodes: [],
  subnets: [],
  links: [],
  sessionHostId: "ws-01",
  counts: {
    hosts: 0,
    found: 0,
    services: 0,
    byState: { unknown: 0, detected: 0, enumerated: 0, accessed: 0 },
  },
};

// ---------------------------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------------------------

describe("layoutTopology", () => {
  it("lays out nothing for an empty map", () => {
    expect(layoutTopology(EMPTY)).toEqual({
      width: 0,
      height: 0,
      clusters: [],
      nodes: [],
      links: [],
    });
  });

  it("stacks a subnet's hosts in one column, top to bottom in address order", () => {
    const layout = layoutTopology(without(without(OFFICE, "db-01"), "web-01"));
    expect(layout.clusters.map((c) => c.cidr)).toEqual(["10.0.1.0/24", "10.0.2.0/24"]);
    const [office] = layout.clusters;
    const cards = layout.nodes.filter((n) => n.cidr === "10.0.1.0/24");
    expect(cards.map((n) => n.hostId)).toEqual(["ws-01", "printer-01"]);
    expect(new Set(cards.map((n) => n.x)).size).toBe(1);
    expect(cards[0]!.y).toBeLessThan(cards[1]!.y);
    // Every card sits inside its subnet's box.
    for (const card of cards) {
      expect(card.x).toBeGreaterThan(office!.x);
      expect(card.y).toBeGreaterThan(office!.y);
      expect(card.x + 208).toBeLessThan(office!.x + office!.width);
      expect(card.y + 60).toBeLessThan(office!.y + office!.height);
    }
  });

  it("puts subnets side by side in address order, all the same height", () => {
    const layout = layoutTopology(OFFICE);
    const [office, servers] = layout.clusters;
    expect(office!.x).toBeLessThan(servers!.x);
    expect(office!.x + office!.width).toBeLessThan(servers!.x);
    expect(office!.height).toBe(servers!.height);
    expect(office!.y).toBe(servers!.y);
    expect(layout.width).toBeGreaterThan(servers!.x + servers!.width);
    expect(layout.height).toBeGreaterThan(office!.y + office!.height);
  });

  it("draws a multi-homed host once, with a line to the edge of its other subnet", () => {
    const layout = layoutTopology(OFFICE);
    expect(layout.nodes.filter((n) => n.hostId === "web-01")).toHaveLength(1);
    const web = layout.nodes.find((n) => n.hostId === "web-01")!;
    const servers = layout.clusters[1]!;
    expect(layout.links).toContainEqual({
      kind: "interface",
      key: "interface:web-01>10.0.2.0/24",
      hostId: "web-01",
      subnet: "10.0.2.0/24",
      y: web.y + 30,
      x1: web.x + 208,
      x2: servers.x,
    });
  });

  it("runs a route line out of one subnet and across the dashed edge of the other", () => {
    const layout = layoutTopology(OFFICE);
    const [office, servers] = layout.clusters;
    const route = layout.links.find((link) => link.kind === "route");
    expect(route?.kind).toBe("route");
    if (route?.kind !== "route") return;
    const inside = (p: { x: number; y: number }, c: typeof office) =>
      p.x > c!.x && p.x < c!.x + c!.width && p.y > c!.y && p.y < c!.y + c!.height;
    expect(inside(route.start, office)).toBe(true);
    expect(inside(route.end, servers)).toBe(true);
    // The firewall marker sits on the target's top edge, where the line crosses it.
    expect(route.crossing).toEqual({ x: route.end.x, y: servers!.y });
    expect(route.path).toMatch(/^M[\d.]+ [\d.]+V[\d.]+H[\d.]+V[\d.]+$/);
  });

  it("gives identical output for identical input", () => {
    const topology = bigTopology(4, 50);
    const copy = structuredClone(topology);
    expect(layoutTopology(copy)).toEqual(layoutTopology(topology));
    expect(JSON.stringify(layoutTopology(copy))).toBe(JSON.stringify(layoutTopology(topology)));
  });

  it("keeps an empty subnet (one only a multi-homed host has an address in)", () => {
    const layout = layoutTopology(without(OFFICE, "db-01"));
    expect(layout.clusters.map((c) => [c.cidr, c.hostIds])).toEqual([
      ["10.0.1.0/24", ["ws-01", "web-01", "printer-01"]],
      ["10.0.2.0/24", []],
    ]);
    expect(layout.links.map((link) => link.kind)).toEqual(["route", "interface"]);
  });

  describe("stability when a host appears", () => {
    it("moves only the hosts after it in its own subnet, by one row", () => {
      const after = bigTopology(4, 50);
      const newcomer = after.subnets[2]!.hostIds[20]!;
      const before = without(after, newcomer);
      const was = positions(layoutTopology(before));
      const now = positions(layoutTopology(after));
      const subnet = after.subnets[2]!;
      const later = new Set(subnet.hostIds.slice(21));

      const moved: string[] = [];
      for (const [hostId, position] of was) {
        const next = now.get(hostId)!;
        if (next.x === position.x && next.y === position.y) continue;
        moved.push(hostId);
        expect(next.x).toBe(position.x);
        expect(next.y - position.y).toBe(80);
      }
      expect(new Set(moved)).toEqual(later);
      expect(moved).toHaveLength(29);
    });

    it("moves nothing when the host lands at the end of its subnet", () => {
      const after = layoutTopology(OFFICE);
      const before = layoutTopology(without(OFFICE, "printer-01"));
      const now = positions(after);
      for (const [hostId, position] of positions(before)) expect(now.get(hostId)).toEqual(position);
      expect(after.clusters.map((c) => [c.x, c.y])).toEqual(before.clusters.map((c) => [c.x, c.y]));
    });
  });

  it(`lays out 200 hosts in a few milliseconds`, () => {
    const topology = bigTopology(4, 50);
    expect(topology.nodes).toHaveLength(200);
    const layout = layoutTopology(topology);
    expect(layout.nodes).toHaveLength(200);
    expect(layout.clusters).toHaveLength(4);

    const times: number[] = [];
    for (let run = 0; run < 51; run += 1) {
      const start = performance.now();
      layoutTopology(topology);
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    expect(times[25]).toBeLessThan(5);
  });
});

// ---------------------------------------------------------------------------------------------
// Keyboard focus order
// ---------------------------------------------------------------------------------------------

describe("nextFocus", () => {
  const layout = layoutTopology(OFFICE);

  it("walks the layout order with up and down, across subnets", () => {
    expect(nextFocus(layout, "ws-01", "down")).toBe("web-01");
    expect(nextFocus(layout, "printer-01", "down")).toBe("db-01");
    expect(nextFocus(layout, "db-01", "up")).toBe("printer-01");
    expect(nextFocus(layout, "db-01", "down")).toBeUndefined();
    expect(nextFocus(layout, "ws-01", "up")).toBeUndefined();
  });

  it("jumps to the nearest row of the next subnet with left and right", () => {
    expect(nextFocus(layout, "printer-01", "right")).toBe("db-01");
    expect(nextFocus(layout, "db-01", "left")).toBe("ws-01");
    expect(nextFocus(layout, "ws-01", "left")).toBeUndefined();
  });

  it("goes to the first and last host, and starts at the first when nothing is focused", () => {
    expect(nextFocus(layout, "web-01", "first")).toBe("ws-01");
    expect(nextFocus(layout, "web-01", "last")).toBe("db-01");
    expect(nextFocus(layout, undefined, "down")).toBe("ws-01");
    expect(nextFocus(layoutTopology(EMPTY), undefined, "down")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------------
// Pan and zoom
// ---------------------------------------------------------------------------------------------

describe("view", () => {
  const viewport = { width: 800, height: 500 };

  it("fits a small map at actual size, centred across and aligned to the top", () => {
    const view = fitView({ width: 400, height: 200 }, viewport);
    expect(view).toEqual({ k: 1, x: 200, y: 16 });
  });

  it("shrinks a big map to fit, within the zoom limits", () => {
    const view = fitView({ width: 3200, height: 1000 }, viewport);
    expect(view.k).toBeCloseTo((800 - 32) / 3200);
    expect(3200 * view.k).toBeLessThanOrEqual(800);
    expect(fitView({ width: 1e6, height: 1e6 }, viewport).k).toBe(MIN_ZOOM);
    expect(fitView({ width: 0, height: 0 }, viewport)).toEqual({ x: 0, y: 0, k: 1 });
  });

  it("zooms around a point, keeping what's under it in place", () => {
    const start = { x: 30, y: -20, k: 0.8 };
    const anchor = { x: 300, y: 200 };
    const zoomed = zoomAt(start, 1.25, anchor);
    const mapPoint = { x: (anchor.x - start.x) / start.k, y: (anchor.y - start.y) / start.k };
    expect(mapPoint.x * zoomed.k + zoomed.x).toBeCloseTo(anchor.x);
    expect(mapPoint.y * zoomed.k + zoomed.y).toBeCloseTo(anchor.y);
    expect(zoomAt(start, 100, anchor).k).toBe(MAX_ZOOM);
    expect(zoomAt(start, 0.0001, anchor).k).toBe(MIN_ZOOM);
  });

  it("never lets the map be dragged out of sight", () => {
    const content = { width: 1000, height: 600 };
    const lost = clampView({ x: 5000, y: -5000, k: 1 }, content, viewport);
    expect(lost.x).toBeLessThan(viewport.width);
    expect(lost.y + content.height).toBeGreaterThan(0);
  });

  it("pans the least it can to bring a focused card into view", () => {
    const view = { x: 0, y: 0, k: 1 };
    const card = { x: 900, y: 100, width: 200, height: 60 };
    const revealed = revealRect(view, card, viewport);
    expect(revealed.x).toBe(800 - 24 - 1100);
    expect(revealed.y).toBe(0);
    const visible = { x: 100, y: 100, width: 200, height: 60 };
    expect(revealRect(view, visible, viewport)).toBe(view);
  });
});
