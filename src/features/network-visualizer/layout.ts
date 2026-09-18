/**
 * Where everything on the network map goes. Pure and deterministic: the same topology always gives
 * the same layout, so the map never jitters or reshuffles when it re-renders.
 *
 * The layout is a row of columns, one per subnet (sorted by address, as the selector returns them),
 * with that subnet's hosts stacked top to bottom in address order. Every column has the same
 * height (the tallest one's), so a column growing never moves anything else. The result: when a new
 * host appears, the only things that move are the hosts after it in its own subnet (one row down).
 * A new subnet with a lower address than an existing one shifts the columns after it to the right.
 * The renderer animates both, so nothing jumps.
 *
 * No force-directed layout and no graph library: force layouts move every node on every change,
 * which is disorienting on a map that's meant to fill in steadily (md-files/07-network-visualizer.md,
 * "Rendering approach").
 */
import type { DiscoveredTopology, TopologyNode } from "@/sim/types";

/** A host card. */
export const NODE_WIDTH = 208;
export const NODE_HEIGHT = 60;
/** Space between cards in a column, with room for the pills that sit on a card's top edge. */
const ROW_GAP = 20;
const ROW = NODE_HEIGHT + ROW_GAP;

/** Room at the top of a subnet for its name and address range. */
export const CLUSTER_HEADER = 60;
const CLUSTER_PADDING_X = 16;
const CLUSTER_PADDING_BOTTOM = 16;
export const CLUSTER_WIDTH = NODE_WIDTH + CLUSTER_PADDING_X * 2;
/** Wide enough for links between subnets to read as lines, not ticks. */
const CLUSTER_GAP = 88;

/** Space around the whole map. */
const MARGIN = 24;
/** Above the subnets: where route lines run between them. */
const ROUTE_SPACE = 40;
const CLUSTER_TOP = MARGIN + ROUTE_SPACE;
const ROUTE_BUS_Y = MARGIN + ROUTE_SPACE / 2;
/** Routes leave and enter a subnet this far in from its right edge, clear of its name. */
const ROUTE_INSET = 28;
/** How far a route reaches into a subnet below its top edge. */
const ROUTE_REACH = 18;

export interface LayoutCluster {
  readonly cidr: string;
  /** The scenario's name for the subnet, when it has one. */
  readonly name?: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly containsSessionHost: boolean;
  /** Placed hosts, top to bottom. */
  readonly hostIds: readonly string[];
}

export interface LayoutNode {
  readonly hostId: string;
  /** The subnet it's placed in. */
  readonly cidr: string;
  /** Its row in that subnet, from 0. */
  readonly row: number;
  /** Top-left corner of its card, relative to its subnet's top-left corner. */
  readonly dx: number;
  readonly dy: number;
  /** Top-left corner of its card, on the whole map. */
  readonly x: number;
  readonly y: number;
}

/** A line from one subnet to another, drawn above them, crossing both dashed edges. */
export interface LayoutRoute {
  readonly kind: "route";
  readonly key: string;
  readonly from: string;
  readonly to: string;
  /** SVG path data, on the whole map. */
  readonly path: string;
  readonly start: Point;
  readonly end: Point;
  /** Where the line crosses into the target subnet: the firewall between the two. */
  readonly crossing: Point;
}

/** A horizontal line from a host card to the edge of another subnet it has an address in. */
export interface LayoutInterface {
  readonly kind: "interface";
  readonly key: string;
  readonly hostId: string;
  readonly subnet: string;
  /** Height on the map: the middle of the host's card. */
  readonly y: number;
  /** From the card's edge... */
  readonly x1: number;
  /** ...to the other subnet's edge, where a dot marks the address. */
  readonly x2: number;
}

export type LayoutLink = LayoutRoute | LayoutInterface;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface TopologyLayout {
  /** The whole map's size. Zero when there's nothing on it. */
  readonly width: number;
  readonly height: number;
  readonly clusters: readonly LayoutCluster[];
  /** In layout order: subnet by subnet, top to bottom. Keyboard focus follows this order. */
  readonly nodes: readonly LayoutNode[];
  readonly links: readonly LayoutLink[];
}

/** Lays out a topology. Identical input gives identical output. */
export function layoutTopology(topology: DiscoveredTopology): TopologyLayout {
  const rows = Math.max(1, ...topology.subnets.map((subnet) => subnet.hostIds.length));
  const clusterHeight = CLUSTER_HEADER + rows * ROW - ROW_GAP + CLUSTER_PADDING_BOTTOM;

  const clusters = topology.subnets.map((subnet, index): LayoutCluster => ({
    cidr: subnet.cidr,
    ...(subnet.name !== undefined && { name: subnet.name }),
    x: MARGIN + index * (CLUSTER_WIDTH + CLUSTER_GAP),
    y: CLUSTER_TOP,
    width: CLUSTER_WIDTH,
    height: clusterHeight,
    containsSessionHost: subnet.containsSessionHost,
    hostIds: subnet.hostIds,
  }));
  const clusterByCidr = new Map(clusters.map((cluster) => [cluster.cidr, cluster]));

  const nodes = clusters.flatMap((cluster) =>
    cluster.hostIds.map((hostId, row): LayoutNode => {
      const dx = CLUSTER_PADDING_X;
      const dy = CLUSTER_HEADER + row * ROW;
      return { hostId, cidr: cluster.cidr, row, dx, dy, x: cluster.x + dx, y: cluster.y + dy };
    }),
  );
  const nodeById = new Map(nodes.map((node) => [node.hostId, node]));

  const links: LayoutLink[] = [];
  for (const link of topology.links) {
    if (link.kind === "route") {
      const from = clusterByCidr.get(link.from);
      const to = clusterByCidr.get(link.to);
      if (!from || !to) continue;
      const start = { x: from.x + from.width - ROUTE_INSET, y: from.y + ROUTE_REACH };
      const end = { x: to.x + to.width - ROUTE_INSET, y: to.y + ROUTE_REACH };
      links.push({
        kind: "route",
        key: `route:${link.from}>${link.to}`,
        from: link.from,
        to: link.to,
        path: `M${start.x} ${start.y}V${ROUTE_BUS_Y}H${end.x}V${end.y}`,
        start,
        end,
        crossing: { x: end.x, y: to.y },
      });
    } else {
      const node = nodeById.get(link.hostId);
      const home = node && clusterByCidr.get(node.cidr);
      const target = clusterByCidr.get(link.subnet);
      if (!node || !home || !target || target === home) continue;
      const rightward = target.x > home.x;
      links.push({
        kind: "interface",
        key: `interface:${link.hostId}>${link.subnet}`,
        hostId: link.hostId,
        subnet: link.subnet,
        y: node.y + NODE_HEIGHT / 2,
        x1: rightward ? node.x + NODE_WIDTH : node.x,
        x2: rightward ? target.x : target.x + target.width,
      });
    }
  }

  const width = clusters.length
    ? MARGIN * 2 + clusters.length * CLUSTER_WIDTH + (clusters.length - 1) * CLUSTER_GAP
    : 0;
  const height = clusters.length ? CLUSTER_TOP + clusterHeight + MARGIN : 0;
  return { width, height, clusters, nodes, links };
}

export type FocusMove = "up" | "down" | "left" | "right" | "first" | "last";

/**
 * Which node keyboard focus moves to from `hostId`. Up and down walk the layout order, running on
 * into the next or previous subnet, so pressing one key reaches every node. Left and right jump to
 * the nearest row of the next subnet over that has hosts. Undefined when there's nowhere to go.
 */
export function nextFocus(
  layout: TopologyLayout,
  hostId: string | undefined,
  move: FocusMove,
): string | undefined {
  const { nodes } = layout;
  if (nodes.length === 0) return undefined;
  if (move === "first") return nodes[0]?.hostId;
  if (move === "last") return nodes[nodes.length - 1]?.hostId;
  const index = nodes.findIndex((node) => node.hostId === hostId);
  const current = nodes[index];
  if (!current) return nodes[0]?.hostId;
  if (move === "up") return nodes[index - 1]?.hostId;
  if (move === "down") return nodes[index + 1]?.hostId;

  const clusters = layout.clusters.filter((cluster) => cluster.hostIds.length > 0);
  const here = clusters.findIndex((cluster) => cluster.cidr === current.cidr);
  const next = clusters[here + (move === "right" ? 1 : -1)];
  if (!next) return undefined;
  return next.hostIds[Math.min(current.row, next.hostIds.length - 1)];
}

/** Every node, subnet and link by a stable key, for spotting what's new since the last render. */
export function layoutKeys(layout: TopologyLayout): Set<string> {
  return new Set([
    ...layout.nodes.map((node) => nodeKey(node.hostId)),
    ...layout.clusters.map((cluster) => `subnet:${cluster.cidr}`),
    ...layout.links.map((link) => link.key),
  ]);
}

/** Host keys are told apart from subnet and link keys by this prefix. */
export const NODE_KEY_PREFIX = "node:";

export const nodeKey = (hostId: string): string => `${NODE_KEY_PREFIX}${hostId}`;

/** The map's name for a host's card: shortened so it fits. */
export function cardLabel(node: Pick<TopologyNode, "label">, max = 20): string {
  return node.label.length > max ? `${node.label.slice(0, max - 1)}…` : node.label;
}
