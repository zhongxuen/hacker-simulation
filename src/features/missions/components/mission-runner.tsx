"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { Mission } from "@/content/schemas/mission";
import { reportFirstTick, trackUsage } from "@/lib/analytics";
import { missionProgress } from "../evaluate";
import { isRunInProgress, type MissionRunAction, type MissionRunState } from "../run/mission-run";
import { useMissionRun } from "../run/use-mission-run";
import { usageEventsBetween } from "../run/usage";
import { MissionBriefing } from "./mission-briefing";
import type { MissionLinks, MissionRunStatus } from "./types";

/**
 * Everything after Start mission (the engine, terminal, network map, mentor, workspace and
 * debrief) is one chunk, loaded on demand (md-files/11-testing-security-deployment.md, prompt 11.3).
 * The promise is kept, so warming it up during the briefing and rendering it later share one
 * download.
 */
let missionPlayModule: Promise<typeof import("./mission-play")> | undefined;
const loadMissionPlay = () => (missionPlayModule ??= import("./mission-play"));
const MissionPlay = lazy(loadMissionPlay);

export interface MissionRunnerProps {
  mission: Mission;
  links: MissionLinks;
  /**
   * Called whenever the run's status changes, so the page can show progress in the top bar and
   * ask before the learner leaves mid-run. The runner itself knows nothing about the app shell.
   */
  onStatusChange?: (status: MissionRunStatus) => void;
}

/**
 * The mission runner (md-files/06-mission-system.md, prompt 06.4): briefing, then workspace, then
 * debrief, all driven by the mission object. There is no mission-specific branching anywhere in
 * these components: a fourth mission is a new content file, nothing more.
 *
 * All run state is the one in-memory store from useMissionRun. Restart mission starts a new
 * attempt: a fresh store and a fresh terminal.
 */
export function MissionRunner({ mission, links, onStatusChange }: MissionRunnerProps) {
  const { run, dispatch } = useMissionRun(mission);
  return (
    <MissionAttempt
      key={run.attempt}
      mission={mission}
      links={links}
      run={run}
      dispatch={dispatch}
      onStatusChange={onStatusChange}
    />
  );
}

interface MissionAttemptProps extends MissionRunnerProps {
  run: MissionRunState;
  dispatch: (action: MissionRunAction) => void;
}

/**
 * One attempt at the mission. The briefing needs nothing but the mission, so it shows at once;
 * pressing Start mission loads MissionPlay (fetched in the background while the learner reads),
 * which builds the practice computer and starts the run. Until it arrives, the briefing stays up
 * with its button busy.
 */
function MissionAttempt({ mission, links, run, dispatch, onStatusChange }: MissionAttemptProps) {
  const [startedAt, setStartedAt] = useState<number | null>(null);

  // Warm up the play chunk while the learner reads the briefing, so Start mission is instant.
  useEffect(() => {
    const warm = () => void loadMissionPlay().catch(() => {});
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(warm, { timeout: 3000 });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = window.setTimeout(warm, 1500);
    return () => window.clearTimeout(timer);
  }, []);

  // Moving between briefing, workspace and debrief puts focus on the new screen's heading (the
  // debrief focuses its own).
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstPhase = useRef(true);
  useEffect(() => {
    // On the page's first render focus stays put; after Restart mission it goes to the briefing.
    if (firstPhase.current) {
      firstPhase.current = false;
      if (run.attempt === 0) return;
    }
    if (run.phase !== "debrief") headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [run.phase, run.attempt]);

  // Anonymous usage counts (md-files/metrics.md): what changed in the run, as ids only. Nothing
  // is sent when the browser asks not to be tracked or the learner turned counts off.
  const previousRun = useRef(run);
  useEffect(() => {
    for (const event of usageEventsBetween(mission, previousRun.current, run)) {
      trackUsage(event);
      if (event.name === "Objective ticked") reportFirstTick();
    }
    previousRun.current = run;
  }, [mission, run]);

  const { done, total } = missionProgress(mission, run.completed);
  const inProgress = isRunInProgress(mission, run);
  useEffect(() => {
    onStatusChange?.({ phase: run.phase, inProgress, done, total });
  }, [onStatusChange, run.phase, inProgress, done, total]);

  const briefing = (
    <MissionBriefing
      mission={mission}
      links={links}
      headingRef={headingRef}
      starting={startedAt !== null}
      onStart={() => setStartedAt(Date.now())}
    />
  );
  if (startedAt === null) return briefing;
  return (
    <Suspense fallback={briefing}>
      <MissionPlay
        mission={mission}
        links={links}
        run={run}
        dispatch={dispatch}
        headingRef={headingRef}
        startedAt={startedAt}
      />
    </Suspense>
  );
}
