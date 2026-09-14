/**
 * The browser half of exporting the map (prompt 07.5): read the colours from the design tokens,
 * turn the SVG from export.ts into a PNG on a canvas, and save files. Everything happens on the
 * learner's device: nothing is uploaded, and no outside service is used.
 */
import type { MapPalette } from "./export";

/** Which design token each palette colour reads (src/styles/tokens.css). */
const TOKENS: Readonly<Record<keyof MapPalette, string>> = {
  background: "--surface-base",
  surface: "--surface-raised",
  card: "--surface-overlay",
  border: "--border-subtle",
  borderStrong: "--border-strong",
  text: "--text-primary",
  textSecondary: "--text-secondary",
  textMuted: "--text-muted",
  accent: "--accent",
  info: "--status-info",
  success: "--status-success",
};

/** The map's colours as the page draws them right now, from `element`'s design tokens. */
export function readMapPalette(element: Element): MapPalette {
  const style = getComputedStyle(element);
  return Object.fromEntries(
    Object.entries(TOKENS).map(([key, token]) => [key, style.getPropertyValue(token).trim()]),
  ) as unknown as MapPalette;
}

/** Draws an SVG onto a canvas at `scale` times its size, and returns it as a PNG. */
export function svgToPng(svg: string, width: number, height: number, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("This browser can't draw pictures here.");
        context.scale(scale, scale);
        context.drawImage(image, 0, 0, width, height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("The picture came out empty."))),
          "image/png",
        );
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The map drawing couldn't be turned into a picture."));
    };
    image.src = url;
  });
}

/** Saves `blob` as a download called `fileName`. */
export function saveFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before the address stops working.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A file name from a title: "Mapping the network" → "mapping-the-network". */
export function fileStem(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "network-map"
  );
}
