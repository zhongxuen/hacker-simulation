/**
 * netscan: host and port discovery over the simulated network. Representative output, not a copy
 * of any real scanner's.
 *
 * - `netscan <range>` asks every address "are you there?" (a ping) and lists who answers.
 * - `--ports` also knocks on those ports and lists the open ones: "detected" becomes "enumerated".
 * - `--no-ping` knocks even on hosts that ignore pings.
 *
 * Firewall rules come straight from the scenario: a host the learner's machine can't reach never
 * answers, exactly as if it weren't there.
 */
import { err, ok, type Result } from "../core/result";
import type { SimError } from "../core/errors";
import { columns, failure, plural, stdout, success } from "../core/output";
import { sessionHost, withDiscovery } from "../core/session";
import type { OutputLine, SimEvent } from "../core/types";
import { markPortScanned, recordHost, recordService } from "../net/discovery";
import { allHosts, canReach, osGuess, primaryIp } from "../net/graph";
import { cidrContains, parseIpv4 } from "../net/ip";
import type { Host, Service } from "../net/types";
import { hasSwitch, optionValue, parseArgs } from "./args";
import { parseScanTarget } from "./target";
import type { Tool } from "./types";

const NAME = "netscan";

/** The doors most worth checking first. */
export const COMMON_PORTS: readonly number[] = [
  21, 22, 23, 25, 53, 80, 110, 139, 143, 443, 445, 3306, 3389, 5432, 5900, 8080, 8443, 9100,
];

export interface PortSelection {
  /** Sorted, non-overlapping inclusive ranges. */
  readonly ranges: readonly (readonly [number, number])[];
  readonly count: number;
  readonly label: string;
}

/** "22", "20-25,80", "common", or "all". */
export function parsePorts(text: string): Result<PortSelection, SimError> {
  const bad = (reason: "bad-format" | "out-of-range") =>
    err<SimError>({ code: "BAD_ARGUMENT", argument: "--ports", value: text, reason });
  const lower = text.toLowerCase();
  if (lower === "all") return ok({ ranges: [[1, 65535]], count: 65535, label: "all 65535 ports" });
  if (lower === "common") {
    return ok({
      ranges: COMMON_PORTS.map((port) => [port, port] as const),
      count: COMMON_PORTS.length,
      label: `${COMMON_PORTS.length} common ports`,
    });
  }
  const ranges: [number, number][] = [];
  for (const part of text.split(",")) {
    const match = /^(\d{1,5})(?:-(\d{1,5}))?$/.exec(part);
    if (!match) return bad("bad-format");
    const lo = Number(match[1]);
    const hi = match[2] === undefined ? lo : Number(match[2]);
    if (lo < 1 || hi > 65535 || lo > hi) return bad("out-of-range");
    ranges.push([lo, hi]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1] + 1) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }
  const count = merged.reduce((sum, [lo, hi]) => sum + hi - lo + 1, 0);
  return ok({ ranges: merged, count, label: count === 1 ? `port ${text}` : plural(count, "port") });
}

const includesPort = (selection: PortSelection, port: number) =>
  selection.ranges.some(([lo, hi]) => port >= lo && port <= hi);

export const netscan: Tool = {
  name: NAME,
  category: "network",
  help: {
    oneLiner: "find which computers are switched on, and which doors (ports) they have open.",
    usage: ["netscan <target>", "netscan <target> --ports <list>"],
    description: [
      "Every computer on a network has an address, called an IP address, like a house number on a street. netscan knocks on addresses and lists the computers that answer. A computer on a network is also called a host.",
      "The target can be one address (10.0.1.20), a name (web-01), or a range. A range like 10.0.1.0/24 means every address from 10.0.1.0 to 10.0.1.255: the /24 says the first three numbers stay the same.",
      "Each computer also has numbered doors for different jobs, called ports. With --ports, netscan checks which doors are open and guesses which program, called a service, answers behind each one.",
      "If a computer never answers, it may be switched off, or a firewall may be blocking you. A firewall is a set of rules about who may talk to whom.",
    ],
    options: [
      {
        flags: "-p, --ports <list>",
        text: "Which ports to check: 22, 20-25, 22,80,443, common (a short list of popular ports), or all.",
      },
      {
        flags: "--no-ping",
        text: "Check ports even on computers that ignore 'are you there?' messages (pings). Needs --ports.",
      },
      { flags: "--help", text: "Show this help." },
    ],
    examples: [
      {
        command: "netscan 10.0.1.0/24",
        text: "Find every computer switched on in the 10.0.1.x network.",
      },
      {
        command: "netscan web-01 --ports common",
        text: "Check the most common ports on the computer called web-01.",
      },
      {
        command: "netscan 10.0.1.0/24 -p 9100 --no-ping",
        text: "Look for printers, even ones that ignore pings.",
      },
    ],
    concept: [
      "You can't protect what you don't know about. Security teams scan their own networks to find forgotten computers and open ports that should be closed. The list they build is called an asset inventory.",
      "Scanning a network you don't own, without written permission, is a crime in many countries. Your team only scans networks it has permission to test, and this practice network is one of them.",
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [
      { names: ["-p", "--ports"], key: "ports", takesValue: true },
      { names: ["--no-ping"], key: "noPing" },
    ]);
    if (!parsed.ok) return failure(NAME, parsed.error, state);
    const [rawTarget, extra] = parsed.value.positionals;
    if (rawTarget === undefined)
      return failure(NAME, { code: "MISSING_ARGUMENT", argument: "target" }, state);
    if (extra !== undefined) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "target", value: extra, reason: "extra-argument" },
        state,
      );
    }
    const target = parseScanTarget(state.network, rawTarget);
    if (!target.ok) return failure(NAME, target.error, state);
    const portsText = optionValue(parsed.value, "ports");
    const ports = portsText === undefined ? undefined : parsePorts(portsText);
    if (ports && !ports.ok) return failure(NAME, ports.error, state);
    const selection = ports?.value;
    const noPing = hasSwitch(parsed.value, "noPing");
    if (noPing && !selection)
      return failure(NAME, { code: "MISSING_ARGUMENT", argument: "--ports" }, state);

    const from = sessionHost(state);
    const { range } = target.value;

    // Every (host, address) in range that answers, sorted by address.
    const answering: { host: Host; ip: string }[] = [];
    for (const host of allHosts(state.network)) {
      for (const { ip } of host.interfaces) {
        if (!cidrContains(range, parseIpv4(ip) as number)) continue;
        const reachable = host.id === from.id || canReach(state.network, from.id, host.id);
        if (reachable && (host.id === from.id || host.respondsToPing || noPing))
          answering.push({ host, ip });
      }
    }
    answering.sort((a, b) => (parseIpv4(a.ip) as number) - (parseIpv4(b.ip) as number));

    let discovery = state.discovery;
    const events: SimEvent[] = [];
    const body: OutputLine[] = [];
    let openPorts = 0;
    const latency = (host: Host) =>
      host.id === from.id
        ? "this computer"
        : `replied in ${(0.3 + ctx.rng.next() * 1.7).toFixed(1)} ms`;

    for (const { host, ip } of answering) {
      const seen = recordHost(discovery, {
        hostId: host.id,
        ip,
        hostname: host.hostname,
        via: NAME,
        tick: ctx.tick,
      });
      discovery = seen.discovery;
      if (seen.isNew) events.push({ type: "host.discovered", hostId: host.id, ip, via: NAME });
    }

    if (!selection) {
      const rows = answering.map(({ host, ip }) => [ip, host.hostname, `up (${latency(host)})`]);
      body.push(
        ...(rows.length
          ? columns([["ADDRESS", "NAME", "STATUS"], ...rows]).map(stdout)
          : [stdout("No hosts answered.")]),
      );
    } else {
      if (answering.length === 0) body.push(stdout("No hosts answered."));
      for (const { host, ip } of answering) {
        const open = host.services.filter(
          (service: Service) =>
            includesPort(selection, service.port) &&
            canReach(state.network, from.id, host.id, service),
        );
        openPorts += open.length;
        body.push(stdout(`${ip}  ${host.hostname}  up (${latency(host)})`));
        if (open.length === 0) {
          body.push(stdout("  no open ports found among the ports checked"));
        } else {
          const rows = open.map((service) => [
            `${service.port}/${service.protocol}`,
            "open",
            service.name,
          ]);
          body.push(
            ...columns([["PORT", "STATE", "SERVICE"], ...rows]).map((line) => stdout(`  ${line}`)),
          );
        }
        const guess = osGuess(host.os);
        body.push(stdout(`  OS guess: ${guess}`), stdout(""));
        for (const service of open) {
          const seen = recordService(discovery, host.id, {
            port: service.port,
            protocol: service.protocol,
            name: service.name,
            via: NAME,
            tick: ctx.tick,
          });
          discovery = seen.discovery;
          if (seen.isNew) {
            events.push({
              type: "service.discovered",
              hostId: host.id,
              ip,
              port: service.port,
              protocol: service.protocol,
              service: service.name,
              via: NAME,
            });
          }
        }
        discovery = markPortScanned(discovery, host.id, guess);
      }
      if (body[body.length - 1]?.text === "") body.pop();
    }

    const seconds = (
      0.4 +
      ctx.rng.next() * 0.6 +
      Math.min(target.value.addressCount, 256) * 0.006 +
      (selection ? answering.length * Math.min(selection.count, 1000) * 0.0008 : 0)
    ).toFixed(2);
    const summary = [
      plural(target.value.addressCount, "address", "addresses") + " checked",
      plural(answering.length, "host") + " up",
      ...(selection ? [plural(openPorts, "open port")] : []),
      `${seconds} s`,
    ].join(" · ");
    const what = selection
      ? `checking ${selection.label} on ${target.value.label}`
      : `looking for hosts in ${target.value.label}`;
    events.push({
      type: "scan.completed",
      target: rawTarget,
      hostsUp: answering.length,
      openPorts,
      portScan: selection !== undefined,
    });

    const output = [
      stdout(`netscan (simulated) · ${what} · from ${from.hostname} (${primaryIp(from)})`),
      stdout(""),
      ...body,
      stdout(""),
      stdout(`Done: ${summary}`),
    ];
    return success(withDiscovery(state, discovery), output, events);
  },
};
