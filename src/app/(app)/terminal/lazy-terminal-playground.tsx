"use client";

import { lazy, Suspense } from "react";
import { LoadingPracticeComputer } from "@/components/shell/loading-practice-computer";

/**
 * The playground without the terminal and the simulation engine in the page's first download
 * (md-files/11-testing-security-deployment.md, prompt 11.3). The server renders the whole
 * terminal, so nothing moves; its code arrives as the page hydrates, and it starts working then.
 */
const TerminalPlayground = lazy(() =>
  import("./terminal-playground").then((module) => ({ default: module.TerminalPlayground })),
);

export function LazyTerminalPlayground() {
  return (
    <Suspense fallback={<LoadingPracticeComputer />}>
      <TerminalPlayground />
    </Suspense>
  );
}
