"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Mission } from "@/content/schemas/mission";
import { createMentorStore, type MentorSession } from "./mentor-store";

/**
 * The mentor for one mission attempt, held in memory (md-files/10-ai-mentor.md, prompts 10.3 and
 * 10.4). Call it where the attempt lives, so it survives moving between the workspace and the
 * debrief; give that component a `key` per attempt so Restart mission starts a fresh one. Requests
 * still in flight are stopped when the attempt ends.
 */
export function useMentorSession(mission: Mission): MentorSession {
  const [store] = useState(() => createMentorStore(mission));
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  useEffect(() => () => store.abortAll(), [store]);
  return useMemo(
    () => ({
      state,
      askHint: store.askHint,
      explain: store.explain,
      requestReview: store.requestReview,
    }),
    [state, store],
  );
}
