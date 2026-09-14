/**
 * Exporting the map for a learner's notes (md-files/07-network-visualizer.md, prompt 07.5): the
 * discovered topology as JSON, and the drawing as a standalone SVG the browser turns into a PNG.
 * Both are stamped "SIMULATED - not a real network", so an export pasted into notes can never pass
 * for a scan of a real network.
 *
 * Pure: both build from the DiscoveredTopology alone (what the learner found, never ground truth),
 * and the SVG takes its colours as a palette read from the page's design tokens at export time
 * (export-client.ts), so no colour is written here.
 */
import type { DiscoveredTopology, TopologyNode, TopologyNodeState } from "@/sim/types";
import { stateLine, subnetLabel, YOU_ARE_HERE } from "./copy";
import { cardLabel, layoutTopology, NODE_HEIGHT, NODE_WIDTH } from "./layout";
import { hostRows, networkRows } from "./table";

export const SIMULATED_WATERMARK = "SIMULATED - not a real network";

const ABOUT =
  "Exported from Hacker Simulation, a practice app. Every computer, name and address here is made up, and nothing was scanned for real.";

// ---------------------------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------------------------

export interface ExportedService {
  readonly port: number;
  readonly protocol: string;
  readonly service: string;
  readonly product?: string;
  readonly version?: string;
  readonly banner?: string;
}

export interface ExportedComputer {
  readonly id: string;
  readonly name: string;
  readonly hostname?: string;
  readonly addresses: readonly string[];
  readonly networks: readonly string[];
  readonly state: TopologyNodeState;
  readonly stateLabel: string;
  readonly operatingSystem?: string;
  readonly services: readonly ExportedService[];
  readonly reachableFrom: string;
  readonly youAreHere: boolean;
}

export interface TopologyExport {
  readonly format: "hacker-simulation.network-map";
  readonly version: 1;
  readonly simulated: true;
  readonly notice: typeof SIMULATED_WATERMARK;
  readonly about: string;
  /** Where it came from: a mission or practice machine's name. */
  readonly source?: string;
  readonly exportedAt?: string;
  readonly networks: readonly {
    readonly range: string;
    readonly name: string;
    readonly yourNetwork: boolean;
    readonly reach: string;
    readonly computers: readonly string[];
  }[];
  readonly computers: readonly ExportedComputer[];
  readonly counts: { readonly computersFound: number; readonly openPorts: number };
}

export interface ExportMeta {
  readonly source?: string;
  /** An ISO timestamp. Left out of tests, so their output doesn't change. */
  readonly exportedAt?: string;
}

/** Everything on the map, in plain names, with the SIMULATED notice as a field. */
export function topologyExport(
  topology: DiscoveredTopology,
  meta: ExportMeta = {},
): TopologyExport {
  const rows = hostRows(topology);
  const labels = new Map(rows.map((row) => [row.hostId, row.label]));
  return {
    format: "hacker-simulation.network-map",
    version: 1,
    simulated: true,
    notice: SIMULATED_WATERMARK,
    about: ABOUT,
    ...(meta.source !== undefined && { source: meta.source }),
    ...(meta.exportedAt !== undefined && { exportedAt: meta.exportedAt }),
    networks: networkRows(topology).map((network) => ({
      range: network.cidr,
      name: network.name,
      yourNetwork: network.yourNetwork,
      reach: network.reach,
      computers: (
        topology.subnets.find((subnet) => subnet.cidr === network.cidr)?.hostIds ?? []
      ).map((id) => labels.get(id) ?? id),
    })),
    computers: rows.map((row) => ({
      id: row.hostId,
      name: row.label,
      ...(row.hostname !== undefined && { hostname: row.hostname }),
      addresses: row.ips,
      networks: row.subnets.map((subnet) => `${subnet.name} (${subnet.cidr})`),
      state: row.state,
      stateLabel: row.stateLabel,
      ...(topology.nodes.find((node) => node.hostId === row.hostId)?.osGuess !== undefined && {
        operatingSystem: row.os,
      }),
      services: row.services.map((service) => ({
        port: service.port,
        protocol: service.protocol,
        service: service.name,
        ...(service.product !== undefined && { product: service.product }),
        ...(service.version !== undefined && { version: service.version }),
        ...(service.banner !== undefined && { banner: service.banner }),
      })),
      reachableFrom: row.reachableFrom,
      youAreHere: row.isSessionHost,
    })),
    counts: { computersFound: topology.counts.found, openPorts: topology.counts.services },
  };
}

export function topologyExportJson(topology: DiscoveredTopology, meta: ExportMeta = {}): string {
  return `${JSON.stringify(topologyExport(topology, meta), null, 2)}\n`;
}

// ---------------------------------------------------------------------------------------------
// SVG
// ---------------------------------------------------------------------------------------------

/** The colours the drawing uses, read from the design tokens when the learner exports. */
export interface MapPalette {
  readonly background: string;
  readonly surface: string;
  readonly card: string;
  readonly border: string;
  readonly borderStrong: string;
  readonly text: string;
  readonly textSecondary: string;
  readonly textMuted: string;
  readonly accent: string;
  readonly info: string;
  readonly success: string;
}

/** Each state's colour, as on the live map (node-glyph.tsx). */
const STATE_COLOUR: Readonly<Record<TopologyNodeState, keyof MapPalette>> = {
  unknown: "textMuted",
  detected: "info",
  enumerated: "accent",
  accessed: "success",
};

const HEADER = 72;
const FOOTER = 44;
const MIN_WIDTH = 560;
const SANS = "ui-sans-serif, system-ui, sans-serif";
const MONO = "ui-monospace, monospace";

/** Text and attribute values, escaped for XML. */
export function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** The same shapes as NodeGlyph, 36 × 36, as SVG markup. */
function glyph(state: TopologyNodeState, colour: string, fill: string): string {
  const stroke = `fill="none" stroke="${colour}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  switch (state) {
    case "unknown":
      return `<circle cx="18" cy="18" r="15" stroke-dasharray="4 4" fill="${fill}" stroke="${colour}" stroke-width="2"/><path d="M14.5 14.5a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.2-1.5 2.3v.5" ${stroke}/><circle cx="18" cy="25" r="0.9" fill="${colour}"/>`;
    case "detected":
      return `<circle cx="18" cy="18" r="15" fill="${fill}" stroke="${colour}" stroke-width="2"/><circle cx="18" cy="18" r="8" fill="none" stroke="${colour}" stroke-width="1.5"/><circle cx="18" cy="18" r="3.5" fill="${colour}"/>`;
    case "enumerated":
      return `<path d="M18 3 31 10.5v15L18 33 5 25.5v-15Z" fill="${fill}" stroke="${colour}" stroke-width="2" stroke-linejoin="round"/><path d="M12.5 13.5h11M12.5 18h11M12.5 22.5h7" ${stroke}/>`;
    case "accessed":
      return `<rect x="3.5" y="6" width="29" height="24" rx="4" fill="${fill}" stroke="${colour}" stroke-width="2"/><path d="m10 14 4 4-4 4M17 22.5h8" ${stroke}/>`;
  }
}

function card(node: TopologyNode, x: number, y: number, palette: MapPalette): string {
  const tone = palette[STATE_COLOUR[node.state]];
  const extra = node.ips.length - 1;
  const address = extra > 0 ? `${node.ips[0] ?? ""} +${extra}` : (node.ips[0] ?? "");
  const pill = node.isSessionHost
    ? `<g transform="translate(${NODE_WIDTH - 96} -10)"><rect width="88" height="20" rx="10" fill="${palette.success}"/><text x="44" y="14" text-anchor="middle" font-family="${SANS}" font-size="11" font-weight="600" fill="${palette.background}">${xml(YOU_ARE_HERE)}</text></g>`
    : "";
  return [
    `<g transform="translate(${x} ${y})">`,
    `<rect width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="10" fill="${palette.card}" stroke="${palette.border}"/>`,
    `<g transform="translate(10 ${(NODE_HEIGHT - 36) / 2})">${glyph(node.state, tone, palette.background)}</g>`,
    `<text x="56" y="22" font-family="${SANS}" font-size="13" font-weight="600" fill="${palette.text}">${xml(cardLabel(node))}</text>`,
    `<text x="56" y="38" font-family="${MONO}" font-size="11" fill="${palette.textSecondary}">${xml(address)}</text>`,
    `<text x="56" y="53" font-family="${SANS}" font-size="11" font-weight="500" fill="${tone}">${xml(stateLine(node))}</text>`,
    pill,
    `</g>`,
  ].join("");
}

export interface MapSvg {
  readonly svg: string;
  readonly width: number;
  readonly height: number;
}

/**
 * The whole map, laid out exactly as on screen (layout.ts), as one standalone SVG with the
 * SIMULATED notice across the top, faintly across the middle, and a line about it at the bottom.
 */
export function topologyToSvg(
  topology: DiscoveredTopology,
  palette: MapPalette,
  title = "Network map",
): MapSvg {
  const layout = layoutTopology(topology);
  const mapWidth = Math.max(layout.width, 0);
  const mapHeight = layout.nodes.length > 0 ? layout.height : 96;
  const width = Math.max(MIN_WIDTH, mapWidth);
  const height = HEADER + mapHeight + FOOTER;
  const offsetX = (width - mapWidth) / 2;
  const nodeById = new Map(topology.nodes.map((node) => [node.hostId, node]));

  const clusters = layout.clusters.map(
    (cluster) =>
      `<g transform="translate(${cluster.x} ${cluster.y})"><rect width="${cluster.width}" height="${cluster.height}" rx="16" fill="${palette.surface}" stroke="${palette.borderStrong}" stroke-width="1.5" stroke-dasharray="6 5"/><text x="16" y="26" font-family="${SANS}" font-size="14" font-weight="600" fill="${palette.text}">${xml(subnetLabel(cluster))}</text><text x="16" y="44" font-family="${MONO}" font-size="11" fill="${palette.textMuted}">${xml(cluster.containsSessionHost ? `${cluster.cidr} · your network` : cluster.cidr)}</text></g>`,
  );
  const links = layout.links.map((link) =>
    link.kind === "route"
      ? `<path d="${link.path}" fill="none" stroke="${palette.borderStrong}" stroke-width="2"/><circle cx="${link.start.x}" cy="${link.start.y}" r="3.5" fill="${palette.borderStrong}"/><circle cx="${link.end.x}" cy="${link.end.y}" r="3.5" fill="${palette.borderStrong}"/><g transform="translate(${link.crossing.x - 7} ${link.crossing.y - 7})"><rect width="14" height="14" rx="3" fill="${palette.background}" stroke="${palette.textSecondary}" stroke-width="1.5"/><path d="M3 5.5h8M3 8.5h8M6 2.5v3M8.5 5.5v3M5 8.5v3" fill="none" stroke="${palette.textSecondary}" stroke-width="1.2"/></g>`
      : `<path d="M${link.x1} ${link.y}H${link.x2}" fill="none" stroke="${palette.textMuted}" stroke-width="2"/><circle cx="${link.x2}" cy="${link.y}" r="4" fill="${palette.background}" stroke="${palette.textMuted}" stroke-width="2"/>`,
  );
  const cards = layout.nodes.flatMap((place) => {
    const node = nodeById.get(place.hostId);
    return node ? [card(node, place.x, place.y, palette)] : [];
  });
  const empty =
    layout.nodes.length === 0
      ? `<text x="${width / 2}" y="${HEADER + 52}" text-anchor="middle" font-family="${SANS}" font-size="14" fill="${palette.textSecondary}">Nothing discovered yet.</text>`
      : "";

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<title>${xml(`${title}: ${SIMULATED_WATERMARK}`)}</title>`,
    `<rect width="${width}" height="${height}" fill="${palette.background}"/>`,
    `<text x="24" y="32" font-family="${SANS}" font-size="18" font-weight="600" fill="${palette.text}">${xml(title)}</text>`,
    `<text x="24" y="54" font-family="${SANS}" font-size="13" font-weight="700" letter-spacing="1" fill="${palette.accent}">${xml(SIMULATED_WATERMARK.toUpperCase())}</text>`,
    `<g transform="translate(${offsetX} ${HEADER})">${clusters.join("")}${links.join("")}${cards.join("")}</g>`,
    empty,
    `<text x="${width / 2}" y="${HEADER + mapHeight / 2}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-18 ${width / 2} ${HEADER + mapHeight / 2})" font-family="${SANS}" font-size="${Math.min(72, Math.max(32, width / 12))}" font-weight="800" fill="${palette.text}" fill-opacity="0.07">SIMULATED</text>`,
    `<text x="24" y="${height - 18}" font-family="${SANS}" font-size="12" fill="${palette.textMuted}">${xml(ABOUT)}</text>`,
    `</svg>`,
  ].join("");

  return { svg, width, height };
}
