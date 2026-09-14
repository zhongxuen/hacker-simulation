/**
 * The network map's public API. The map renders a DiscoveredTopology: whoever owns the simulation
 * state calls `selectTopology(state)` from "@/sim" and passes the result in. Nothing here reads or
 * changes simulation state.
 */
export { NetworkMapPanel, type NetworkMapPanelProps } from "./components/network-map-panel";
export { TopologyGraph, type TopologyGraphProps } from "./components/topology-graph";
export { TopologyTable, type TopologyTableProps } from "./components/topology-table";
export { HostInspector, type HostInspectorProps } from "./components/host-inspector";
export { TopologyLegend } from "./components/topology-legend";
export {
  layoutTopology,
  nextFocus,
  type FocusMove,
  type LayoutCluster,
  type LayoutLink,
  type LayoutNode,
  type TopologyLayout,
} from "./layout";
export {
  FIRST_DISCOVERY_LINE,
  foundSoFar,
  nodeAccessibleName,
  nodeExplanation,
  NODE_STATES,
  STATE_EXPLANATION,
  STATE_LABEL,
  stateLine,
} from "./copy";
export { discoveryAnnouncement, discoveryChange, type DiscoveryChange } from "./announce";
export {
  discoveryLog,
  EMPTY_DISCOVERY_LOG,
  serviceLogKey,
  type DiscoveryLog,
  type Revealed,
} from "./discovery-log";
export {
  filterRows,
  hostRows,
  networkRows,
  reachableFromText,
  servicesText,
  sortRows,
  SORT_KEYS,
  type HostRow,
  type NetworkRow,
  type RowFilter,
  type SortDirection,
  type SortKey,
} from "./table";
export {
  SIMULATED_WATERMARK,
  topologyExport,
  topologyExportJson,
  topologyToSvg,
  type MapPalette,
  type MapSvg,
  type TopologyExport,
} from "./export";
