"use client";

import { lazy, Suspense } from "react";
import { LoadingPracticeComputer } from "@/components/shell/loading-practice-computer";

/**
 * The sandbox without the terminal, the network map and the simulation engine in the page's first
 * download (md-files/11-testing-security-deployment.md, prompt 11.3). The server renders the whole
 * workspace, so nothing moves; its code arrives as the page hydrates, and it starts working then.
 */
const SandboxWorkspace = lazy(() =>
  import("./sandbox-workspace").then((module) => ({ default: module.SandboxWorkspace })),
);

export function LazySandboxWorkspace() {
  return (
    <Suspense fallback={<LoadingPracticeComputer />}>
      <SandboxWorkspace />
    </Suspense>
  );
}
