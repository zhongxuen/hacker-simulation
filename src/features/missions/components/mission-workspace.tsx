"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { MedalIcon } from "@/components/ui/icons";
import { SecretFoundToast } from "@/components/ui/secret-found-toast";
import { ToastViewport } from "@/components/ui/toast";
import type { Mission } from "@/content/schemas/mission";
import { TopologyGraph } from "@/features/network-visualizer";
import { Terminal, type TerminalSession } from "@/features/terminal";
import { selectTopology } from "@/sim";
import { isMissionComplete } from "../evaluate";
import {
  canAnswer,
  currentObjective,
  rewardSummary,
  type MissionRunAction,
  type MissionRunState,
} from "../run/mission-run";
import { AnswerInput } from "./answer-input";
import { MissionText, plainMissionText } from "./mission-text";
import { ObjectivesPanel } from "./objectives-panel";
import { StoryPanel } from "./story-panel";

/** How long a secret-found toast stays before it tidies itself away. */
const SECRET_TOAST_MS = 8000;

interface MissionWorkspaceProps {
  mission: Mission;
  run: MissionRunState;
  dispatch: (action: MissionRunAction) => void;
  session: TerminalSession;
  /** Start the terminal's guided tour: the mission asks for it, on the first visit only. */
  startTour: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
}

/**
 * The workspace: the team chat, the phase 05 terminal, the network map when the mission has more
 * than one computer, and the live objectives beside them. Everything comes from the mission object
 * and the run: there's no mission-specific code here.
 */
export function MissionWorkspace({
  mission,
  run,
  dispatch,
  session,
  startTour,
  headingRef,
}: MissionWorkspaceProps) {
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [selectedHost, setSelectedHost] = useState<string | undefined>();
  const complete = isMissionComplete(mission, run.completed);
  const current = currentObjective(mission, run);
  const storyAnswer = current && canAnswer(mission, run, current) ? current : undefined;
  const rewards = rewardSummary(mission, run);
  const leftToFind =
    rewards.bonusTotal -
    rewards.bonusFound.length +
    (rewards.secretsTotal - rewards.secretsFound.length);
  const showMap = mission.scenario.network.hosts.length > 1;
  const topology = useMemo(
    () => (showMap ? selectTopology(session.sim) : null),
    [showMap, session.sim],
  );

  // Secret-found toasts tidy themselves away; dismissing one only hides the toast.
  const firstSecret = run.newSecrets[0];
  useEffect(() => {
    if (firstSecret === undefined) return;
    const timer = window.setTimeout(
      () => dispatch({ type: "acknowledgeSecret", objectiveId: firstSecret }),
      SECRET_TOAST_MS,
    );
    return () => window.clearTimeout(timer);
  }, [firstSecret, dispatch]);

  return (
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-accent">Mission</p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold tracking-tight text-balance outline-none"
          >
            {mission.title}
          </h1>
        </div>
        <Button variant="danger" size="sm" onClick={() => setConfirmRestart(true)}>
          Restart mission
        </Button>
      </header>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <StoryPanel
            entries={run.story}
            batchStart={run.storyBatchStart}
            yourMove={
              storyAnswer && (
                <div className="rounded-lg border border-accent bg-accent-subtle px-4 py-3">
                  <p className="mb-3 font-semibold text-primary">
                    <span className="text-accent">Your move: </span>
                    <MissionText text={storyAnswer.description} />
                  </p>
                  <AnswerInput
                    objective={storyAnswer}
                    inChat
                    tried={run.answers[storyAnswer.id] ?? []}
                    feedback={run.feedback[storyAnswer.id]}
                    onAnswer={(answer) =>
                      dispatch({ type: "answer", objectiveId: storyAnswer.id, answer })
                    }
                  />
                </div>
              )
            }
          />

          {complete && (
            <section
              role="status"
              aria-labelledby="mission-done-title"
              className="flex animate-rise-in flex-wrap items-center gap-4 rounded-xl border border-reward bg-surface-raised px-5 py-4"
            >
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-reward text-surface-base"
              >
                <MedalIcon className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="mission-done-title" className="font-semibold text-reward">
                  Every main objective is done!
                </h2>
                <p className="text-sm leading-6 text-secondary">
                  {leftToFind > 0
                    ? `Keep exploring if you like: ${leftToFind === 1 ? "1 bonus objective or secret is" : `${leftToFind} bonus objectives and secrets are`} still out there.`
                    : "You found every bonus objective and secret, too."}
                </p>
              </div>
              <Button variant="primary" onClick={() => dispatch({ type: "debrief" })}>
                See your debrief
              </Button>
            </section>
          )}

          <Terminal session={session} startTour={startTour} outputClassName="h-[24rem]" />

          {topology && (
            <section
              aria-labelledby="mission-map-title"
              className="rounded-xl border border-subtle bg-surface-raised"
            >
              <header className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-subtle px-4 py-2">
                <h2 id="mission-map-title" className="text-sm font-semibold tracking-wide">
                  Network map
                </h2>
                <p className="text-sm text-secondary">
                  {topology.counts.found === 1
                    ? "1 computer found"
                    : `${topology.counts.found} computers found`}{" "}
                  · keep scanning to find more
                </p>
              </header>
              <div className="p-4">
                <TopologyGraph
                  topology={topology}
                  selectedHostId={selectedHost}
                  onSelectHost={setSelectedHost}
                />
              </div>
            </section>
          )}
        </div>

        <aside aria-label="Mission objectives" className="xl:sticky xl:top-24 xl:self-start">
          <ObjectivesPanel
            mission={mission}
            run={run}
            answeringInStory={storyAnswer?.id}
            onAnswer={(objectiveId, answer) => dispatch({ type: "answer", objectiveId, answer })}
            onHint={(objectiveId) => dispatch({ type: "hint", objectiveId })}
          />
        </aside>
      </div>

      <ToastViewport>
        {run.newSecrets.map((id) => {
          const secret = mission.objectives.find((objective) => objective.id === id);
          return secret ? (
            <SecretFoundToast
              key={id}
              name={secret.name ?? plainMissionText(secret.description)}
              description={plainMissionText(secret.success)}
              onDismiss={() => dispatch({ type: "acknowledgeSecret", objectiveId: id })}
            />
          ) : null;
        })}
      </ToastViewport>

      <Dialog
        open={confirmRestart}
        onClose={() => setConfirmRestart(false)}
        title="Start this mission again?"
        description="Everything you've done in this run will be undone, and you'll go back to the briefing."
        size="sm"
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmRestart(false)}>
              Keep going
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmRestart(false);
                dispatch({ type: "restart" });
              }}
            >
              Restart mission
            </Button>
          </>
        }
      />
    </div>
  );
}
