/**
 * A synthetic network for measuring the map's frame rate, and nothing else.
 *
 * It exists because no mission has 200 hosts and none should: a mission is 5-20 minutes of story
 * for a complete beginner, and a map with 200 cards on it would be a wall, not a lesson. But the
 * renderer has to hold up at that size anyway — a learner can zoom and drag a busy map for as long
 * as they like — so the frame rate is measured against a fixture instead of against content.
 *
 * Every address is in the reserved 10.x range and every name is made up, like all content here.
 */
import type {
  DiscoveredService,
  DiscoveredTopology,
  TopologyLink,
  TopologyNode,
  TopologyNodeState,
  TopologySubnet,
} from "@/sim/types";

/** Kept at 8 so every subnet index is one digit and addresses sort the same as numbers. */
const SUBNETS = 8;

const SUBNET_NAMES = [
  "office",
  "workshop",
  "storeroom",
  "lab",
  "reception",
  "archive",
  "training",
  "spare",
] as const;

/** Cycled over the hosts, so the map draws every state's shape, colour and wording. */
const STATES: readonly TopologyNodeState[] = ["detected", "enumerated", "unknown", "accessed"];

const SERVICES: readonly DiscoveredService[] = [
  {
    port: 22,
    protocol: "tcp",
    name: "ssh",
    banner: "OpenSSH 9.2",
    firstSeenTick: 1,
    via: "netscan",
  },
  {
    port: 80,
    protocol: "tcp",
    name: "http",
    banner: "nginx 1.24",
    firstSeenTick: 1,
    via: "netscan",
  },
  { port: 443, protocol: "tcp", name: "https", firstSeenTick: 1, via: "netscan" },
];

export interface BenchTopologyOptions {
  /** How many hosts the fixture can hold in total. */
  readonly hosts: number;
  /** How many of them have been discovered so far. The rest aren't on the map yet. */
  readonly shown: number;
}

/**
 * The same input always gives the same map, so a measurement can be compared with the last one.
 * `shown` truncates the host list; the subnets, links and counts are derived from what's left, so
 * a partly revealed map is shaped exactly like one the selector would return.
 */
export function benchTopology({ hosts, shown }: BenchTopologyOptions): DiscoveredTopology {
  const perSubnet = Math.max(1, Math.ceil(hosts / SUBNETS));
  const total = Math.max(0, Math.min(hosts, shown));

  const nodes: TopologyNode[] = [];
  for (let index = 0; index < total; index += 1) {
    const subnetIndex = Math.floor(index / perSubnet);
    const cidr = subnetCidr(subnetIndex);
    const ip = `10.10.${subnetIndex}.${10 + (index % perSubnet)}`;
    const isSessionHost = index === 0;
    const state = isSessionHost ? "accessed" : STATES[index % STATES.length]!;
    // Every eighth host also has an address in the next network along, so the map draws the
    // interface lines too, not only the cards.
    const alsoIn =
      index % 8 === 3 && subnetIndex + 1 < SUBNETS ? subnetCidr(subnetIndex + 1) : undefined;
    const services =
      state === "enumerated" || state === "accessed" ? SERVICES.slice(0, 1 + (index % 3)) : [];
    nodes.push({
      hostId: `bench-${index.toString().padStart(3, "0")}`,
      label: isSessionHost ? "your-computer" : `host-${index.toString().padStart(3, "0")}`,
      hostname: `host-${index.toString().padStart(3, "0")}.bench.example`,
      ips: alsoIn === undefined ? [ip] : [ip, `10.10.${subnetIndex + 1}.${200 + (index % 50)}`],
      subnets: alsoIn === undefined ? [cidr] : [cidr, alsoIn],
      ...(state === "unknown" ? {} : { osGuess: index % 2 === 0 ? "Linux" : "Windows" }),
      state,
      services,
      firstSeenTick: index,
      via: "netscan",
      isSessionHost,
    });
  }

  const sessionCidr = subnetCidr(0);
  const subnets: TopologySubnet[] = [];
  for (let index = 0; index < SUBNETS; index += 1) {
    const cidr = subnetCidr(index);
    const hostIds = nodes.filter((node) => node.subnets[0] === cidr).map((node) => node.hostId);
    if (hostIds.length === 0) continue;
    subnets.push({
      cidr,
      name: SUBNET_NAMES[index]!,
      hostIds,
      containsSessionHost: cidr === sessionCidr,
    });
  }

  const links: TopologyLink[] = [
    ...subnets
      .filter((subnet) => subnet.cidr !== sessionCidr)
      .map((subnet): TopologyLink => ({ kind: "route", from: sessionCidr, to: subnet.cidr })),
    ...nodes.flatMap((node) =>
      node.subnets.slice(1).map((subnet): TopologyLink => ({
        kind: "interface",
        hostId: node.hostId,
        subnet,
      })),
    ),
  ];

  const byState: Record<TopologyNodeState, number> = {
    unknown: 0,
    detected: 0,
    enumerated: 0,
    accessed: 0,
  };
  for (const node of nodes) byState[node.state] += 1;

  return {
    nodes,
    subnets,
    links,
    sessionHostId: nodes[0]?.hostId ?? "bench-000",
    counts: {
      hosts: nodes.length,
      found: nodes.filter((node) => !node.isSessionHost && node.state !== "unknown").length,
      services: nodes.reduce((sum, node) => sum + node.services.length, 0),
      byState,
    },
  };
}

const subnetCidr = (index: number): string => `10.10.${index}.0/24`;
