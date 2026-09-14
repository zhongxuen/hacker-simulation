"use client";

import { useCallback, useLayoutEffect, useMemo, useState, type RefObject } from "react";
import type { Mission } from "@/content/schemas/mission";
import { toScenarioSpec } from "@/content/schemas/mission-helpers";
import { useMentorSession } from "@/features/mentor";
import { useTerminalSession } from "@/features/terminal";
import type { SimEvent, SimState } from "@/sim/types";
import type { MissionRunAction, MissionRunState } from "../run/mission-run";
import { MissionDebrief } from "./mission-debrief";
import { MissionWorkspace } from "./mission-workspace";
import type { MissionLinks } from "./types";

export interface MissionPlayProps {
  mission: Mission;
  links: MissionLinks;
  run: MissionRunState;
  dispatch: (action: MissionRunAction) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
  /** When the learner pressed Start mission: the run's clock starts there, not when this loaded. */
  startedAt: number;
}

/**
 * Everything after Start mission: the practice computer (the simulation engine, through the
 * terminal session), the terminal, the network map, the mentor, the workspace and the debrief.
 *
 * The runner loads this module only when the learner presses Start mission (and warms it up while
 * they read the briefing), so the briefing page itself stays small (md-files/11-testing-security-deployment.md,
 * prompt 11.3: the terminal and the network visualizer must not load on pages that don't show
 * them). One attempt's terminal session and mentor live here, across workspace and debrief, so
 * nothing Noor said is lost or asked for again when the learner moves between them.
 */
export default function MissionPlay({
  mission,
  links,
  run,
  dispatch,
  headingRef,
  startedAt,
}: MissionPlayProps) {
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
  const mentor = useMentorSession(mission);

  // The run starts once its practice computer exists: before the first paint, so the learner goes
  // straight from the briefing to the workspace.
  const { sim } = session;
  const briefing = run.phase === "briefing";
  useLayoutEffect(() => {
    if (briefing) dispatch({ type: "start", sim, at: startedAt });
  }, [briefing, dispatch, sim, startedAt]);

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

  if (run.phase === "briefing") return null;
  if (run.phase === "debrief") {
    return (
      <MissionDebrief
        mission={mission}
        run={run}
        links={links}
        dispatch={dispatch}
        mentor={mentor}
        terminal={{ history: session.history, blocks: session.blocks }}
      />
    );
  }
  return (
    <MissionWorkspace
      mission={mission}
      run={run}
      dispatch={dispatch}
      session={session}
      mentor={mentor}
      startTour={mission.guidedTour && !tourDone}
      headingRef={headingRef}
      mapTip={mapTip === "showing"}
      onDismissMapTip={() => setMapTip("done")}
    />
  );
}
