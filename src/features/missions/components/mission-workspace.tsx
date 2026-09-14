"use client";

import { useEffect, useId, useMemo, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { CharacterMessage } from "@/components/ui/character-message";
import { Dialog } from "@/components/ui/dialog";
import { BookOpenIcon, MapIcon, MedalIcon } from "@/components/ui/icons";
import { SecretFoundToast } from "@/components/ui/secret-found-toast";
import { ToastViewport } from "@/components/ui/toast";
import { MENTOR } from "@/content/cast";
import type { Mission } from "@/content/schemas/mission";
import { commandOf, ReferenceDrawer } from "@/features/learning";
import { FIRST_DISCOVERY_LINE, NetworkMapPanel } from "@/features/network-visualizer";
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
  /** Show the mentor's one-time "That's your first host!" line on the map. */
  mapTip: boolean;
  onDismissMapTip: () => void;
  /** Start with the reference drawer open. */
  initialReferenceOpen?: boolean;
}

/**
 * The workspace: the team chat, the phase 05 terminal, the network map when the mission has more
 * than one computer (with its details panel and notes), and the live objectives beside them.
 * Everything comes from the mission object and the run: there's no mission-specific code here.
 */
export function MissionWorkspace({
  mission,
  run,
  dispatch,
  session,
  startTour,
  headingRef,
  mapTip,
  onDismissMapTip,
  initialReferenceOpen = false,
}: MissionWorkspaceProps) {
  const [confirmRestart, setConfirmRestart] = useState(false);
  // The map sits under the terminal, shown to start with. Hiding it keeps everything on it.
  const [mapOpen, setMapOpen] = useState(true);
  const mapId = useId();
  // The reference drawer opens over the side of the workspace. The terminal never unmounts.
  const [referenceOpen, setReferenceOpen] = useState(initialReferenceOpen);
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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<BookOpenIcon />}
            aria-expanded={referenceOpen}
            aria-haspopup="dialog"
            onClick={() => setReferenceOpen((open) => !open)}
          >
            Reference
          </Button>
          {topology && (
            <Button
              variant="secondary"
              size="sm"
              icon={<MapIcon />}
              aria-expanded={mapOpen}
              aria-controls={mapId}
              onClick={() => setMapOpen((open) => !open)}
            >
              {mapOpen ? "Hide the map" : "Show the map"}
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={() => setConfirmRestart(true)}>
            Restart mission
          </Button>
        </div>
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
            // Hidden, not removed, so the selected host and the table's search survive a toggle.
            <div id={mapId} hidden={!mapOpen}>
              <NetworkMapPanel
                topology={topology}
                events={run.events}
                notes={run.notes}
                onNoteChange={(hostId, text) => dispatch({ type: "note", hostId, text })}
                exportName={mission.title}
                tip={
                  mapTip ? (
                    <div className="flex flex-wrap items-end gap-3">
                      <CharacterMessage
                        speaker={{
                          name: MENTOR.name,
                          role: MENTOR.role,
                          initials: MENTOR.initials,
                        }}
                        tone={MENTOR.tone}
                        className="min-w-0 flex-1"
                      >
                        {FIRST_DISCOVERY_LINE}
                      </CharacterMessage>
                      <Button variant="ghost" size="sm" onClick={onDismissMapTip}>
                        Got it
                      </Button>
                    </div>
                  ) : undefined
                }
              />
            </div>
          )}
        </div>

        <aside aria-label="Mission objectives" className="xl:sticky xl:top-24 xl:self-start">
          <ObjectivesPanel
            mission={mission}
            run={run}
            answeringInStory={storyAnswer?.id}
            onAnswer={(objectiveId, answer) => dispatch({ type: "answer", objectiveId, answer })}
            onHint={(objectiveId) => dispatch({ type: "hint", objectiveId })}
            terminalBlocks={session.blocks}
          />
        </aside>
      </div>

      <ReferenceDrawer
        open={referenceOpen}
        onClose={() => setReferenceOpen(false)}
        missionId={mission.id}
        missionLessonIds={[...mission.concepts, ...mission.debrief.furtherReading]}
        lastCommand={commandOf(session.history.at(-1))}
      />

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
