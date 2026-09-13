import { describe, expect, it } from "vitest";
import { fixtureState, run } from "../__fixtures__/harness";
import { FIXTURE_SCENARIO, FIXTURE_SEED } from "../__fixtures__/scenario";
import { createInitialState } from "../core/scenario";
import { serializeState } from "../core/serialize";
import type { SimState } from "../core/types";
import { emptyDiscovery, hostMapState, recordHost, selectTopology } from "./discovery";
import type { DiscoveredHost, DiscoveredTopology, TopologyNode } from "./types";

/** Runs each command line in turn. */
function runAll(state: SimState, ...lines: string[][]): SimState {
  return lines.reduce((current, argv) => run(current, ...argv).state, state);
}

const nodeFor = (topology: DiscoveredTopology, hostId: string): TopologyNode | undefined =>
  topology.nodes.find((node) => node.hostId === hostId);

/** Every trace of a host the learner never saw: its id, name, address, services and OS. */
const VAULT_TRACES = /vault|10\.0\.2\.50|443|https|Vault/;
const PRINTER_TRACES = /printer|10\.0\.1\.30|9100|printd|embedded/;

describe("selectTopology", () => {
  it("starts with only the learner's own machine and its network", () => {
    const topology = selectTopology(fixtureState());
    expect(topology).toEqual({
      nodes: [
        {
          hostId: "ws-01",
          label: "ws-01",
          hostname: "ws-01.corp.example",
          ips: ["10.0.1.10"],
          subnets: ["10.0.1.0/24"],
          state: "accessed",
          services: [],
          firstSeenTick: 0,
          via: "session",
          isSessionHost: true,
        },
      ],
      subnets: [
        { cidr: "10.0.1.0/24", name: "office", hostIds: ["ws-01"], containsSessionHost: true },
      ],
      links: [],
      sessionHostId: "ws-01",
      counts: {
        hosts: 1,
        found: 0,
        services: 0,
        byState: { unknown: 0, detected: 0, enumerated: 0, accessed: 1 },
      },
    });
  });

  describe("never leaks ground truth", () => {
    it("leaves out a host that exists but was never seen, in any form", () => {
      const state = runAll(
        fixtureState(),
        ["netscan", "10.0.1.0/24", "-p", "all", "--no-ping"],
        ["netscan", "10.0.2.0/24", "-p", "all", "--no-ping"],
        ["webprobe", "web-01"],
      );
      // vault-01 is right there in ground truth, next to hosts the learner did find...
      expect(state.network.hosts["vault-01"]).toBeDefined();
      expect(state.discovery.hosts["db-01"]).toBeDefined();
      // ...but only web-01 can reach it, so nothing about it may reach the map.
      const topology = selectTopology(state);
      expect(topology.nodes.map((node) => node.hostId)).toEqual([
        "ws-01",
        "web-01",
        "printer-01",
        "db-01",
      ]);
      expect(JSON.stringify(topology)).not.toMatch(VAULT_TRACES);
    });

    it("leaves out a host that ignores pings until a scan skips the ping", () => {
      const swept = run(fixtureState(), "netscan", "10.0.1.0/24").state;
      expect(swept.network.hosts["printer-01"]).toBeDefined();
      expect(JSON.stringify(selectTopology(swept))).not.toMatch(PRINTER_TRACES);

      const knocked = run(swept, "netscan", "10.0.1.0/24", "-p", "9100", "--no-ping").state;
      const printer = nodeFor(selectTopology(knocked), "printer-01");
      expect(printer).toMatchObject({ ips: ["10.0.1.30"], state: "enumerated" });
      expect(printer?.services.map((service) => service.port)).toEqual([9100]);
    });

    it("shows only what's been seen of a host it does show", () => {
      const swept = run(fixtureState(), "netscan", "10.0.1.0/24").state;
      const web = nodeFor(selectTopology(swept), "web-01");
      expect(web).toEqual({
        hostId: "web-01",
        label: "web-01",
        hostname: "web-01.corp.example",
        ips: ["10.0.1.20"],
        subnets: ["10.0.1.0/24"],
        state: "detected",
        services: [],
        firstSeenTick: 1,
        via: "netscan",
        isSessionHost: false,
      });
      // Its other address, its services, its software and its OS are all ground truth so far.
      expect(JSON.stringify(web)).not.toMatch(/10\.0\.2\.20|ssh|http|Linux|2\.4\.58/);
    });

    it("lists no network the learner has no address in, not even its name", () => {
      const topology = selectTopology(run(fixtureState(), "netscan", "10.0.1.0/24").state);
      expect(topology.subnets.map((subnet) => subnet.cidr)).toEqual(["10.0.1.0/24"]);
      expect(JSON.stringify(topology)).not.toMatch(/10\.0\.2\.|servers/);
    });

    it("never counts what's left to find", () => {
      const topology = selectTopology(run(fixtureState(), "netscan", "10.0.1.0/24").state);
      expect(Object.keys(topology.counts).sort()).toEqual([
        "byState",
        "found",
        "hosts",
        "services",
      ]);
      expect(topology.counts).toEqual({
        hosts: 2,
        found: 1,
        services: 0,
        byState: { unknown: 0, detected: 1, enumerated: 0, accessed: 1 },
      });
    });
  });

  describe("node states", () => {
    it("shows a host from the briefing as unknown until it answers", () => {
      const briefed = createInitialState(
        { ...FIXTURE_SCENARIO, knownHosts: ["web-01", "vault-01"] },
        FIXTURE_SEED,
      );
      const before = selectTopology(briefed);
      expect(nodeFor(before, "web-01")).toMatchObject({ state: "unknown", via: "briefing" });
      expect(nodeFor(before, "vault-01")).toMatchObject({ state: "unknown", ips: ["10.0.2.50"] });
      expect(before.counts.found).toBe(0);
      // A network holding only a host heard of is on the map, but nothing proves it's reachable.
      expect(before.links).toEqual([]);

      const after = selectTopology(
        runAll(briefed, ["netscan", "10.0.1.0/24"], ["netscan", "10.0.2.0/24"]),
      );
      expect(nodeFor(after, "web-01")).toMatchObject({ state: "detected", via: "briefing" });
      // vault-01 still hasn't answered: only web-01 can reach it.
      expect(nodeFor(after, "vault-01")?.state).toBe("unknown");
      expect(after.counts.found).toBe(2);
    });

    it("moves detected to enumerated with a port scan, even one that finds nothing open", () => {
      const swept = run(fixtureState(), "netscan", "10.0.2.0/24").state;
      expect(nodeFor(selectTopology(swept), "db-01")?.state).toBe("detected");
      const scanned = run(swept, "netscan", "db-01", "-p", "common").state;
      expect(nodeFor(selectTopology(scanned), "db-01")).toMatchObject({
        state: "enumerated",
        osGuess: "Linux",
        services: [],
      });
    });

    it("counts a host as enumerated once any service on it is known", () => {
      const probed = run(fixtureState(), "webprobe", "web-01").state;
      expect(probed.discovery.hosts["web-01"]?.portScanned).toBe(false);
      const web = nodeFor(selectTopology(probed), "web-01");
      expect(web?.state).toBe("enumerated");
      expect(web?.services).toMatchObject([{ port: 80, product: "httpd", version: "2.4.58" }]);
    });

    it("shows the learner's own machine as accessed", () => {
      expect(nodeFor(selectTopology(fixtureState()), "ws-01")).toMatchObject({
        state: "accessed",
        isSessionHost: true,
      });
    });

    it("maps each discovered host to one state, most advanced first", () => {
      const host: DiscoveredHost = {
        hostId: "h",
        ips: ["10.0.1.5"],
        firstSeenTick: 0,
        via: "briefing",
        answered: false,
        portScanned: false,
        accessed: false,
        services: {},
      };
      expect(hostMapState(host)).toBe("unknown");
      expect(hostMapState({ ...host, answered: true })).toBe("detected");
      expect(hostMapState({ ...host, answered: true, portScanned: true })).toBe("enumerated");
      expect(
        hostMapState({
          ...host,
          answered: true,
          services: {
            "22/tcp": { port: 22, protocol: "tcp", name: "ssh", firstSeenTick: 1, via: "t" },
          },
        }),
      ).toBe("enumerated");
      expect(hostMapState({ ...host, answered: true, portScanned: true, accessed: true })).toBe(
        "accessed",
      );
    });
  });

  describe("subnets and links", () => {
    const both = () =>
      selectTopology(
        runAll(fixtureState(), ["netscan", "10.0.1.0/24"], ["netscan", "10.0.2.0/24"]),
      );

    it("places a multi-homed host once, and links it to its other network", () => {
      const topology = both();
      expect(nodeFor(topology, "web-01")).toMatchObject({
        ips: ["10.0.1.20", "10.0.2.20"],
        subnets: ["10.0.1.0/24", "10.0.2.0/24"],
      });
      expect(topology.subnets).toEqual([
        {
          cidr: "10.0.1.0/24",
          name: "office",
          hostIds: ["ws-01", "web-01"],
          containsSessionHost: true,
        },
        { cidr: "10.0.2.0/24", name: "servers", hostIds: ["db-01"], containsSessionHost: false },
      ]);
      expect(topology.links).toEqual([
        { kind: "route", from: "10.0.1.0/24", to: "10.0.2.0/24" },
        { kind: "interface", hostId: "web-01", subnet: "10.0.2.0/24" },
      ]);
    });

    it("draws a route to a network once anything in it answers, even a lone address", () => {
      const topology = selectTopology(run(fixtureState(), "netscan", "10.0.2.20").state);
      // Seen only on its servers address, web-01 is placed there, with no extra interface yet.
      expect(nodeFor(topology, "web-01")?.subnets).toEqual(["10.0.2.0/24"]);
      expect(topology.subnets.map(({ cidr, hostIds }) => [cidr, hostIds])).toEqual([
        ["10.0.1.0/24", ["ws-01"]],
        ["10.0.2.0/24", ["web-01"]],
      ]);
      expect(topology.links).toEqual([{ kind: "route", from: "10.0.1.0/24", to: "10.0.2.0/24" }]);
    });

    it("sorts nodes by address, services by port, and subnets by address", () => {
      const state = runAll(
        fixtureState(),
        ["netscan", "10.0.2.0/24", "-p", "all"],
        ["netscan", "10.0.1.0/24", "-p", "all", "--no-ping"],
      );
      const topology = selectTopology(state);
      expect(topology.nodes.map((node) => node.ips[0])).toEqual([
        "10.0.1.10",
        "10.0.1.20",
        "10.0.1.30",
        "10.0.2.40",
      ]);
      expect(topology.subnets.map((subnet) => subnet.cidr)).toEqual(["10.0.1.0/24", "10.0.2.0/24"]);
      expect(nodeFor(topology, "web-01")?.services.map((service) => service.port)).toEqual([
        22, 80,
      ]);
      expect(nodeFor(topology, "printer-01")?.services.map((service) => service.port)).toEqual([
        80, 9100,
      ]);
    });

    it("labels a host by its address until its name is known", () => {
      const discovery = recordHost(fixtureState().discovery, {
        hostId: "web-01",
        ip: "10.0.1.20",
        via: "test",
        tick: 1,
      }).discovery;
      const topology = selectTopology({ ...fixtureState(), discovery });
      expect(nodeFor(topology, "web-01")).toMatchObject({ label: "10.0.1.20" });
      expect(nodeFor(topology, "web-01")?.hostname).toBeUndefined();
    });

    it("still places a host whose address the network doesn't list", () => {
      const discovery = recordHost(emptyDiscovery(), {
        hostId: "ghost",
        ip: "10.9.9.9",
        via: "test",
        tick: 1,
      }).discovery;
      const topology = selectTopology({ ...fixtureState(), discovery });
      expect(topology.subnets).toEqual([
        { cidr: "10.9.9.0/24", hostIds: ["ghost"], containsSessionHost: false },
      ]);
      // The learner's machine isn't on this map, so there's nowhere for a route to start.
      expect(topology.links).toEqual([]);
    });
  });

  it("is deterministic and never mutates the state", () => {
    const state = runAll(
      fixtureState(),
      ["netscan", "10.0.1.0/24", "-p", "common"],
      ["netscan", "10.0.2.0/24"],
    );
    // States are deep-frozen outside production, so a mutation would throw.
    expect(Object.isFrozen(state.discovery.hosts["web-01"])).toBe(true);
    const before = serializeState(state);
    const first = selectTopology(state);
    const second = selectTopology(state);
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(second.nodes).not.toBe(first.nodes);
    expect(serializeState(state)).toBe(before);
  });

  it("gives the same map whatever order discovery recorded hosts in", () => {
    const state = runAll(fixtureState(), ["netscan", "10.0.2.0/24"], ["netscan", "10.0.1.0/24"]);
    const reversed = Object.fromEntries(Object.entries(state.discovery.hosts).reverse());
    expect(selectTopology({ ...state, discovery: { hosts: reversed } })).toEqual(
      selectTopology(state),
    );
  });
});
