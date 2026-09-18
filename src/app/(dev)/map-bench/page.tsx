import type { Metadata } from "next";
import { requireDevPage } from "../dev-only";
import { MapBench } from "./map-bench";

export const metadata: Metadata = {
  title: "Map bench – Hacker Simulation",
  robots: { index: false, follow: false },
};

/** Never prerendered: the gate in requireDevPage has to run per request, not once at build time. */
export const dynamic = "force-dynamic";

const number = (value: string | string[] | undefined, fallback: number): number => {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 2000) : fallback;
};

/**
 * The network map with a synthetic network on it, for measuring how it draws at a size no mission
 * reaches: `/map-bench?hosts=200&shown=8`. A developer tool, gated like the styleguide.
 */
export default async function MapBenchPage({ searchParams }: PageProps<"/map-bench">) {
  requireDevPage();
  const query = await searchParams;
  const hosts = number(query.hosts, 200);
  return <MapBench hosts={hosts} shown={number(query.shown, hosts)} />;
}
