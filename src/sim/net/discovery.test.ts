import { describe, expect, it } from "vitest";
import { fixtureState, run } from "../__fixtures__/harness";
import { serializeState } from "../core/serialize";
import {
  emptyDiscovery,
  isDiscovered,
  markAccessed,
  markPortScanned,
  recordHost,
  recordService,
} from "./discovery";

describe("discovery state", () => {
  it("starts empty and records a host once", () => {
    const first = recordHost(emptyDiscovery(), {
      hostId: "web-01",
      ip: "10.0.1.20",
      hostname: "web-01",
      via: "netscan",
      tick: 3,
    });
    expect(first.isNew).toBe(true);
    expect(first.discovery.hosts["web-01"]).toEqual({
      hostId: "web-01",
      ips: ["10.0.1.20"],
      hostname: "web-01",
      firstSeenTick: 3,
      via: "netscan",
      portScanned: false,
      accessed: false,
      services: {},
    });
    const again = recordHost(first.discovery, {
      hostId: "web-01",
      ip: "10.0.1.20",
      via: "webprobe",
      tick: 9,
    });
    expect(again.isNew).toBe(false);
    expect(again.discovery).toBe(first.discovery);
  });

  it("adds a second address without calling the host new", () => {
    const one = recordHost(emptyDiscovery(), {
      hostId: "web-01",
      ip: "10.0.2.20",
      via: "netscan",
      tick: 1,
    }).discovery;
    const two = recordHost(one, { hostId: "web-01", ip: "10.0.1.20", via: "netscan", tick: 2 });
    expect(two.isNew).toBe(false);
    expect(two.discovery.hosts["web-01"]?.ips).toEqual(["10.0.1.20", "10.0.2.20"]);
  });

  it("records services, filling in details later without losing first-seen info", () => {
    const base = recordHost(emptyDiscovery(), {
      hostId: "h",
      ip: "10.0.1.20",
      via: "netscan",
      tick: 1,
    }).discovery;
    const found = recordService(base, "h", {
      port: 80,
      protocol: "tcp",
      name: "http",
      via: "netscan",
      tick: 1,
    });
    expect(found.isNew).toBe(true);
    const fingerprinted = recordService(found.discovery, "h", {
      port: 80,
      protocol: "tcp",
      name: "http",
      product: "httpd",
      version: "2.4.58",
      via: "webprobe",
      tick: 4,
    });
    expect(fingerprinted.isNew).toBe(false);
    expect(fingerprinted.discovery.hosts.h?.services["80/tcp"]).toEqual({
      port: 80,
      protocol: "tcp",
      name: "http",
      product: "httpd",
      version: "2.4.58",
      firstSeenTick: 1,
      via: "netscan",
    });
    expect(() =>
      recordService(emptyDiscovery(), "ghost", {
        port: 1,
        protocol: "tcp",
        name: "x",
        via: "t",
        tick: 1,
      }),
    ).toThrow();
  });

  it("tracks port-scanned and accessed separately", () => {
    const base = recordHost(emptyDiscovery(), {
      hostId: "h",
      ip: "10.0.1.20",
      via: "netscan",
      tick: 1,
    }).discovery;
    expect(markPortScanned(base, "h", "Linux").hosts.h).toMatchObject({
      portScanned: true,
      osGuess: "Linux",
      accessed: false,
    });
    expect(markAccessed(base, "h").hosts.h).toMatchObject({ portScanned: false, accessed: true });
  });
});

describe("discovery through the tools", () => {
  it("keeps a host discovered but not yet port-scanned apart from an enumerated one", () => {
    const swept = run(fixtureState(), "netscan", "10.0.1.0/24").state;
    expect(swept.discovery.hosts["web-01"]).toMatchObject({ portScanned: false, services: {} });
    const scanned = run(swept, "netscan", "web-01", "-p", "common").state;
    expect(scanned.discovery.hosts["web-01"]?.portScanned).toBe(true);
    expect(Object.keys(scanned.discovery.hosts["web-01"]?.services ?? {})).toEqual([
      "22/tcp",
      "80/tcp",
    ]);
  });

  it("never records a host the learner can't reach, even when scanning its range", () => {
    const state = run(fixtureState(), "netscan", "10.0.2.0/24", "-p", "all", "--no-ping").state;
    expect(isDiscovered(state.discovery, "vault-01")).toBe(false);
    expect(isDiscovered(state.discovery, "db-01")).toBe(true);
    // vault-01 is in ground truth, but nothing about it leaks into discovery.
    expect(state.network.hosts["vault-01"]).toBeDefined();
    expect(JSON.stringify(state.discovery)).not.toMatch(/vault|10\.0\.2\.50|443/);
  });

  it("keeps ground truth unchanged while discovery grows", () => {
    const start = fixtureState();
    const after = run(
      run(start, "netscan", "10.0.1.0/24", "-p", "all").state,
      "webprobe",
      "web-01",
    ).state;
    expect(after.network).toBe(start.network);
    expect(after.machines).toBe(start.machines);
    expect(serializeState(after)).not.toBe(serializeState(start));
    expect(Object.keys(after.discovery.hosts).sort()).toEqual(["web-01", "ws-01"]);
  });

  it("doesn't learn a firewalled port's service, even on a reachable host", () => {
    const state = run(fixtureState(), "netscan", "db-01", "-p", "all").state;
    expect(state.discovery.hosts["db-01"]).toMatchObject({ portScanned: true, services: {} });
  });
});
