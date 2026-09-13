import { describe, expect, it } from "vitest";
import { errorCodes, eventTypes, fixtureState, run, text } from "../__fixtures__/harness";
import { parsePorts } from "./netscan";

describe("netscan", () => {
  it("finds the hosts that answer a ping, sorted by address", () => {
    const result = run(fixtureState(), "netscan", "10.0.1.0/24");
    expect(result.exitCode).toBe(0);
    expect(text(result)).toMatch(/10\.0\.1\.10\s+ws-01\.corp\.example\s+up \(this computer\)/);
    expect(text(result)).toMatch(
      /10\.0\.1\.20\s+web-01\.corp\.example\s+up \(replied in [\d.]+ ms\)/,
    );
    expect(text(result)).not.toContain("printer-01"); // ignores pings
    expect(text(result)).toContain("256 addresses checked · 2 hosts up");
    expect(result.events.filter((e) => e.type === "host.discovered")).toEqual([
      { type: "host.discovered", hostId: "web-01", ip: "10.0.1.20", via: "netscan" },
    ]);
  });

  it("labels its output as simulated", () => {
    expect(text(run(fixtureState(), "netscan", "10.0.1.20"))).toMatch(/^netscan \(simulated\)/);
  });

  it("stays silent about a host that exists but is firewalled off", () => {
    const result = run(fixtureState(), "netscan", "10.0.2.50");
    expect(result.exitCode).toBe(0);
    expect(text(result)).toContain("No hosts answered.");
    expect(text(result)).not.toContain("vault");
    expect(eventTypes(result)).not.toContain("host.discovered");
  });

  it("lists open ports with --ports, only once per discovery", () => {
    const first = run(fixtureState(), "netscan", "web-01", "--ports", "22,80,443");
    expect(text(first)).toMatch(/22\/tcp\s+open\s+ssh/);
    expect(text(first)).toMatch(/80\/tcp\s+open\s+http/);
    expect(text(first)).not.toContain("443/tcp");
    expect(text(first)).toContain("3 ports on 10.0.1.20 (web-01.corp.example)");
    expect(first.events.filter((e) => e.type === "service.discovered")).toHaveLength(2);
    const again = run(first.state, "netscan", "web-01", "-p", "22,80");
    expect(eventTypes(again)).not.toContain("service.discovered");
    expect(again.events).toContainEqual({
      type: "scan.completed",
      target: "web-01",
      hostsUp: 1,
      openPorts: 2,
      portScan: true,
    });
  });

  it("shows a reachable host whose every port is firewalled as up, with nothing open", () => {
    const result = run(fixtureState(), "netscan", "db-01", "-p", "all");
    expect(text(result)).toContain("no open ports found among the ports checked");
    expect(text(result)).not.toContain("5432");
  });

  it("finds hosts that ignore pings with --no-ping", () => {
    const result = run(fixtureState(), "netscan", "10.0.1.0/24", "-p", "9100", "--no-ping");
    expect(text(result)).toMatch(/9100\/tcp\s+open\s+printer/);
    expect(result.events).toContainEqual({
      type: "host.discovered",
      hostId: "printer-01",
      ip: "10.0.1.30",
      via: "netscan",
    });
    expect(result.state.discovery.hosts["printer-01"]?.osGuess).toBe("embedded device");
  });

  it("needs --ports to go with --no-ping", () => {
    expect(errorCodes(run(fixtureState(), "netscan", "10.0.1.0/24", "--no-ping"))).toEqual([
      "MISSING_ARGUMENT",
    ]);
  });

  it.each([
    [["netscan"], "MISSING_ARGUMENT"],
    [["netscan", "10.0.1.0/24", "10.0.2.0/24"], "BAD_ARGUMENT"],
    [["netscan", "--fast", "10.0.1.0/24"], "BAD_FLAG"],
    [["netscan", "10.0.0.0/8"], "BAD_ARGUMENT"],
    [["netscan", "10.0.1.0/99"], "BAD_ARGUMENT"],
    [["netscan", "10.0.1"], "BAD_ARGUMENT"],
    [["netscan", "10.0.1.20", "-p", "0"], "BAD_ARGUMENT"],
    [["netscan", "10.0.1.20", "-p", "80-22"], "BAD_ARGUMENT"],
    [["netscan", "10.0.1.20", "-p", "http"], "BAD_ARGUMENT"],
    [["netscan", "10.0.1.20", "-p"], "MISSING_ARGUMENT"],
    [["netscan", "nowhere"], "HOST_NOT_FOUND"],
    [["netscan", "100.64.0.1"], "OUT_OF_SCOPE"],
    [["netscan", "100.64.0.0/24"], "OUT_OF_SCOPE"],
    [["netscan", "portal.corp"], "OUT_OF_SCOPE"],
  ])("%j fails with %s", (argv, code) => {
    const result = run(fixtureState(), ...argv);
    expect(errorCodes(result)).toEqual([code]);
    expect(result.exitCode).not.toBe(0);
  });

  it("changes nothing when it fails", () => {
    const state = fixtureState();
    const result = run(state, "netscan", "100.64.0.1");
    expect(result.state.discovery).toBe(state.discovery);
    expect(result.state.tick).toBe(1);
  });
});

describe("parsePorts", () => {
  it("merges overlapping ranges and counts ports", () => {
    const ports = parsePorts("80,20-25,22,24-30");
    expect(ports.ok && ports.value.ranges).toEqual([
      [20, 30],
      [80, 80],
    ]);
    expect(ports.ok && ports.value.count).toBe(12);
  });

  it("knows the named sets", () => {
    const all = parsePorts("all");
    expect(all.ok && all.value.count).toBe(65535);
    const common = parsePorts("COMMON");
    expect(common.ok && common.value.label).toMatch(/common ports/);
  });
});
