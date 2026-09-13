/**
 * The network map's public API. The map renders a DiscoveredTopology: whoever owns the simulation
 * state calls `selectTopology(state)` from "@/sim" and passes the result in. Nothing here reads or
 * changes simulation state.
 */
export { TopologyGraph, type TopologyGraphProps } from "./components/topology-graph";
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
  nodeAccessibleName,
  nodeExplanation,
  NODE_STATES,
  STATE_EXPLANATION,
  STATE_LABEL,
  stateLine,
} from "./copy";
