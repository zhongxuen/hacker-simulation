/**
 * What a screen reader hears when the map fills in (md-files/07-network-visualizer.md,
 * "Accessibility"): "New computer found: pos-01, 10.40.1.10." Worked out by comparing the map
 * before and after a command, so it only ever names what the learner has discovered.
 */
import type { DiscoveredTopology, TopologyNode } from "@/sim/types";

/** More names than this in one announcement are summed up as "and 3 more". */
const MAX_NAMED = 5;

/** "pos-01, 10.40.1.10", or the address alone while the name isn't known. */
const nameOf = (node: TopologyNode): string =>
  node.ips[0] === undefined || node.label === node.ips[0]
    ? node.label
    : `${node.label}, ${node.ips[0]}`;

function list(names: readonly string[]): string {
  const shown = names.slice(0, MAX_NAMED);
  const more = names.length - shown.length;
  return more > 0 ? `${shown.join("; ")}; and ${more} more` : shown.join("; ");
}

export interface DiscoveryChange {
  /** Hosts that weren't on the map before. */
  readonly newHosts: readonly TopologyNode[];
  /** Hosts known from the briefing that have now answered. */
  readonly answered: readonly TopologyNode[];
  /** Open ports seen for the first time, with the host they're on. */
  readonly newServices: readonly {
    readonly node: TopologyNode;
    readonly port: number;
    readonly name: string;
  }[];
}

/** What changed on the map between two renders. The learner's own computer never counts. */
export function discoveryChange(
  previous: DiscoveredTopology,
  next: DiscoveredTopology,
): DiscoveryChange {
  const before = new Map(previous.nodes.map((node) => [node.hostId, node]));
  const newHosts: TopologyNode[] = [];
  const answered: TopologyNode[] = [];
  const newServices: { node: TopologyNode; port: number; name: string }[] = [];
  for (const node of next.nodes) {
    if (node.isSessionHost) continue;
    const old = before.get(node.hostId);
    if (!old) newHosts.push(node);
    else if (old.state === "unknown" && node.state !== "unknown") answered.push(node);
    const seen = new Set(old?.services.map((service) => `${service.port}/${service.protocol}`));
    for (const service of node.services) {
      if (!seen.has(`${service.port}/${service.protocol}`)) {
        newServices.push({ node, port: service.port, name: service.name });
      }
    }
  }
  return { newHosts, answered, newServices };
}

/** The sentence to announce for a change, or "" when nothing new was found. */
export function discoveryAnnouncement(change: DiscoveryChange): string {
  const parts: string[] = [];
  const found = change.newHosts.filter((node) => node.state !== "unknown");
  if (found.length === 1 && found[0]) parts.push(`New computer found: ${nameOf(found[0])}.`);
  else if (found.length > 1) {
    parts.push(`${found.length} new computers found: ${list(found.map(nameOf))}.`);
  }
  for (const node of change.answered) parts.push(`${nameOf(node)} answered: it's switched on.`);
  const ports = change.newServices;
  if (ports.length === 1 && ports[0]) {
    parts.push(`New open port on ${ports[0].node.label}: ${ports[0].port}, ${ports[0].name}.`);
  } else if (ports.length > 1) {
    const hosts = new Set(ports.map((port) => port.node.hostId)).size;
    parts.push(
      hosts === 1 && ports[0]
        ? `${ports.length} new open ports on ${ports[0].node.label}: ${list(ports.map((port) => `${port.port}, ${port.name}`))}.`
        : `${ports.length} new open ports found on ${hosts} computers.`,
    );
  }
  return parts.join(" ");
}
