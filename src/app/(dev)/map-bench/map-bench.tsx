"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { TopologyGraph } from "@/features/network-visualizer";
import { benchTopology } from "./topology-fixture";

export interface MapBenchProps {
  readonly hosts: number;
  readonly shown: number;
}

/**
 * The network map with a made-up network on it, at whatever size the query string asks for. A
 * measuring rig for tests/e2e/network-map-performance.spec.ts, not a page anyone learns from.
 *
 * The map is given a fixed height so every measurement is taken at the same size, and the legend
 * is off so the only thing on screen is the drawing being measured. `data-bench-shown` carries how
 * many hosts are on the map, so the test can wait for a render rather than a timeout.
 */
export function MapBench({ hosts, shown }: MapBenchProps) {
  const [revealed, setRevealed] = useState(Math.min(hosts, shown));
  const topology = useMemo(() => benchTopology({ hosts, shown: revealed }), [hosts, revealed]);

  return (
    <div className="flex flex-col gap-4 p-6" data-bench-shown={topology.nodes.length}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-primary">Map bench</h1>
        <p className="text-sm text-secondary">
          {topology.nodes.length} of {hosts} made-up hosts. SIMULATED — not a real network.
        </p>
        <Button variant="secondary" size="sm" onClick={() => setRevealed(hosts)}>
          Reveal all
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setRevealed(Math.min(hosts, shown))}>
          Reset bench
        </Button>
      </div>
      <TopologyGraph
        topology={topology}
        showLegend={false}
        className="h-[600px] w-[1000px] max-w-full"
      />
    </div>
  );
}
