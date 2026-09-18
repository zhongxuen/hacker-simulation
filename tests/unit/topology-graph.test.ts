import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  nodeAccessibleName,
  stateLine,
  TopologyGraph,
  type TopologyGraphProps,
} from "@/features/network-visualizer";
import { createInitialState, fixedClock, selectTopology, step } from "@/sim";
import type { DiscoveredTopology, HostSpec, ScenarioSpec } from "@/sim/types";

/**
 * The network map's renderer (md-files/07-network-visualizer.md, prompt 07.2), rendered to HTML in
 * plain Node. This proves what the markup says: every host is a named, focusable button, states are
 * spelled out in words, and 200 hosts render without trouble. It can't measure frame rate: that's
 * tests/e2e/network-map-performance.spec.ts, on a real browser.
 */

const render = (props: TopologyGraphProps) =>
  renderToStaticMarkup(createElement(TopologyGraph, props));

const count = (html: string, pattern: RegExp) => html.match(pattern)?.length ?? 0;

/** From md-files/voice-and-tone.md, "Banned words". Whole words only. */
const BANNED_WORDS =
  /\b(simply|just|merely|obviously|clearly|of course|as you know|easy|trivial|basic|invalid|illegal|wrong|failed|victim)\b/i;

const linux = { family: "linux", name: "Linux" } as const;
const ssh = { port: 22, protocol: "tcp", name: "ssh", product: "sshd", version: "9.6" } as const;
const http = { port: 80, protocol: "tcp", name: "http", product: "httpd", version: "2.4" } as const;

/** A small office, discovered through the real engine. */
function officeTopology(): DiscoveredTopology {
  const spec: ScenarioSpec = {
    id: "map-office",
    network: {
      subnets: [
        { cidr: "10.0.1.0/24", name: "office" },
        { cidr: "10.0.2.0/24", name: "servers" },
      ],
      hosts: [
        {
          id: "ws-01",
          hostname: "ws-01",
          interfaces: [{ ip: "10.0.1.10", subnet: "10.0.1.0/24" }],
          os: linux,
          services: [ssh],
          users: [{ name: "recruit", uid: 1000 }],
          fs: {},
        },
        {
          id: "web-01",
          hostname: "web-01",
          interfaces: [
            { ip: "10.0.1.20", subnet: "10.0.1.0/24" },
            { ip: "10.0.2.20", subnet: "10.0.2.0/24" },
          ],
          os: linux,
          services: [ssh, http],
        },
        {
          id: "db-01",
          hostname: "db-01",
          interfaces: [{ ip: "10.0.2.40", subnet: "10.0.2.0/24" }],
          os: linux,
          reachableFrom: ["*"],
        },
        {
          id: "vault-01",
          hostname: "vault-01",
          interfaces: [{ ip: "10.0.2.50", subnet: "10.0.2.0/24" }],
          os: linux,
          reachableFrom: ["web-01"],
        },
      ],
    },
    session: { host: "ws-01", user: "recruit" },
  };
  let state = createInitialState(spec, 1);
  for (const argv of [
    ["netscan", "10.0.1.0/24", "-p", "common"],
    ["netscan", "10.0.2.0/24"],
  ]) {
    state = step(state, { type: "exec", argv }, fixedClock(0)).state;
  }
  return selectTopology(state);
}

/** `subnets` × `perSubnet` hosts, all discovered, the learner on the first. */
function bigTopology(subnets: number, perSubnet: number): DiscoveredTopology {
  const hosts: HostSpec[] = [];
  for (let s = 1; s <= subnets; s += 1) {
    for (let h = 0; h < perSubnet; h += 1) {
      hosts.push({
        id: `h-${s}-${h}`,
        hostname: `h-${s}-${h}`,
        interfaces: [{ ip: `10.0.${s}.${10 + h}`, subnet: `10.0.${s}.0/24` }],
        os: linux,
        reachableFrom: ["*"],
        services: h % 3 === 0 ? [ssh] : [],
        ...(s === 1 && h === 0 && { users: [{ name: "recruit", uid: 1000 }], fs: {} }),
      });
    }
  }
  const spec: ScenarioSpec = {
    id: "big-office",
    network: { hosts },
    session: { host: "h-1-0", user: "recruit" },
  };
  let state = createInitialState(spec, 1);
  for (let s = 1; s <= subnets; s += 1) {
    const argv = ["netscan", `10.0.${s}.0/24`, ...(s % 2 === 0 ? ["-p", "22"] : [])];
    state = step(state, { type: "exec", argv }, fixedClock(0)).state;
  }
  return selectTopology(state);
}

describe("TopologyGraph", () => {
  const topology = officeTopology();
  const html = render({ topology, selectedHostId: "web-01" });

  it("draws every discovered host as a named button, and nothing undiscovered", () => {
    expect(count(html, /data-host-id="/g)).toBe(topology.nodes.length);
    expect(count(html, /role="button"/g)).toBe(topology.nodes.length);
    expect(html).not.toMatch(/vault-01|10\.0\.2\.50/);
    const web = topology.nodes.find((node) => node.hostId === "web-01")!;
    expect(nodeAccessibleName(web)).toBe("web-01, 10.0.1.20, 10.0.2.20, Scanned, 2 services found");
    expect(html).toContain(`aria-label="${nodeAccessibleName(web)}"`);
  });

  it("names each state in words, not only colour and shape", () => {
    const states = topology.nodes.map((node) => [node.hostId, stateLine(node)]);
    expect(states).toEqual([
      ["ws-01", "Accessed · 1 service"],
      ["web-01", "Scanned · 2 services"],
      ["db-01", "Found"],
    ]);
    for (const [, line] of states) expect(html).toContain(`>${line}</text>`);
    for (const label of ["Heard of", "Found", "Scanned", "Accessed"]) expect(html).toContain(label);
  });

  it("marks the learner's own machine", () => {
    expect(html).toContain(">You are here</text>");
    expect(html).toMatch(
      /aria-label="ws-01, 10\.0\.1\.10, Accessed, 1 service found, you are here"/,
    );
  });

  it("groups hosts by network, with a line for the route and the second address", () => {
    expect(html).toContain('aria-label="office network, 10.0.1.0/24, your network"');
    expect(html).toContain('aria-label="servers network, 10.0.2.0/24"');
    expect(topology.links.map((link) => link.kind)).toEqual(["route", "interface"]);
    expect(html).toContain("web-01 also has an address in the servers network.");
  });

  it("puts one host in the Tab order and lets arrow keys reach the rest", () => {
    expect(count(html, /tabindex="0"/g)).toBe(1);
    expect(count(html, /tabindex="-1"/g)).toBe(topology.nodes.length - 1);
    // The selected host is the Tab stop, and shows as the current one.
    expect(html).toMatch(
      /data-host-id="web-01" role="button" tabindex="0"[^>]*aria-current="true"/,
    );
  });

  it("has labelled zoom controls, keyboard help, and a map key", () => {
    for (const label of ["Zoom out", "Zoom in", "Fit to screen"]) {
      expect(html).toContain(`aria-label="${label}"`);
    }
    expect(html).toContain("arrow keys move between computers");
    expect(html).toContain("Map key");
    expect(render({ topology, showLegend: false })).not.toContain("Map key");
  });

  it("follows the voice-and-tone rules", () => {
    const text = html.replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(BANNED_WORDS);
  });

  it("uses no hardcoded colours in its inline styles", () => {
    const styles = [...html.matchAll(/style="([^"]*)"/g)].map((match) => match[1]);
    for (const style of styles) expect(style).toMatch(/^transform:translate\(/);
  });

  it("shows a friendly empty state when nothing has been discovered", () => {
    const empty = render({
      topology: {
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
      },
    });
    expect(empty).toContain("Your network map is still dark");
    expect(empty).toContain("It lights up as you discover computers.");
    expect(empty).not.toContain('<svg class="absolute');
    expect(empty).not.toContain("Zoom in");
  });

  /**
   * What this proves: 200 hosts produce 200 focusable cards, and a full render of the whole map (a
   * one-off, when it first appears) stays inside a generous budget. On its own it takes around
   * 15-30 ms, but the full suite runs every test file in parallel, which can slow it tenfold, so the
   * budget is loose and the fastest of five runs counts. What it can't prove: 60fps in a browser.
   * Node has no layout, paint or compositor, so it can't see style recalculation or the cost of
   * drawing 200 cards. The design keeps per-frame work small (panning and zooming change one
   * transform and re-render no cards; cards are memoized), but the frame rate itself needs a
   * browser, and is measured in tests/e2e/network-map-performance.spec.ts.
   */
  it("renders 200 hosts within budget", () => {
    const big = bigTopology(4, 50);
    expect(big.nodes).toHaveLength(200);
    render({ topology: big }); // warm up: module loading and JIT aren't the renderer's cost

    const times: number[] = [];
    let markup = "";
    for (let run = 0; run < 5; run += 1) {
      const start = performance.now();
      markup = render({ topology: big });
      times.push(performance.now() - start);
    }
    expect(count(markup, /data-host-id="/g)).toBe(200);
    expect(count(markup, /role="button"/g)).toBe(200);
    expect(count(markup, /tabindex="0"/g)).toBe(1);
    // Coverage instrumentation (pnpm test:coverage) slows rendering several times over.
    expect(Math.min(...times)).toBeLessThan(process.env.COVERAGE ? 5000 : 1000);
  });
});
