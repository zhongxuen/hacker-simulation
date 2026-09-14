"use client";

import { useCallback, useReducer } from "react";
import type { Mission } from "@/content/schemas/mission";
import {
  createMissionRun,
  missionRunReducer,
  type MissionRunAction,
  type MissionRunState,
} from "./mission-run";

export interface MissionRun {
  readonly run: MissionRunState;
  readonly dispatch: (action: MissionRunAction) => void;
}

/**
 * The one in-memory store for a mission run (md-files/03-app-state-and-privacy.md): every tick,
 * answer, story beat and hint lives here, and only here. Nothing is written to any storage, so
 * leaving the page or reloading ends the run. Give the component using it a `key` per mission.
 */
export function useMissionRun(mission: Mission): MissionRun {
  const reducer = useCallback(
    (run: MissionRunState, action: MissionRunAction) => missionRunReducer(mission, run, action),
    [mission],
  );
  const [run, dispatch] = useReducer(reducer, undefined, () => createMissionRun());
  return { run, dispatch };
}
