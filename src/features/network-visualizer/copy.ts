/**
 * The map's words: state labels, card text, accessible names, and plain-language explanations
 * (md-files/voice-and-tone.md). Kept apart from the component so the table view (07.4) can say
 * exactly the same things.
 */
import type { TopologyNode, TopologyNodeState } from "@/sim/types";

/** In the order a host moves through them. */
export const NODE_STATES: readonly TopologyNodeState[] = [
  "unknown",
  "detected",
  "enumerated",
  "accessed",
];

/** Short labels, shown on every card next to the state's shape, so colour never works alone. */
export const STATE_LABEL: Readonly<Record<TopologyNodeState, string>> = {
  unknown: "Heard of",
  detected: "Found",
  enumerated: "Scanned",
  accessed: "Accessed",
};

/** One line each, for the map key. */
export const STATE_SUMMARY: Readonly<Record<TopologyNodeState, string>> = {
  unknown: "You know it exists, but it hasn't answered you yet.",
  detected: "It answered, so you know it's switched on.",
  enumerated: "You checked its ports, so you know what it runs.",
  accessed: "You can type commands on it.",
};

/** What each state means, for a beginner hovering over or focusing a card. */
export const STATE_EXPLANATION: Readonly<Record<TopologyNodeState, string>> = {
  unknown:
    "Heard of: you know this computer exists, but it hasn't answered any of your tools yet. Scan its address to see if it's switched on.",
  detected:
    "Found: this computer answered your scan, so you know it's switched on and you can reach it. Check its ports (numbered doors into a computer) to see what it runs.",
  enumerated:
    "Scanned: you checked this computer's ports (numbered doors into a computer), so you know which services, the programs answering at those doors, it runs.",
  accessed:
    "Accessed: you have a session on this computer, which means you can type commands on it.",
};

export const YOU_ARE_HERE = "You are here";

export const YOU_ARE_HERE_EXPLANATION =
  "This is your own computer. Every scan you run starts from here.";

export const NEW_LABEL = "New!";

export const SUBNET_EXPLANATION =
  "A network (also called a subnet): a group of computers whose addresses start the same way. The dashed line is its edge. Traffic between two networks passes through a firewall, a set of rules about who may talk to whom.";

export const ROUTE_EXPLANATION =
  "Your computer reached this network. The traffic crossed from one network into another, through the firewall between them.";

export const FIREWALL_EXPLANATION =
  "A firewall sits where two networks meet. It decides which traffic may pass, so some computers here may never answer you.";

export const EMPTY_TITLE = "Your network map is still dark";

export const EMPTY_DESCRIPTION =
  "It lights up as you discover computers. Every computer you find appears here, grouped by the network it's on.";

export const KEYBOARD_HELP =
  "On the map, arrow keys move between computers and Enter opens one's details. Plus and minus zoom, 0 fits the whole map, and Shift with an arrow key scrolls it.";

/**
 * "3 computers found · keep scanning to find more". Only ever what's been found: a count of what's
 * left would leak ground truth (md-files/07-network-visualizer.md, "Show what's left to find").
 */
export function foundSoFar(found: number): string {
  return `${found === 1 ? "1 computer" : `${found} computers`} found · keep scanning to find more`;
}

/** The mentor's one-time line when the learner finds their first host in a mission. */
export const FIRST_DISCOVERY_LINE =
  "That's your first host, a computer that answered you on the network! Every device on a network has an address, like a house on a street.";

/** The short "Host found!" pop in the map's header, after a scan finds something new. */
export const HOST_FOUND = "Host found!";

/** How the learner first learned about a host, when no command revealed it. */
export const VIA_EXPLANATION: Readonly<Record<string, string>> = {
  session: "This is your own computer: it's where you're typing.",
  briefing: "You knew about it from the briefing, before it answered any of your tools.",
};

export const NOTES_HELP = "Only kept while this mission is open. Nothing is saved.";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** "Found", "Scanned · 2 services", "Scanned · no open ports". */
export function stateLine(node: Pick<TopologyNode, "state" | "services">): string {
  const label = STATE_LABEL[node.state];
  const count = node.services.length;
  if (node.state === "enumerated") {
    return `${label} · ${count ? plural(count, "service") : "no open ports"}`;
  }
  if (node.state === "accessed" && count > 0) return `${label} · ${plural(count, "service")}`;
  return label;
}

/** "web-01, 10.0.1.20, Scanned, 2 services found": everything the card shows, in words. */
export function nodeAccessibleName(
  node: Pick<TopologyNode, "label" | "ips" | "state" | "services" | "isSessionHost">,
): string {
  const parts = [node.label, ...node.ips, STATE_LABEL[node.state]];
  const count = node.services.length;
  if (node.state === "enumerated" || (node.state === "accessed" && count > 0)) {
    parts.push(count ? `${plural(count, "service")} found` : "no open ports found");
  }
  if (node.isSessionHost) parts.push(YOU_ARE_HERE.toLowerCase());
  return parts.join(", ");
}

/** The hover and focus explanation for a card. */
export function nodeExplanation(node: Pick<TopologyNode, "state" | "isSessionHost">): string {
  const state = STATE_EXPLANATION[node.state];
  return node.isSessionHost ? `${YOU_ARE_HERE}: ${YOU_ARE_HERE_EXPLANATION} ${state}` : state;
}

/** A subnet's display name: its scenario name, or a plain stand-in. */
export const subnetLabel = (subnet: { readonly name?: string }): string => subnet.name ?? "Network";

export function interfaceExplanation(hostLabel: string, subnetName: string): string {
  return `${hostLabel} also has an address in the ${subnetName} network. A computer like this sits on two networks at once, and can pass traffic between them.`;
}
