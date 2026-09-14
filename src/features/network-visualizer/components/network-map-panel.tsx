"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { MapIcon, TableIcon } from "@/components/ui/icons";
import { SimulatedBadge } from "@/components/ui/simulated-badge";
import { cx } from "@/lib/cx";
import { updateSettings, useSettings, type NetworkView } from "@/lib/settings";
import type { DiscoveredTopology, SimEvent } from "@/sim/types";
import { discoveryAnnouncement, discoveryChange } from "../announce";
import { foundSoFar, HOST_FOUND } from "../copy";
import { discoveryLog } from "../discovery-log";
import { topologyExportJson, topologyToSvg } from "../export";
import { fileStem, readMapPalette, saveFile, svgToPng } from "../export-client";
import { ExportMenu } from "./export-menu";
import { HostInspector } from "./host-inspector";
import { TopologyGraph } from "./topology-graph";
import { TopologyTable } from "./topology-table";

export interface NetworkMapPanelProps {
  /** What the learner has discovered: `selectTopology(state)` from "@/sim". */
  topology: DiscoveredTopology;
  /**
   * Every event since the run began, oldest first: the inspector reads which command revealed
   * each host and service from them. The map itself never reads anything but `topology`.
   */
  events: readonly SimEvent[];
  /** The learner's notes, by host id, kept in memory by whoever owns the run. */
  notes?: Readonly<Record<string, string>>;
  onNoteChange?: (hostId: string, text: string) => void;
  /** Shown above the map: the mentor's first-discovery line, say. */
  tip?: ReactNode;
  /** The panel's heading. */
  title?: string;
  /** What the map is of, for export file names and the JSON: a mission's or machine's name. */
  exportName?: string;
  className?: string;
}

/** How long "Host found!" and the table's "New!" tags stay. The drawing's own labels match it. */
const FRESH_MS = 5000;

const NONE: ReadonlySet<string> = new Set();

interface Seen {
  readonly topology: DiscoveredTopology;
  readonly announcement: string;
  /** Hosts that appeared with the latest discovery. */
  readonly fresh: ReadonlySet<string>;
}

const VIEWS: readonly { id: NetworkView; label: string; icon: ReactNode }[] = [
  { id: "graph", label: "Drawing", icon: <MapIcon /> },
  { id: "table", label: "Table", icon: <TableIcon /> },
];

/**
 * The network map panel (md-files/07-network-visualizer.md, prompts 07.3 to 07.5): the fog-of-war
 * drawing or the equally complete table (the learner's choice, saved as a setting), a details panel
 * for the host they pick, a "found so far" count that never says what's left, and Export.
 *
 * It updates live: whoever owns the simulation passes a new topology after every command. Each new
 * discovery gets its moment (the card pops in, "Host found!" shows in the header) and is announced
 * to screen readers: "New computer found: pos-01, 10.40.1.10."
 */
export function NetworkMapPanel({
  topology,
  events,
  notes,
  onNoteChange,
  tip,
  title = "Network map",
  exportName,
  className,
}: NetworkMapPanelProps) {
  const id = useId();
  const rootRef = useRef<HTMLElement>(null);
  const { networkView } = useSettings();
  const [selectedHostId, setSelectedHostId] = useState<string | undefined>();
  // Said to screen readers when details open or close; the details panel itself shows it.
  const [status, setStatus] = useState("");
  // Shown to everyone after an export.
  const [exportStatus, setExportStatus] = useState("");
  const log = useMemo(() => discoveryLog(events), [events]);

  // What changed since the last topology, worked out while rendering so the announcement and the
  // "New!" tags arrive with the change itself.
  const [seen, setSeen] = useState<Seen>({ topology, announcement: "", fresh: NONE });
  if (seen.topology !== topology) {
    const change = discoveryChange(seen.topology, topology);
    const text = discoveryAnnouncement(change);
    const fresh = change.newHosts.map((node) => node.hostId);
    setSeen({
      topology,
      // The live region only speaks when its text changes, so a repeat gets a trailing space.
      announcement:
        text === "" ? seen.announcement : text === seen.announcement ? `${text} ` : text,
      fresh: fresh.length > 0 ? new Set(fresh) : seen.fresh,
    });
  }

  useEffect(() => {
    const fresh = seen.fresh;
    if (fresh.size === 0) return;
    const timer = window.setTimeout(
      () => setSeen((current) => (current.fresh === fresh ? { ...current, fresh: NONE } : current)),
      FRESH_MS,
    );
    return () => window.clearTimeout(timer);
  }, [seen.fresh]);

  const selected = topology.nodes.find((node) => node.hostId === selectedHostId);
  const stem = fileStem(exportName ?? title);

  const savePicture = async () => {
    const palette = readMapPalette(rootRef.current ?? document.documentElement);
    const { svg, width, height } = topologyToSvg(topology, palette, exportName ?? title);
    try {
      saveFile(await svgToPng(svg, width, height), `${stem}.png`);
      setExportStatus("Saved a picture of your map. It's marked as simulated.");
    } catch {
      setExportStatus(
        "Your browser couldn't make the picture, and that's nothing you did. Try saving the data instead.",
      );
    }
  };

  const saveData = () => {
    const json = topologyExportJson(topology, {
      ...(exportName !== undefined && { source: exportName }),
      exportedAt: new Date().toISOString(),
    });
    saveFile(new Blob([json], { type: "application/json" }), `${stem}.json`);
    setExportStatus("Saved your map as data. It's marked as simulated.");
  };

  const select = (hostId: string) => {
    setSelectedHostId(hostId);
    const node = topology.nodes.find((candidate) => candidate.hostId === hostId);
    if (node) setStatus(`Showing the details for ${node.label}.`);
  };

  return (
    <section
      ref={rootRef}
      aria-labelledby={`${id}-title`}
      className={cx("@container rounded-xl border border-subtle bg-surface-raised", className)}
    >
      <header className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-subtle px-4 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 id={`${id}-title`} className="text-sm font-semibold tracking-wide">
            {title}
          </h2>
          <SimulatedBadge size="sm" side="bottom" align="start" />
          <span className="text-sm text-secondary">{foundSoFar(topology.counts.found)}</span>
          {seen.fresh.size > 0 && (
            <Badge tone="reward" appearance="solid" className="animate-pop">
              {HOST_FOUND}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <div
            role="group"
            aria-label="Show the map as"
            className="flex rounded-md border border-subtle p-0.5"
          >
            {VIEWS.map((view) => (
              <button
                key={view.id}
                type="button"
                aria-pressed={networkView === view.id}
                onClick={() => updateSettings({ networkView: view.id })}
                className={cx(
                  "inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-sm font-medium [&_svg]:size-4",
                  "text-secondary hover:text-primary aria-pressed:bg-accent-subtle aria-pressed:text-primary",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
                )}
              >
                {view.icon}
                {view.label}
              </button>
            ))}
          </div>
          <ExportMenu onPicture={savePicture} onData={saveData} />
        </div>
      </header>

      <div className="space-y-4 p-4">
        {tip}
        <div
          className={cx(
            "grid gap-4",
            selected && "@4xl:grid-cols-[minmax(0,1fr)_22rem] @4xl:items-start",
          )}
        >
          <div className="min-w-0">
            {networkView === "table" ? (
              <TopologyTable
                topology={topology}
                selectedHostId={selectedHostId}
                onSelectHost={select}
                freshHostIds={seen.fresh}
              />
            ) : (
              <TopologyGraph
                topology={topology}
                selectedHostId={selectedHostId}
                onSelectHost={select}
                className="h-[24rem]"
              />
            )}
          </div>
          {selected && (
            <HostInspector
              node={selected}
              topology={topology}
              log={log}
              {...(onNoteChange && {
                note: notes?.[selected.hostId] ?? "",
                onNoteChange: (text: string) => onNoteChange(selected.hostId, text),
              })}
              onClose={() => {
                setSelectedHostId(undefined);
                setStatus("Details closed.");
              }}
            />
          )}
        </div>
      </div>

      <p role="status" className="sr-only">
        {status}
      </p>
      <p role="status" className="px-4 pb-3 text-sm text-secondary empty:hidden">
        {exportStatus}
      </p>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {seen.announcement}
      </div>
    </section>
  );
}
