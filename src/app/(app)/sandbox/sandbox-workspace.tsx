"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { Callout } from "@/components/ui/callout";
import { SANDBOX_SCENARIOS, type SandboxScenario } from "@/content/sandbox";
import { NetworkMapPanel } from "@/features/network-visualizer";
import { CommandCheatSheet, Terminal, useTerminalSession } from "@/features/terminal";
import { cx } from "@/lib/cx";
import { selectTopology } from "@/sim";
import type { SimEvent } from "@/sim/types";

/** Keyboard focus on a radio that's visually hidden inside its label shows on the label. */
const LABEL_FOCUS_RING =
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus-ring";

/**
 * The sandbox: pick a practice machine, then use the terminal on it with no objectives. Switching
 * machines starts that machine fresh; nothing is kept between visits.
 */
export function SandboxWorkspace() {
  const [scenarioId, setScenarioId] = useState(SANDBOX_SCENARIOS[0]?.id ?? "");
  const scenario = SANDBOX_SCENARIOS.find((candidate) => candidate.id === scenarioId);
  const name = useId();

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-3 font-medium text-primary">Pick a practice machine</legend>
        <div className="grid gap-3 md:grid-cols-3">
          {SANDBOX_SCENARIOS.map((option) => (
            <label
              key={option.id}
              className={cx(
                "flex cursor-pointer gap-3 rounded-lg border border-subtle bg-surface-raised p-4 hover:border-strong",
                "has-checked:border-accent has-checked:bg-accent-subtle",
                LABEL_FOCUS_RING,
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={option.id === scenarioId}
                onChange={() => setScenarioId(option.id)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="mt-1 grid size-4.5 shrink-0 place-items-center rounded-full border-2 border-strong peer-checked:border-accent peer-checked:after:size-2 peer-checked:after:rounded-full peer-checked:after:bg-accent"
              />
              <span className="min-w-0">
                <span className="block font-medium text-primary">{option.title}</span>
                <span className="mt-1 block text-sm leading-6 text-secondary">
                  {option.description}
                </span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">Switching machines starts the new one fresh.</p>
      </fieldset>

      {scenario && <SandboxSession key={scenario.id} scenario={scenario} />}
    </div>
  );
}

function SandboxSession({ scenario }: { scenario: SandboxScenario }) {
  // Every event since the machine started, for the map's "found by" lines, and the learner's notes
  // on hosts. Both live in memory only, like everything in the sandbox.
  const [events, setEvents] = useState<readonly SimEvent[]>([]);
  const [notes, setNotes] = useState<Readonly<Record<string, string>>>({});
  const onEvents = useCallback(
    (latest: readonly SimEvent[]) => setEvents((previous) => [...previous, ...latest]),
    [],
  );
  const session = useTerminalSession({
    scenario: scenario.scenario,
    seed: scenario.seed,
    onEvents,
  });
  const topology = useMemo(() => selectTopology(session.sim), [session.sim]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        <Terminal session={session} outputClassName="h-[28rem]" />
        {scenario.showMap && (
          <NetworkMapPanel
            topology={topology}
            events={events}
            notes={notes}
            onNoteChange={(hostId, text) =>
              setNotes((previous) => ({ ...previous, [hostId]: text }))
            }
            exportName={scenario.title}
          />
        )}
      </div>

      <aside className="space-y-6" aria-label="Help for this machine">
        <Callout kind="tip" title="Nothing can break here. Try anything.">
          <p>
            This is a practice machine with no goals to finish. Delete things, change things, get
            lost: Reset machine puts everything back.
          </p>
        </Callout>
        <section
          aria-labelledby="try-this-title"
          className="rounded-xl border border-subtle bg-surface-raised p-4"
        >
          <h2 id="try-this-title" className="text-sm font-semibold tracking-wide">
            Try this first
          </h2>
          <ul className="mt-3 space-y-3">
            {scenario.tryThis.map((idea) => (
              <li key={idea.command}>
                <code className="font-mono text-sm text-accent">{idea.command}</code>
                <p className="text-sm leading-6 text-secondary">{idea.why}</p>
              </li>
            ))}
          </ul>
        </section>
        <CommandCheatSheet />
      </aside>
    </div>
  );
}
