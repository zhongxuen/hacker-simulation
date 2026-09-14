"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { CloseIcon } from "@/components/ui/icons";
import { Term } from "@/features/learning";
import { cx } from "@/lib/cx";
import type { DiscoveredTopology, TopologyNode } from "@/sim/types";
import { nodeExplanation, NOTES_HELP, stateLine, subnetLabel, VIA_EXPLANATION } from "../copy";
import { serviceLogKey, type DiscoveryLog } from "../discovery-log";
import { NOT_KNOWN_YET, reachableFromText, subnetOfIp } from "../table";
import { GLYPH_SIZE, NodeGlyph, STATE_TONE } from "./node-glyph";

export interface HostInspectorProps {
  node: TopologyNode;
  topology: DiscoveredTopology;
  /** Which command revealed each host and service (discoveryLog over the run's events). */
  log: DiscoveryLog;
  /** The learner's notes on this host. Leave out, with onNoteChange, to hide the notes box. */
  note?: string;
  onNoteChange?: (text: string) => void;
  onClose: () => void;
  className?: string;
}

const DT = "text-sm font-semibold text-secondary";
const DD = "leading-6 text-primary";

/** "`netscan 10.40.1.0/24`", in code font, or how the host was known without a command. */
function FoundBy({ line, via }: { line?: string; via: string }) {
  if (line !== undefined) {
    return (
      <>
        Found by{" "}
        <code className="rounded-sm bg-surface-base px-1 font-mono text-[0.9em]">{line}</code>
      </>
    );
  }
  return <>{VIA_EXPLANATION[via] ?? `Found by ${via}.`}</>;
}

/**
 * Everything the learner knows about one host (md-files/07-network-visualizer.md, prompt 07.3):
 * its addresses and networks, its state in plain words, the operating system guess, every service
 * with its port, program and banner, which command revealed each, and the learner's own notes,
 * kept in memory for this mission only. It shows discovered facts and nothing else.
 */
export function HostInspector({
  node,
  topology,
  log,
  note,
  onNoteChange,
  onClose,
  className,
}: HostInspectorProps) {
  const id = useId();
  const names = new Map(topology.subnets.map((subnet) => [subnet.cidr, subnetLabel(subnet)]));
  const scanned = node.state === "enumerated" || node.state === "accessed";

  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cx("rounded-lg border border-subtle bg-surface-raised p-4", className)}
    >
      <header className="flex items-start gap-3">
        <svg
          viewBox={`0 0 ${GLYPH_SIZE} ${GLYPH_SIZE}`}
          className={cx("size-9 shrink-0", STATE_TONE[node.state])}
          aria-hidden="true"
          focusable="false"
        >
          <NodeGlyph state={node.state} />
        </svg>
        <div className="min-w-0 flex-1">
          <h3 id={`${id}-title`} className="truncate text-lg font-semibold">
            {node.label}
          </h3>
          <p className={cx("text-sm font-medium", STATE_TONE[node.state])}>{stateLine(node)}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          label="Close details"
          icon={<CloseIcon />}
          onClick={onClose}
        />
      </header>

      <p className="mt-3 text-sm leading-6 text-secondary">{nodeExplanation(node)}</p>

      <dl className="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-[max-content_1fr]">
        <dt className={DT}>Name</dt>
        <dd className={cx(DD, "font-mono text-sm")}>{node.hostname ?? NOT_KNOWN_YET}</dd>

        <dt className={DT}>
          <Term id="ip-address">Addresses</Term>
        </dt>
        <dd className={DD}>
          <ul className="space-y-0.5">
            {node.ips.map((ip) => {
              const cidr = subnetOfIp(ip, node.subnets);
              return (
                <li key={ip}>
                  <span className="font-mono text-sm">{ip}</span>{" "}
                  <span className="text-sm text-secondary">
                    on {names.get(cidr ?? "") ?? "a network"}
                    {cidr !== undefined && ` (${cidr})`}
                  </span>
                </li>
              );
            })}
          </ul>
        </dd>

        <dt className={DT}>Reachable from</dt>
        <dd className={DD}>{reachableFromText(node, topology)}</dd>

        <dt className={DT}>
          <Term id="operating-system">Operating system</Term>
        </dt>
        <dd className={DD}>
          {node.osGuess ?? (
            <span className="text-secondary">
              {NOT_KNOWN_YET}. {scanned ? "" : "A port scan can make a guess."}
            </span>
          )}
        </dd>

        <dt className={DT}>How you found it</dt>
        <dd className={cx(DD, "text-sm")}>
          <FoundBy line={log.hosts.get(node.hostId)?.line} via={node.via} />
        </dd>
      </dl>

      <h4 className="mt-5 text-sm font-semibold">
        Open <Term id="port">ports</Term> and the <Term id="service">services</Term> behind them
      </h4>
      {node.services.length === 0 ? (
        <p className="mt-1 text-sm leading-6 text-secondary">
          {scanned
            ? "None found. Every door you checked on this computer was closed."
            : "Not checked yet. Scan this computer's ports to see which doors are open."}
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {node.services.map((service) => {
            const revealed = log.services.get(
              serviceLogKey(node.hostId, service.port, service.protocol),
            );
            const program = [service.product, service.version].filter(Boolean).join(" ");
            return (
              <li
                key={`${service.port}/${service.protocol}`}
                className="rounded-md border border-subtle bg-surface-base px-3 py-2 text-sm leading-6"
              >
                <p>
                  <span className="font-mono font-semibold text-accent">
                    {service.port}/{service.protocol}
                  </span>{" "}
                  <span className="font-medium text-primary">{service.name}</span>
                  {program && <span className="text-secondary"> · {program}</span>}
                </p>
                {service.banner !== undefined && (
                  <p className="text-secondary">
                    <Term id="banner">Banner</Term>:{" "}
                    <code className="font-mono text-[0.9em] text-primary">{service.banner}</code>
                  </p>
                )}
                <p className="text-muted">
                  <FoundBy line={revealed?.line} via={service.via} />
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {onNoteChange && (
        <div className="mt-5">
          <label htmlFor={`${id}-notes`} className="text-sm font-semibold">
            Your notes
          </label>
          <p id={`${id}-notes-help`} className="text-sm text-muted">
            {NOTES_HELP}
          </p>
          <textarea
            id={`${id}-notes`}
            aria-describedby={`${id}-notes-help`}
            value={note ?? ""}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="What stood out about this computer?"
            className="mt-2 w-full rounded-md border border-strong bg-surface-base px-3 py-2 text-sm leading-6 text-primary placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          />
        </div>
      )}
    </section>
  );
}
