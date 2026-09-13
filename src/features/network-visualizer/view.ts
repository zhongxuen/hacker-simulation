/**
 * Pan and zoom for the network map, as pure functions. A view maps map coordinates to screen
 * coordinates: screen = map × k + (x, y). The renderer applies it as one transform on the map's
 * inner group, so panning and zooming never re-lay-out anything.
 */

export interface View {
  readonly x: number;
  readonly y: number;
  /** Zoom: 1 is actual size. */
  readonly k: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Rect extends Size {
  readonly x: number;
  readonly y: number;
}

/** Zoomed out far enough to see a couple of hundred hosts at once. */
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 2.5;
/** One press of Zoom in or Zoom out. */
export const ZOOM_STEP = 1.25;
/** One press of Shift + an arrow key, in screen pixels. */
export const PAN_STEP = 48;
/** Space kept between the map and the viewport's edge when fitting. */
const FIT_PADDING = 16;
/** How much of the map must stay on screen, so it can't be dragged away and lost. */
const KEEP_VISIBLE = 64;

export const IDENTITY_VIEW: View = { x: 0, y: 0, k: 1 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const clampZoom = (k: number): number => clamp(k, MIN_ZOOM, MAX_ZOOM);

/**
 * The view that shows the whole map: never zoomed in past actual size, centred across and aligned
 * to the top, so a map that grows downwards doesn't shift what's already on screen.
 */
export function fitView(content: Size, viewport: Size): View {
  if (content.width <= 0 || content.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return IDENTITY_VIEW;
  }
  const k = clampZoom(
    Math.min(
      (viewport.width - FIT_PADDING * 2) / content.width,
      (viewport.height - FIT_PADDING * 2) / content.height,
      1,
    ),
  );
  return { k, x: (viewport.width - content.width * k) / 2, y: FIT_PADDING };
}

/** Zooms by `factor`, keeping the map point under `anchor` (screen coordinates) where it is. */
export function zoomAt(view: View, factor: number, anchor: { x: number; y: number }): View {
  const k = clampZoom(view.k * factor);
  const ratio = k / view.k;
  return {
    k,
    x: anchor.x - (anchor.x - view.x) * ratio,
    y: anchor.y - (anchor.y - view.y) * ratio,
  };
}

export const panBy = (view: View, dx: number, dy: number): View => ({
  ...view,
  x: view.x + dx,
  y: view.y + dy,
});

/** Keeps at least a corner of the map on screen, however far it's dragged. */
export function clampView(view: View, content: Size, viewport: Size): View {
  const width = content.width * view.k;
  const height = content.height * view.k;
  const keepX = Math.min(KEEP_VISIBLE, width);
  const keepY = Math.min(KEEP_VISIBLE, height);
  return {
    k: view.k,
    x: clamp(view.x, keepX - width, viewport.width - keepX),
    y: clamp(view.y, keepY - height, viewport.height - keepY),
  };
}

/**
 * The smallest pan that brings `rect` (map coordinates) fully on screen, with `margin` to spare.
 * Returns `view` itself when it's already visible, so callers can skip an update.
 */
export function revealRect(view: View, rect: Rect, viewport: Size, margin = 24): View {
  const left = rect.x * view.k + view.x;
  const top = rect.y * view.k + view.y;
  const right = left + rect.width * view.k;
  const bottom = top + rect.height * view.k;
  const dx = offset(left, right, margin, viewport.width - margin);
  const dy = offset(top, bottom, margin, viewport.height - margin);
  return dx === 0 && dy === 0 ? view : panBy(view, dx, dy);
}

/** How far to move [start, end] to fit inside [min, max], preferring its start when it can't. */
function offset(start: number, end: number, min: number, max: number): number {
  if (start < min) return min - start;
  if (end > max) return Math.max(max - end, min - start);
  return 0;
}
