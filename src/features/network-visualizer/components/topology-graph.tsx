"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchIcon } from "@/components/ui/icons";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cx } from "@/lib/cx";
import type { DiscoveredTopology } from "@/sim/types";
import { EMPTY_DESCRIPTION, EMPTY_TITLE, KEYBOARD_HELP, nodeExplanation } from "../copy";
import {
  layoutKeys,
  layoutTopology,
  nextFocus,
  NODE_HEIGHT,
  NODE_WIDTH,
  type FocusMove,
  type TopologyLayout,
} from "../layout";
import {
  clampView,
  fitView,
  MAX_ZOOM,
  MIN_ZOOM,
  PAN_STEP,
  panBy,
  revealRect,
  ZOOM_STEP,
  zoomAt,
  type Size,
  type View,
} from "../view";
import { MapLayers } from "./map-layers";
import { FitIcon, ZoomInIcon, ZoomOutIcon } from "./map-icons";
import { TopologyLegend } from "./topology-legend";

export interface TopologyGraphProps {
  /** What the learner has discovered: `selectTopology(state)` from "@/sim". */
  topology: DiscoveredTopology;
  selectedHostId?: string;
  /** Called with a host id when the learner clicks, taps, or presses Enter or Space on a card. */
  onSelectHost?: (hostId: string) => void;
  /** Show the map key under the map. On by default. */
  showLegend?: boolean;
  /** The map is at least 20rem tall and grows to fill a flex parent; set a height here to fix it. */
  className?: string;
}

/** Until the viewport has been measured (and on the server), the map is fitted to this size. */
const DEFAULT_VIEWPORT: Size = { width: 800, height: 480 };
/** How far a pointer moves before a press becomes a drag, not a click. */
const DRAG_THRESHOLD = 4;
/** How long a "New!" label stays, when motion is reduced. */
const NEW_LABEL_MS = 5000;
/** Wheel events this close together are one gesture: no easing between them. */
const WHEEL_SETTLE_MS = 160;

const NO_KEYS: ReadonlySet<string> = new Set();

const ARROW_MOVES: Readonly<Record<string, FocusMove>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Home: "first",
  End: "last",
};

/** Shift + arrow scrolls the map: the view moves that way, so the map moves the other. */
const ARROW_PAN: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [0, PAN_STEP],
  ArrowDown: [0, -PAN_STEP],
  ArrowLeft: [PAN_STEP, 0],
  ArrowRight: [-PAN_STEP, 0],
};

interface Reveal {
  readonly layout: TopologyLayout;
  /** Everything on the previous layout, by key. */
  readonly known: ReadonlySet<string>;
  /** What appeared with the latest discovery. Kept until the next one, or NEW_LABEL_MS. */
  readonly fresh: ReadonlySet<string>;
}

interface Gesture {
  /** The view when this gesture (or its current number of pointers) began. */
  readonly view: View;
  readonly center: { x: number; y: number };
  /** Distance between two pointers at the start of a pinch; 0 for a one-pointer drag. */
  readonly distance: number;
  moved: boolean;
}

const hostIdOf = (target: EventTarget | null): string | undefined =>
  target instanceof Element
    ? (target.closest("[data-host-id]")?.getAttribute("data-host-id") ?? undefined)
    : undefined;

const inControls = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest("[data-map-controls]") !== null;

function centerOf(points: readonly { x: number; y: number }[]) {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function spreadOf(points: readonly { x: number; y: number }[]): number {
  const [a, b] = points;
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
}

/**
 * The fog-of-war network map: an SVG drawing of what the learner has discovered, and nothing
 * else (the topology comes from `selectTopology`, which never includes ground truth). Rendering
 * only: it never touches simulation state, and whoever owns the state calls the selector.
 *
 * - Layout is deterministic (see ../layout.ts): subnets as columns, hosts in address order. When a
 *   host appears, the hosts after it glide down; nothing else moves.
 * - New hosts, subnets and lines pop or fade in. Under reduced motion they appear at once, and new
 *   hosts wear a "New!" label for a few seconds instead.
 * - Pan by dragging, zoom with the wheel or a pinch, or use the zoom buttons. With focus on the
 *   map: arrow keys move between hosts, Enter or Space selects, + and - zoom, 0 fits, and Shift
 *   with an arrow key scrolls.
 * - Only one card is in the Tab order at a time (the focused or selected one, else the first):
 *   with a couple of hundred hosts, a Tab stop each would bury everything after the map.
 */
export function TopologyGraph({
  topology,
  selectedHostId,
  onSelectHost,
  showLegend = true,
  className,
}: TopologyGraphProps) {
  const helpId = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion(viewportRef);

  const layout = useMemo(() => layoutTopology(topology), [topology]);
  const [size, setSize] = useState<Size | null>(null);
  // Easing is off until the first measurement has been drawn, so the map doesn't glide into
  // place on load.
  const [settled, setSettled] = useState(false);
  // Null while the map fits itself to the viewport; set once the learner pans or zooms.
  const [manualView, setManualView] = useState<View | null>(null);
  // True during a drag, pinch or wheel: the view follows the pointer with no easing.
  const [live, setLive] = useState(false);
  const [focusedId, setFocusedId] = useState<string | undefined>(undefined);
  // Which card's explanation shows under the map: the one under the pointer, else the focused one.
  const [hoveredId, setHoveredId] = useState<string | undefined>(undefined);
  const [focusWithin, setFocusWithin] = useState(false);

  const viewport = size && size.width > 0 && size.height > 0 ? size : DEFAULT_VIEWPORT;
  const view = manualView ?? fitView(layout, viewport);

  // What's new since the last layout, worked out during render (not in an effect) so a new card's
  // first frame already carries its entrance animation.
  const [reveal, setReveal] = useState<Reveal>(() => ({
    layout,
    known: layoutKeys(layout),
    fresh: NO_KEYS,
  }));
  if (reveal.layout !== layout) {
    const keys = layoutKeys(layout);
    const fresh = new Set([...keys].filter((key) => !reveal.known.has(key)));
    setReveal({ layout, known: keys, fresh: fresh.size > 0 ? fresh : reveal.fresh });
  }

  const nodeIds = useMemo(() => new Set(layout.nodes.map((node) => node.hostId)), [layout.nodes]);
  const tabStopId =
    [focusedId, selectedHostId].find((id) => id !== undefined && nodeIds.has(id)) ??
    layout.nodes[0]?.hostId;

  // The latest values, for the wheel listener, which outlives any one render.
  const latest = useRef({ view, layout, viewport });
  useEffect(() => {
    latest.current = { view, layout, viewport };
  });

  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const suppressClick = useRef(false);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((previous) =>
        previous?.width === width && previous.height === height ? previous : { width, height },
      );
      // Two frames: one to draw the measured view, one before easing is switched on.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => setSettled(true));
      });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  // Wheel and trackpad zoom. A native listener, because React's wheel listener is passive and
  // can't stop the page from scrolling instead.
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (event: WheelEvent) => {
      const current = latest.current;
      if (current.layout.nodes.length === 0) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const anchor = {
        x: event.clientX - rect.left - element.clientLeft,
        y: event.clientY - rect.top - element.clientTop,
      };
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
      // A pinch on a trackpad arrives as a wheel event with ctrlKey set, in smaller steps.
      const factor = Math.exp(-event.deltaY * unit * (event.ctrlKey ? 0.01 : 0.0015));
      const next = clampView(
        zoomAt(current.view, factor, anchor),
        current.layout,
        current.viewport,
      );
      // Several wheel events can land before the next render: chain them.
      latest.current = { ...current, view: next };
      setManualView(next);
      setLive(true);
      clearTimeout(timer);
      timer = setTimeout(() => setLive(false), WHEEL_SETTLE_MS);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", onWheel);
      clearTimeout(timer);
    };
  }, []);

  // "New!" labels (and the pop class) clear after a while, even with no new discovery.
  useEffect(() => {
    const fresh = reveal.fresh;
    if (fresh.size === 0) return;
    const timer = setTimeout(
      () =>
        setReveal((current) =>
          current.fresh === fresh ? { ...current, fresh: NO_KEYS } : current,
        ),
      NEW_LABEL_MS,
    );
    return () => clearTimeout(timer);
  }, [reveal.fresh]);

  const applyView = (next: View) => setManualView(clampView(next, layout, viewport));
  const zoomBy = (factor: number) =>
    applyView(zoomAt(view, factor, { x: viewport.width / 2, y: viewport.height / 2 }));
  const fit = () => setManualView(null);

  const focusHost = (hostId: string | undefined) => {
    if (hostId === undefined) return;
    viewportRef.current
      ?.querySelector<SVGGElement>(`[data-host-id="${CSS.escape(hostId)}"]`)
      ?.focus({ preventScroll: true });
  };

  /** Point relative to the viewport's content box, in the same units as the view. */
  const localPoint = (event: PointerEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    return {
      x: event.clientX - rect.left - element.clientLeft,
      y: event.clientY - rect.top - element.clientTop,
    };
  };

  const beginGesture = (from: View, moved: boolean) => {
    const points = [...pointers.current.values()];
    gesture.current = { view: from, center: centerOf(points), distance: spreadOf(points), moved };
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (layout.nodes.length === 0 || inControls(event.target)) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    suppressClick.current = false;
    pointers.current.set(event.pointerId, localPoint(event));
    beginGesture(view, gesture.current?.moved ?? false);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || !pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, localPoint(event));
    const points = [...pointers.current.values()];
    const center = centerOf(points);
    if (!current.moved) {
      const distance = Math.hypot(center.x - current.center.x, center.y - current.center.y);
      if (distance < DRAG_THRESHOLD && points.length < 2) return;
      current.moved = true;
      setLive(true);
    }
    // Capture only once it's a drag, so a plain click still reaches the card under the pointer.
    // Capturing only keeps the drag going outside the map, so a pointer the browser has already
    // let go of (it throws) mustn't stop the pan.
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {}
    }
    let next = panBy(current.view, center.x - current.center.x, center.y - current.center.y);
    if (points.length > 1 && current.distance > 0) {
      next = zoomAt(next, spreadOf(points) / current.distance, center);
    }
    applyView(next);
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) return;
    const moved = gesture.current?.moved ?? false;
    if (pointers.current.size > 0) {
      // A finger lifted mid-pinch: carry on from here with the ones still down.
      beginGesture(view, moved);
      return;
    }
    gesture.current = null;
    if (moved) {
      suppressClick.current = true;
      setLive(false);
    }
  };

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const hostId = hostIdOf(event.target);
    if (hostId !== undefined) onSelectHost?.(hostId);
  };

  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    const hostId = hostIdOf(event.target);
    if (hostId === undefined) return;
    setFocusedId(hostId);
    setFocusWithin(true);
    const place = layout.nodes.find((node) => node.hostId === hostId);
    if (!place) return;
    // Bring a card focused from the keyboard into view, pills and focus ring included.
    const next = revealRect(
      view,
      { x: place.x - 8, y: place.y - 14, width: NODE_WIDTH + 16, height: NODE_HEIGHT + 22 },
      viewport,
    );
    if (next !== view) applyView(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || layout.nodes.length === 0) return;
    const hostId = hostIdOf(event.target);
    const pan = ARROW_PAN[event.key];
    const move = ARROW_MOVES[event.key];
    if (event.shiftKey && pan) {
      applyView(panBy(view, pan[0], pan[1]));
    } else if (move && hostId !== undefined) {
      focusHost(nextFocus(layout, hostId, move));
    } else if ((event.key === "Enter" || event.key === " ") && hostId !== undefined) {
      onSelectHost?.(hostId);
    } else if (event.key === "+" || event.key === "=") {
      zoomBy(ZOOM_STEP);
    } else if (event.key === "-" || event.key === "_") {
      zoomBy(1 / ZOOM_STEP);
    } else if (event.key === "0") {
      fit();
    } else {
      return;
    }
    event.preventDefault();
  };

  const empty = layout.nodes.length === 0;
  const explainedId = hoveredId ?? (focusWithin ? focusedId : undefined);
  const explained = topology.nodes.find((node) => node.hostId === explainedId);

  return (
    <div className={cx("flex flex-col gap-3", className)}>
      <div
        ref={viewportRef}
        role="group"
        aria-label="Network map"
        aria-describedby={helpId}
        className="relative min-h-80 flex-1 touch-none overflow-clip rounded-lg border border-subtle bg-surface-base select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClick={onClick}
        onFocus={onFocus}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setFocusWithin(false);
          }
        }}
        onPointerOver={(event) => {
          if (event.pointerType === "mouse") setHoveredId(hostIdOf(event.target));
        }}
        onPointerLeave={() => setHoveredId(undefined)}
        onKeyDown={onKeyDown}
      >
        {empty ? (
          <div className="absolute inset-0 grid place-items-center p-4">
            <EmptyState
              icon={<SearchIcon />}
              title={EMPTY_TITLE}
              description={EMPTY_DESCRIPTION}
              titleAs="h3"
            />
          </div>
        ) : (
          <>
            <svg
              className={cx("absolute inset-0 size-full", live ? "cursor-grabbing" : "cursor-grab")}
              viewBox={`0 0 ${viewport.width} ${viewport.height}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <g
                className={cx(
                  "origin-top-left",
                  settled &&
                    !live &&
                    "transition-transform fx-duration-base ease-(--ease-standard)",
                )}
                style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
              >
                <MapLayers
                  topology={topology}
                  layout={layout}
                  selectedHostId={selectedHostId}
                  tabStopId={tabStopId}
                  fresh={reveal.fresh}
                  labelNew={reduced}
                />
              </g>
            </svg>
            <div
              data-map-controls=""
              role="group"
              aria-label="Zoom"
              className="absolute top-2 right-2 flex gap-1 rounded-lg border border-subtle bg-surface-raised p-1"
            >
              <Button
                variant="ghost"
                size="sm"
                label="Zoom out"
                icon={<ZoomOutIcon />}
                disabled={view.k <= MIN_ZOOM}
                onClick={() => zoomBy(1 / ZOOM_STEP)}
              />
              <Button
                variant="ghost"
                size="sm"
                label="Zoom in"
                icon={<ZoomInIcon />}
                disabled={view.k >= MAX_ZOOM}
                onClick={() => zoomBy(ZOOM_STEP)}
              />
              <Button
                variant="ghost"
                size="sm"
                label="Fit to screen"
                icon={<FitIcon />}
                onClick={fit}
              />
            </div>
          </>
        )}
      </div>
      {!empty && (
        // The explanation a card's tooltip gives, for keyboard users too. Not a live region: the
        // card's own description says the same to screen readers as focus lands on it.
        <p className="min-h-10 text-sm leading-5 text-secondary">
          {explained ? (
            <>
              <span className="font-semibold text-primary">{explained.label}</span>:{" "}
              {nodeExplanation(explained)}
            </>
          ) : (
            "Point at a computer, or move to it with the arrow keys, to see what its state means."
          )}
        </p>
      )}
      <p id={helpId} className="text-xs leading-5 text-muted">
        {KEYBOARD_HELP}
      </p>
      {showLegend && <TopologyLegend />}
    </div>
  );
}
