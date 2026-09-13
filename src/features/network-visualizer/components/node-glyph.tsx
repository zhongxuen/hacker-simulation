import type { TopologyNodeState } from "@/sim/types";
import { cx } from "@/lib/cx";

/** Text colour per state. Every one is audited as text on the card surfaces (src/lib/contrast-audit.ts). */
export const STATE_TONE: Readonly<Record<TopologyNodeState, string>> = {
  unknown: "text-muted",
  detected: "text-status-info",
  enumerated: "text-accent",
  accessed: "text-status-success",
};

/** The glyph's box: 36 × 36 map units. */
export const GLYPH_SIZE = 36;

interface NodeGlyphProps {
  state: TopologyNodeState;
  /** Top-left corner, in the parent's coordinates. */
  x?: number;
  y?: number;
}

/**
 * Each state's shape, drawn in its colour. The shapes differ as well as the colours, and every card
 * also names its state in words, so colour never carries the meaning alone:
 *
 * - Heard of: a dashed circle with a question mark (not seen yet).
 * - Found: a solid circle with a ping in it (it answered).
 * - Scanned: a hexagon with a list in it (its doors are known).
 * - Accessed: a screen with a command prompt (you can type on it).
 *
 * Decorative: the card's accessible name says the state.
 */
export function NodeGlyph({ state, x = 0, y = 0 }: NodeGlyphProps) {
  return (
    <g
      aria-hidden="true"
      transform={`translate(${x} ${y})`}
      className={cx("fill-none stroke-current", STATE_TONE[state])}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {state === "unknown" && (
        <>
          <circle cx={18} cy={18} r={15} strokeDasharray="4 4" className="fill-surface-base" />
          <path d="M14.5 14.5a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.2-1.5 2.3v.5" />
          <circle cx={18} cy={25} r={0.6} className="fill-current" />
        </>
      )}
      {state === "detected" && (
        <>
          <circle cx={18} cy={18} r={15} className="fill-surface-base" />
          <circle cx={18} cy={18} r={8} strokeWidth={1.5} />
          <circle cx={18} cy={18} r={3.5} className="fill-current" stroke="none" />
        </>
      )}
      {state === "enumerated" && (
        <>
          <path d="M18 3 31 10.5v15L18 33 5 25.5v-15Z" className="fill-surface-base" />
          <path d="M12.5 13.5h11M12.5 18h11M12.5 22.5h7" />
        </>
      )}
      {state === "accessed" && (
        <>
          <rect x={3.5} y={6} width={29} height={24} rx={4} className="fill-surface-base" />
          <path d="m10 14 4 4-4 4M17 22.5h8" />
        </>
      )}
    </g>
  );
}
