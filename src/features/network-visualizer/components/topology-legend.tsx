import { useId, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import {
  NODE_STATES,
  STATE_LABEL,
  STATE_SUMMARY,
  YOU_ARE_HERE,
  YOU_ARE_HERE_EXPLANATION,
} from "../copy";
import { GLYPH_SIZE, NodeGlyph, STATE_TONE } from "./node-glyph";

interface TopologyLegendProps {
  className?: string;
}

/** A small drawing for the key, 32 × 20. Decorative: the words next to it carry the meaning. */
function Sample({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 32 20"
      className="h-5 w-8 shrink-0"
      aria-hidden="true"
      focusable="false"
      fill="none"
    >
      {children}
    </svg>
  );
}

function Entry({
  sample,
  label,
  children,
}: {
  sample: ReactNode;
  label: string;
  children: string;
}) {
  return (
    <li className="flex items-start gap-2">
      {sample}
      <span className="leading-5">
        <span className="font-semibold text-primary">{label}</span>{" "}
        <span className="text-secondary">{children}</span>
      </span>
    </li>
  );
}

/**
 * The map key: every shape, line and marker on the map, with what it means in plain words. Each
 * node state is shown with its shape, its colour and its name together.
 */
export function TopologyLegend({ className }: TopologyLegendProps) {
  const titleId = useId();

  return (
    <div className={cx("text-sm", className)}>
      <p id={titleId} className="mb-2 font-semibold text-primary">
        Map key
      </p>
      <ul aria-labelledby={titleId} className="grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
        {NODE_STATES.map((state) => (
          <Entry
            key={state}
            label={STATE_LABEL[state]}
            sample={
              <svg
                viewBox={`0 0 ${GLYPH_SIZE} ${GLYPH_SIZE}`}
                className={cx("size-5 shrink-0", STATE_TONE[state])}
                aria-hidden="true"
                focusable="false"
              >
                <NodeGlyph state={state} />
              </svg>
            }
          >
            {STATE_SUMMARY[state]}
          </Entry>
        ))}
        <Entry
          label={YOU_ARE_HERE}
          sample={
            <Sample>
              <rect x={1} y={4} width={30} height={12} rx={6} className="fill-status-success" />
            </Sample>
          }
        >
          {YOU_ARE_HERE_EXPLANATION}
        </Entry>
        <Entry
          label="Dashed box"
          sample={
            <Sample>
              <rect
                x={1.5}
                y={2.5}
                width={29}
                height={15}
                rx={4}
                strokeDasharray="4 3"
                strokeWidth={1.5}
                className="stroke-(--border-strong)"
              />
            </Sample>
          }
        >
          A separate network. Traffic between networks passes through a firewall.
        </Entry>
        <Entry
          label="Line along the top"
          sample={
            <Sample>
              <path d="M3 16V5h26v11" strokeWidth={2} className="stroke-(--border-strong)" />
              <rect
                x={25}
                y={12}
                width={8}
                height={8}
                rx={2}
                strokeWidth={1.5}
                className="fill-surface-base stroke-(--text-secondary)"
              />
            </Sample>
          }
        >
          Your computer reached another network, through the firewall between them.
        </Entry>
        <Entry
          label="Line with a dot"
          sample={
            <Sample>
              <path d="M2 10h24" strokeWidth={2} className="stroke-(--text-muted)" />
              <circle
                cx={26}
                cy={10}
                r={3.5}
                strokeWidth={2}
                className="fill-surface-base stroke-(--text-muted)"
              />
            </Sample>
          }
        >
          One computer with an address on another network too.
        </Entry>
      </ul>
    </div>
  );
}
