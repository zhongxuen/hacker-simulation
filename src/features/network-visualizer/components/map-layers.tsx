import { memo, useMemo } from "react";
import { cx } from "@/lib/cx";
import type { DiscoveredTopology, TopologyNode } from "@/sim/types";
import {
  FIREWALL_EXPLANATION,
  interfaceExplanation,
  NEW_LABEL,
  nodeAccessibleName,
  nodeExplanation,
  ROUTE_EXPLANATION,
  stateLine,
  SUBNET_EXPLANATION,
  subnetLabel,
  YOU_ARE_HERE,
} from "../copy";
import {
  cardLabel,
  nodeKey,
  NODE_HEIGHT,
  NODE_WIDTH,
  type LayoutCluster,
  type LayoutInterface,
  type LayoutNode,
  type LayoutRoute,
  type TopologyLayout,
} from "../layout";
import { GLYPH_SIZE, NodeGlyph, STATE_TONE } from "./node-glyph";

/**
 * Moves that follow the layout (a host shifting down a row, a subnet shifting right) glide instead
 * of jumping. The duration scales with --motion-scale, so under reduced motion they snap.
 */
const GLIDE = "transition-transform fx-duration-slow ease-(--ease-standard)";

/** Pops and fades on SVG shapes scale around their own middle, not the map's corner. */
const OWN_ORIGIN = "origin-center [transform-box:fill-box]";

const translate = (x: number, y: number) => ({ transform: `translate(${x}px, ${y}px)` });

interface MapLayersProps {
  topology: DiscoveredTopology;
  layout: TopologyLayout;
  selectedHostId: string | undefined;
  /** The one card reachable with Tab; arrow keys reach the rest. */
  tabStopId: string | undefined;
  /** Keys (see layoutKeys) of everything that appeared since the last discovery. */
  fresh: ReadonlySet<string>;
  /**
   * Animate what's new into place. False when so much arrived at once that animating all of it
   * would cost frames (see MAX_POPPING_NODES); it then simply appears.
   */
  popEntrances: boolean;
  /** Label new cards "New!", for when motion is reduced and they can't pop in. */
  labelNew: boolean;
}

/**
 * Everything drawn on the map, in map coordinates: subnet boxes, then the lines between them,
 * then the host cards on top. Rendering only, and memoized, so panning and zooming (which only
 * change the transform around this) never re-render a card.
 */
export const MapLayers = memo(function MapLayers({
  topology,
  layout,
  selectedHostId,
  tabStopId,
  fresh,
  popEntrances,
  labelNew,
}: MapLayersProps) {
  /** Whether this thing is new *and* worth animating in. */
  const entering = (key: string) => popEntrances && fresh.has(key);

  const nodeById = useMemo(
    () => new Map(topology.nodes.map((node) => [node.hostId, node])),
    [topology.nodes],
  );
  const clusterByCidr = useMemo(
    () => new Map(layout.clusters.map((cluster) => [cluster.cidr, cluster])),
    [layout.clusters],
  );
  const placeById = useMemo(
    () => new Map(layout.nodes.map((place) => [place.hostId, place])),
    [layout.nodes],
  );

  return (
    <>
      <g aria-hidden="true">
        {layout.clusters.map((cluster) => (
          <SubnetBox
            key={cluster.cidr}
            cluster={cluster}
            isNew={entering(`subnet:${cluster.cidr}`)}
          />
        ))}
      </g>
      <g aria-hidden="true">
        {layout.links.map((link) =>
          link.kind === "route" ? (
            <RouteLine
              key={link.key}
              route={link}
              targetName={subnetLabel(clusterByCidr.get(link.to) ?? {})}
              isNew={entering(link.key)}
            />
          ) : (
            <InterfaceLine
              key={link.key}
              link={link}
              hostLabel={nodeById.get(link.hostId)?.label ?? link.hostId}
              subnetName={subnetLabel(clusterByCidr.get(link.subnet) ?? {})}
              isNew={entering(link.key)}
            />
          ),
        )}
      </g>
      {layout.clusters.map((cluster) => {
        if (cluster.hostIds.length === 0) return null;
        return (
          <g
            key={cluster.cidr}
            role="group"
            aria-label={subnetGroupLabel(cluster)}
            className={GLIDE}
            style={translate(cluster.x, cluster.y)}
          >
            {cluster.hostIds.map((hostId) => {
              const node = nodeById.get(hostId);
              const place = placeById.get(hostId);
              if (!node || !place) return null;
              const key = nodeKey(node.hostId);
              return (
                <HostCard
                  key={node.hostId}
                  node={node}
                  place={place}
                  selected={node.hostId === selectedHostId}
                  tabbable={node.hostId === tabStopId}
                  isNew={entering(key)}
                  labelNew={labelNew && fresh.has(key)}
                />
              );
            })}
          </g>
        );
      })}
    </>
  );
});

function subnetGroupLabel(cluster: LayoutCluster): string {
  const name =
    cluster.name === undefined
      ? `Network ${cluster.cidr}`
      : `${cluster.name} network, ${cluster.cidr}`;
  return cluster.containsSessionHost ? `${name}, your network` : name;
}

function SubnetBox({ cluster, isNew }: { cluster: LayoutCluster; isNew: boolean }) {
  return (
    <g className={GLIDE} style={translate(cluster.x, cluster.y)}>
      <g className={cx(isNew && "animate-fade-in", OWN_ORIGIN)}>
        <rect
          width={cluster.width}
          height={cluster.height}
          rx={16}
          strokeWidth={1.5}
          strokeDasharray="6 5"
          className="fill-surface-raised stroke-(--border-strong)"
        >
          <title>{SUBNET_EXPLANATION}</title>
        </rect>
        <text x={16} y={26} className="fill-current text-sm font-semibold text-primary">
          {subnetLabel(cluster)}
        </text>
        <text x={16} y={44} className="fill-current font-mono text-[11px] text-muted">
          {cluster.containsSessionHost ? `${cluster.cidr} · your network` : cluster.cidr}
        </text>
      </g>
    </g>
  );
}

function RouteLine({
  route,
  targetName,
  isNew,
}: {
  route: LayoutRoute;
  targetName: string;
  isNew: boolean;
}) {
  const { start, end, crossing } = route;
  return (
    <g className={cx(isNew && "animate-fade-in")}>
      <title>{`${ROUTE_EXPLANATION} (${targetName})`}</title>
      <path d={route.path} strokeWidth={2} className="fill-none stroke-(--border-strong)" />
      <circle cx={start.x} cy={start.y} r={3.5} className="fill-(--border-strong)" />
      <circle cx={end.x} cy={end.y} r={3.5} className="fill-(--border-strong)" />
      {/* The firewall, where the line crosses into the other network. */}
      <g transform={`translate(${crossing.x - 7} ${crossing.y - 7})`}>
        <title>{FIREWALL_EXPLANATION}</title>
        <rect
          width={14}
          height={14}
          rx={3}
          strokeWidth={1.5}
          className="fill-surface-base stroke-(--text-secondary)"
        />
        <path
          d="M3 5.5h8M3 8.5h8M6 2.5v3M8.5 5.5v3M5 8.5v3"
          strokeWidth={1.2}
          className="fill-none stroke-(--text-secondary)"
        />
      </g>
    </g>
  );
}

function InterfaceLine({
  link,
  hostLabel,
  subnetName,
  isNew,
}: {
  link: LayoutInterface;
  hostLabel: string;
  subnetName: string;
  isNew: boolean;
}) {
  // Positioned by a transform, so it glides along with its host card when that shifts a row.
  return (
    <g className={GLIDE} style={translate(0, link.y)}>
      <g className={cx(isNew && "animate-fade-in")}>
        <title>{interfaceExplanation(hostLabel, subnetName)}</title>
        <path
          d={`M${link.x1} 0H${link.x2}`}
          strokeWidth={2}
          className="fill-none stroke-(--text-muted)"
        />
        <circle
          cx={link.x2}
          cy={0}
          r={4}
          strokeWidth={2}
          className="fill-surface-base stroke-(--text-muted)"
        />
      </g>
    </g>
  );
}

interface HostCardProps {
  node: TopologyNode;
  place: LayoutNode;
  selected: boolean;
  tabbable: boolean;
  isNew: boolean;
  labelNew: boolean;
}

/**
 * One host: its state's shape, its name, its address, and its state in words. A button, so the
 * learner can select it with a click, a tap, Enter or Space (handled by the map, which listens for
 * all its cards at once). The focus ring is drawn as its own shape, because SVG has no outline
 * that browsers draw reliably. Memoized, so moving focus re-renders only the two cards involved.
 */
const HostCard = memo(function HostCard({
  node,
  place,
  selected,
  tabbable,
  isNew,
  labelNew,
}: HostCardProps) {
  const extraIps = node.ips.length - 1;
  return (
    <g
      data-host-id={node.hostId}
      role="button"
      tabIndex={tabbable ? 0 : -1}
      aria-label={nodeAccessibleName(node)}
      aria-current={selected ? "true" : undefined}
      className={cx("group cursor-pointer outline-none", GLIDE)}
      style={translate(place.dx, place.dy)}
    >
      <title>{nodeExplanation(node)}</title>
      <g className={cx(isNew && "animate-pop", OWN_ORIGIN)}>
        <rect
          x={-5}
          y={-5}
          width={NODE_WIDTH + 10}
          height={NODE_HEIGHT + 10}
          rx={14}
          strokeWidth={2}
          className="fill-none stroke-focus-ring opacity-0 group-focus-visible:opacity-100"
        />
        <rect
          width={NODE_WIDTH}
          height={NODE_HEIGHT}
          rx={10}
          strokeWidth={selected ? 2 : 1}
          className={cx(
            "transition-colors",
            selected
              ? "fill-accent-subtle stroke-accent"
              : "fill-surface-overlay stroke-(--border-subtle) group-hover:stroke-(--border-strong)",
          )}
        />
        <NodeGlyph state={node.state} x={10} y={(NODE_HEIGHT - GLYPH_SIZE) / 2} />
        <text x={56} y={22} className="fill-current text-[13px] font-semibold text-primary">
          {cardLabel(node)}
        </text>
        <text x={56} y={38} className="fill-current font-mono text-[11px] text-secondary">
          {extraIps > 0 ? `${node.ips[0]} +${extraIps}` : node.ips[0]}
        </text>
        <text
          x={56}
          y={53}
          className={cx("fill-current text-[11px] font-medium", STATE_TONE[node.state])}
        >
          {stateLine(node)}
        </text>
        {node.isSessionHost && (
          <Pill x={NODE_WIDTH - 96} width={88} className="fill-status-success">
            {YOU_ARE_HERE}
          </Pill>
        )}
        {labelNew && (
          <Pill x={12} width={44} className="fill-accent">
            {NEW_LABEL}
          </Pill>
        )}
      </g>
    </g>
  );
});

/** A small label sitting on a card's top edge. Its text uses --surface-base, audited on solid fills. */
function Pill({
  x,
  width,
  className,
  children,
}: {
  x: number;
  width: number;
  className: string;
  children: string;
}) {
  return (
    <g transform={`translate(${x} -10)`}>
      <rect width={width} height={20} rx={10} className={className} />
      <text
        x={width / 2}
        y={14}
        textAnchor="middle"
        className="fill-current text-[11px] font-semibold text-surface-base"
      >
        {children}
      </text>
    </g>
  );
}
