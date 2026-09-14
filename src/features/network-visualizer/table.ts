/**
 * The network map as rows and columns (md-files/07-network-visualizer.md, "Accessibility" and
 * prompt 07.4). The table view isn't a consolation prize: every row carries everything the
 * drawing shows about a host, and the networks list carries everything the drawing shows about
 * networks and the lines between them. Pure, so it's tested without a browser.
 *
 * What the drawing shows, and where the table says it:
 *
 * | In the drawing                         | In the table                                         |
 * |----------------------------------------|------------------------------------------------------|
 * | A card per host, its name              | Host column                                          |
 * | Its address, "+1" for more             | IP column, every address listed                      |
 * | The dashed box it sits in              | Subnet column (name and range); Networks list        |
 * | State shape, colour and word           | State column: the same shape and word                |
 * | "Scanned · 2 services"                 | Services column, every service with its details      |
 * | "You are here" pill                    | Host column label; Reachable from "This is you"      |
 * | Line between networks, firewall marker | Reachable from column; Networks list "Reached"       |
 * | Line with a dot (second address)       | IP and Subnet columns list both networks             |
 * | "New!" label and pop                   | "New" tag on the row                                 |
 * | Selected card                          | Selected row                                         |
 * | Hover and focus explanations           | State column explanation, Networks list explanations |
 */
import type {
  DiscoveredService,
  DiscoveredTopology,
  TopologyNode,
  TopologyNodeState,
} from "@/sim/types";
import { NODE_STATES, STATE_LABEL, subnetLabel } from "./copy";

export interface SubnetCell {
  readonly cidr: string;
  readonly name: string;
}

export interface HostRow {
  readonly hostId: string;
  readonly label: string;
  readonly hostname?: string;
  readonly ips: readonly string[];
  readonly subnets: readonly SubnetCell[];
  readonly state: TopologyNodeState;
  readonly stateLabel: string;
  readonly os: string;
  readonly services: readonly DiscoveredService[];
  readonly servicesText: string;
  readonly reachableFrom: string;
  readonly isSessionHost: boolean;
}

export const NOT_KNOWN_YET = "Not known yet";

/** "22/tcp ssh (sshd 8.9)". */
export function serviceText(service: DiscoveredService): string {
  const product = [service.product, service.version].filter(Boolean).join(" ");
  return `${service.port}/${service.protocol} ${service.name}${product ? ` (${product})` : ""}`;
}

/** Every service, or what's known when there are none. */
export function servicesText(node: Pick<TopologyNode, "state" | "services">): string {
  if (node.services.length > 0) return node.services.map(serviceText).join(", ");
  if (node.state === "enumerated" || node.state === "accessed") return "No open ports found";
  return "Not checked yet";
}

/** What the drawing's lines say about reaching a host, in words. Never a firewall rule. */
export function reachableFromText(node: TopologyNode, topology: DiscoveredTopology): string {
  if (node.isSessionHost) return "This is your computer";
  if (node.state === "unknown") return "Not seen answering yet";
  const session = topology.nodes.find((candidate) => candidate.isSessionHost);
  const you = session ? `Your computer (${session.label})` : "Your computer";
  const shared = session?.subnets.some((cidr) => node.subnets.includes(cidr)) ?? false;
  return shared
    ? `${you}, on the same network`
    : `${you}, through the firewall between the networks`;
}

export function hostRows(topology: DiscoveredTopology): HostRow[] {
  const names = new Map(topology.subnets.map((subnet) => [subnet.cidr, subnetLabel(subnet)]));
  return topology.nodes.map((node) => ({
    hostId: node.hostId,
    label: node.label,
    ...(node.hostname !== undefined && { hostname: node.hostname }),
    ips: node.ips,
    subnets: node.subnets.map((cidr) => ({ cidr, name: names.get(cidr) ?? "Network" })),
    state: node.state,
    stateLabel: STATE_LABEL[node.state],
    os: node.osGuess ?? NOT_KNOWN_YET,
    services: node.services,
    servicesText: servicesText(node),
    reachableFrom: reachableFromText(node, topology),
    isSessionHost: node.isSessionHost,
  }));
}

export const SORT_KEYS = ["host", "ip", "subnet", "state", "os", "services"] as const;

export type SortKey = (typeof SORT_KEYS)[number];

export type SortDirection = "ascending" | "descending";

function ipNumber(ip: string | undefined): number {
  const parts = (ip ?? "").split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return Infinity;
  return parts.reduce((sum, part) => sum * 256 + part, 0);
}

/** Whether `ip` is inside `cidr` ("10.40.1.23" in "10.40.1.0/24"). */
function inRange(ip: string, cidr: string): boolean {
  const [base, bits] = cidr.split("/");
  const prefix = Number(bits);
  const address = ipNumber(ip);
  const network = ipNumber(base);
  if (!Number.isInteger(prefix) || !Number.isFinite(address) || !Number.isFinite(network)) {
    return false;
  }
  const size = 2 ** (32 - prefix);
  return Math.floor(address / size) === Math.floor(network / size);
}

/** Which of a host's networks an address of its belongs to. */
export function subnetOfIp(ip: string, subnets: readonly string[]): string | undefined {
  return subnets.find((cidr) => inRange(ip, cidr)) ?? subnets[0];
}

const text = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

const COMPARE: Readonly<Record<SortKey, (a: HostRow, b: HostRow) => number>> = {
  host: (a, b) => text(a.label, b.label),
  ip: (a, b) => ipNumber(a.ips[0]) - ipNumber(b.ips[0]),
  subnet: (a, b) => text(a.subnets[0]?.name ?? "", b.subnets[0]?.name ?? ""),
  state: (a, b) => NODE_STATES.indexOf(a.state) - NODE_STATES.indexOf(b.state),
  os: (a, b) => text(a.os, b.os),
  services: (a, b) => a.services.length - b.services.length,
};

/** Sorted by `key`, ties in address order (the drawing's order), so the result is stable. */
export function sortRows(
  rows: readonly HostRow[],
  key: SortKey,
  direction: SortDirection,
): HostRow[] {
  const sign = direction === "ascending" ? 1 : -1;
  return [...rows].sort(
    (a, b) => sign * COMPARE[key](a, b) || COMPARE.ip(a, b) || text(a.hostId, b.hostId),
  );
}

export interface RowFilter {
  /** Words to find in the host's name, addresses, network, operating system or services. */
  readonly text?: string;
  readonly state?: TopologyNodeState;
}

export function filterRows(rows: readonly HostRow[], filter: RowFilter): HostRow[] {
  const words = (filter.text ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((row) => {
    if (filter.state !== undefined && row.state !== filter.state) return false;
    if (words.length === 0) return true;
    const haystack = [
      row.label,
      row.hostname ?? "",
      ...row.ips,
      ...row.subnets.flatMap((subnet) => [subnet.name, subnet.cidr]),
      row.stateLabel,
      row.os,
      row.servicesText,
    ]
      .join(" ")
      .toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

export interface NetworkRow {
  readonly cidr: string;
  readonly name: string;
  /** Hosts the drawing places in this network. */
  readonly hosts: number;
  readonly yourNetwork: boolean;
  /** "Your network", "Reached from your network, through a firewall", or "Not reached yet". */
  readonly reach: string;
}

/** Every network on the map, with what its dashed box and the lines into it say. */
export function networkRows(topology: DiscoveredTopology): NetworkRow[] {
  const reached = new Set(
    topology.links.flatMap((link) => (link.kind === "route" ? [link.to] : [])),
  );
  return topology.subnets.map((subnet) => ({
    cidr: subnet.cidr,
    name: subnetLabel(subnet),
    hosts: subnet.hostIds.length,
    yourNetwork: subnet.containsSessionHost,
    reach: subnet.containsSessionHost
      ? "Your network"
      : reached.has(subnet.cidr)
        ? "Reached from your network, through a firewall"
        : "Not reached yet",
  }));
}
