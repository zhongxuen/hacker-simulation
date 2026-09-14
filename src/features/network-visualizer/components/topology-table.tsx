"use client";

import { useId, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { SearchIcon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";
import type { DiscoveredTopology, TopologyNodeState } from "@/sim/types";
import {
  EMPTY_DESCRIPTION,
  EMPTY_TITLE,
  NEW_LABEL,
  NODE_STATES,
  STATE_LABEL,
  STATE_SUMMARY,
  SUBNET_EXPLANATION,
  YOU_ARE_HERE,
} from "../copy";
import {
  filterRows,
  hostRows,
  networkRows,
  serviceText,
  sortRows,
  type SortDirection,
  type SortKey,
} from "../table";
import { GLYPH_SIZE, NodeGlyph, STATE_TONE } from "./node-glyph";

export interface TopologyTableProps {
  /** What the learner has discovered: `selectTopology(state)` from "@/sim". */
  topology: DiscoveredTopology;
  selectedHostId?: string;
  /** Called with a host id when the learner opens a host's details. */
  onSelectHost?: (hostId: string) => void;
  /** Hosts that appeared with the latest discovery: tagged "New!", like the drawing's label. */
  freshHostIds?: ReadonlySet<string>;
  className?: string;
}

const COLUMNS: readonly { key: SortKey | null; label: string }[] = [
  { key: "host", label: "Host" },
  { key: "ip", label: "IP" },
  { key: "subnet", label: "Subnet" },
  { key: "state", label: "State" },
  { key: "os", label: "OS" },
  { key: "services", label: "Services" },
  { key: null, label: "Reachable from" },
];

const CELL = "px-3 py-2.5 align-top";
const NONE: ReadonlySet<string> = new Set();

function StateGlyph({ state }: { state: TopologyNodeState }) {
  return (
    <svg
      viewBox={`0 0 ${GLYPH_SIZE} ${GLYPH_SIZE}`}
      className={cx("size-5 shrink-0", STATE_TONE[state])}
      aria-hidden="true"
      focusable="false"
    >
      <NodeGlyph state={state} />
    </svg>
  );
}

/**
 * The network map as a real table (md-files/07-network-visualizer.md, "Accessibility" and prompt
 * 07.4): every column the spec lists, sortable and filterable, with the same words, shapes and
 * facts as the drawing (the full list is in ../table.ts). A first-class view, not a fallback: a
 * learner can do everything here that the drawing lets them do, including opening a host's details.
 *
 * States are shown by shape and word, never by colour alone.
 */
export function TopologyTable({
  topology,
  selectedHostId,
  onSelectHost,
  freshHostIds = NONE,
  className,
}: TopologyTableProps) {
  const id = useId();
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "ip",
    direction: "ascending",
  });
  const [text, setText] = useState("");
  const [state, setState] = useState<TopologyNodeState | "all">("all");

  const rows = useMemo(() => hostRows(topology), [topology]);
  const shown = useMemo(
    () =>
      sortRows(
        filterRows(rows, { text, ...(state !== "all" && { state }) }),
        sort.key,
        sort.direction,
      ),
    [rows, text, state, sort],
  );
  const networks = useMemo(() => networkRows(topology), [topology]);

  if (rows.length === 0) {
    return (
      <div className={cx("rounded-lg border border-subtle bg-surface-base p-4", className)}>
        <EmptyState
          icon={<SearchIcon />}
          title={EMPTY_TITLE}
          description={EMPTY_DESCRIPTION}
          titleAs="h3"
        />
      </div>
    );
  }

  const sortBy = (key: SortKey) =>
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "ascending" ? "descending" : "ascending",
    }));

  return (
    <div className={cx("space-y-4", className)}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-find`} className="text-sm font-semibold text-secondary">
            Find a computer
          </label>
          <input
            id={`${id}-find`}
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="A name, address, network or service"
            autoComplete="off"
            spellCheck={false}
            className="mt-1 h-10 w-full rounded-md border border-strong bg-surface-base px-3 text-primary placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          />
        </div>
        <div>
          <label htmlFor={`${id}-state`} className="text-sm font-semibold text-secondary">
            Show
          </label>
          <select
            id={`${id}-state`}
            value={state}
            onChange={(event) => setState(event.target.value as TopologyNodeState | "all")}
            className="mt-1 block h-10 rounded-md border border-strong bg-surface-base px-3 text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <option value="all">Every state</option>
            {NODE_STATES.map((candidate) => (
              <option key={candidate} value={candidate}>
                {STATE_LABEL[candidate]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p aria-live="polite" className="text-sm text-muted">
        {shown.length === rows.length
          ? `${rows.length} ${rows.length === 1 ? "computer" : "computers"} on the map.`
          : `Showing ${shown.length} of ${rows.length} computers.`}
      </p>

      <div className="overflow-x-auto rounded-lg border border-subtle">
        <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
          <caption className="sr-only">
            Computers you&apos;ve found. Sorted by {COLUMNS.find((c) => c.key === sort.key)?.label},{" "}
            {sort.direction}. Open a computer&apos;s details with its button in the Host column.
          </caption>
          <thead className="bg-surface-overlay text-secondary">
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column.label}
                  scope="col"
                  aria-sort={
                    column.key !== null && column.key === sort.key ? sort.direction : undefined
                  }
                  className="px-3 py-2 font-semibold whitespace-nowrap"
                >
                  {column.key === null ? (
                    column.label
                  ) : (
                    <button
                      type="button"
                      onClick={() => sortBy(column.key as SortKey)}
                      className={cx(
                        "inline-flex items-center gap-1 rounded-sm hover:text-primary",
                        FOCUS_RING,
                      )}
                    >
                      {column.label}
                      <span aria-hidden="true" className="text-xs">
                        {column.key === sort.key
                          ? sort.direction === "ascending"
                            ? "▲"
                            : "▼"
                          : "↕"}
                      </span>
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => {
              const selected = row.hostId === selectedHostId;
              const fresh = freshHostIds.has(row.hostId);
              return (
                <tr
                  key={row.hostId}
                  aria-current={selected ? "true" : undefined}
                  className={cx(
                    "border-t border-subtle",
                    selected ? "bg-accent-subtle" : "hover:bg-surface-overlay",
                  )}
                >
                  <th scope="row" className={cx(CELL, "font-medium")}>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {onSelectHost ? (
                        <button
                          type="button"
                          onClick={() => onSelectHost(row.hostId)}
                          aria-label={`${row.label}: open details`}
                          className={cx(
                            "rounded-sm text-left font-semibold text-accent underline-offset-4 hover:underline",
                            FOCUS_RING,
                          )}
                        >
                          {row.label}
                        </button>
                      ) : (
                        <span className="font-semibold text-primary">{row.label}</span>
                      )}
                      {row.isSessionHost && (
                        <Badge tone="success" appearance="solid">
                          {YOU_ARE_HERE}
                        </Badge>
                      )}
                      {fresh && (
                        <Badge tone="accent" appearance="solid">
                          {NEW_LABEL}
                        </Badge>
                      )}
                    </span>
                    {row.hostname !== undefined && row.hostname !== row.label && (
                      <span className="mt-0.5 block font-mono text-xs font-normal text-muted">
                        {row.hostname}
                      </span>
                    )}
                  </th>
                  <td className={cx(CELL, "font-mono")}>
                    {row.ips.map((ip) => (
                      <span key={ip} className="block">
                        {ip}
                      </span>
                    ))}
                  </td>
                  <td className={CELL}>
                    {row.subnets.map((subnet) => (
                      <span key={subnet.cidr} className="block">
                        {subnet.name}{" "}
                        <span className="font-mono text-xs text-muted">{subnet.cidr}</span>
                      </span>
                    ))}
                  </td>
                  <td className={CELL}>
                    <span
                      className={cx("flex items-center gap-2 font-medium", STATE_TONE[row.state])}
                    >
                      <StateGlyph state={row.state} />
                      {row.stateLabel}
                    </span>
                  </td>
                  <td className={cx(CELL, "text-secondary")}>{row.os}</td>
                  <td className={cx(CELL, "text-secondary")}>
                    {row.services.length === 0 ? (
                      row.servicesText
                    ) : (
                      <ul className="space-y-0.5">
                        {row.services.map((service) => (
                          <li key={`${service.port}/${service.protocol}`}>
                            <span className="font-mono text-primary">{serviceText(service)}</span>
                            {service.banner !== undefined && (
                              <span className="block font-mono text-xs text-muted">
                                banner: {service.banner}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className={cx(CELL, "text-secondary")}>{row.reachableFrom}</td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr className="border-t border-subtle">
                <td colSpan={COLUMNS.length} className="px-3 py-6 text-center text-secondary">
                  No computer matches that. Clear the search, or pick &ldquo;Every state&rdquo;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby={`${id}-networks`}>
          <h3 id={`${id}-networks`} className="text-sm font-semibold">
            Networks on the map
          </h3>
          <p className="mt-1 text-sm leading-6 text-secondary">{SUBNET_EXPLANATION}</p>
          <div className="mt-2 overflow-x-auto rounded-lg border border-subtle">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-surface-overlay text-secondary">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Network
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Range
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Computers
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    From your computer
                  </th>
                </tr>
              </thead>
              <tbody>
                {networks.map((network) => (
                  <tr key={network.cidr} className="border-t border-subtle">
                    <th scope="row" className={cx(CELL, "font-medium text-primary")}>
                      {network.name}
                    </th>
                    <td className={cx(CELL, "font-mono")}>{network.cidr}</td>
                    <td className={CELL}>{network.hosts}</td>
                    <td className={cx(CELL, "text-secondary")}>{network.reach}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby={`${id}-states`}>
          <h3 id={`${id}-states`} className="text-sm font-semibold">
            What the states mean
          </h3>
          <ul className="mt-2 space-y-2 text-sm">
            {NODE_STATES.map((candidate) => (
              <li key={candidate} className="flex items-start gap-2 leading-5">
                <StateGlyph state={candidate} />
                <span>
                  <span className="font-semibold text-primary">{STATE_LABEL[candidate]}</span>{" "}
                  <span className="text-secondary">{STATE_SUMMARY[candidate]}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
