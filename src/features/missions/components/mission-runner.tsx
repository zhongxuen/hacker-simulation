"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toScenarioSpec, type Mission } from "@/content/schemas/mission";
import { useTerminalSession } from "@/features/terminal";
import type { SimEvent, SimState } from "@/sim/types";
import { missionProgress } from "../evaluate";
import { isRunInProgress, type MissionRunAction, type MissionRunState } from "../run/mission-run";
import { useMissionRun } from "../run/use-mission-run";
import { MissionBriefing } from "./mission-briefing";
import { MissionDebrief } from "./mission-debrief";
import { MissionWorkspace } from "./mission-workspace";
import type { MissionLinks, MissionRunStatus } from "./types";

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

/** One attempt at the mission: its terminal session lives here, across workspace and debrief. */
function MissionAttempt({ mission, links, run, dispatch, onStatusChange }: MissionAttemptProps) {
  const scenario = useMemo(() => toScenarioSpec(mission), [mission]);
  const onEvents = useCallback(
    (events: readonly SimEvent[], sim: SimState) => dispatch({ type: "command", events, sim }),
    [dispatch],
  );
  const onReset = useCallback((sim: SimState) => dispatch({ type: "reset", sim }), [dispatch]);
  const session = useTerminalSession({
    scenario,
    seed: mission.scenario.seed,
    onEvents,
    onReset,
  });

  // The guided tour plays on the first visit to the workspace only, not after the debrief
  // (adjusting state while rendering, when the phase changes).
  const [shownPhase, setShownPhase] = useState(run.phase);
  const [tourDone, setTourDone] = useState(false);
  if (shownPhase !== run.phase) {
    if (shownPhase === "workspace") setTourDone(true);
    setShownPhase(run.phase);
  }

  // The mentor's "That's your first host!" plays once per attempt: when the first new computer
  // turns up on the map, until the learner dismisses it (md-files/07-network-visualizer.md).
  const [mapTip, setMapTip] = useState<"waiting" | "showing" | "done">("waiting");
  if (mapTip === "waiting" && run.events.some((event) => event.type === "host.discovered")) {
    setMapTip("showing");
  }

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

  const { done, total } = missionProgress(mission, run.completed);
  const inProgress = isRunInProgress(mission, run);
  useEffect(() => {
    onStatusChange?.({ phase: run.phase, inProgress, done, total });
  }, [onStatusChange, run.phase, inProgress, done, total]);

  if (run.phase === "briefing") {
    return (
      <MissionBriefing
        mission={mission}
        links={links}
        headingRef={headingRef}
        onStart={() => dispatch({ type: "start", sim: session.sim })}
      />
    );
  }
  if (run.phase === "debrief") {
    return <MissionDebrief mission={mission} run={run} links={links} dispatch={dispatch} />;
  }
  return (
    <MissionWorkspace
      mission={mission}
      run={run}
      dispatch={dispatch}
      session={session}
      startTour={mission.guidedTour && !tourDone}
      headingRef={headingRef}
      mapTip={mapTip === "showing"}
      onDismissMapTip={() => setMapTip("done")}
    />
  );
}
