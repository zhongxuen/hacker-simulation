"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlayIcon } from "@/components/ui/icons";
import { SINGLE_COMPUTER } from "@/content/sandbox/single-computer";
import { Terminal, useTerminalSession } from "@/features/terminal";

/** A terminal on the Range's single practice computer, with the guided tour a click away. */
export function TerminalPlayground() {
  const session = useTerminalSession({
    scenario: SINGLE_COMPUTER.scenario,
    seed: SINGLE_COMPUTER.seed,
  });
  const [tourRequest, setTourRequest] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" icon={<PlayIcon />} onClick={() => setTourRequest((n) => n + 1)}>
          Take the one-minute tour
        </Button>
        <p className="text-secondary">
          Or start typing: <code className="font-mono text-primary">ls</code> is a good first
          command.
        </p>
      </div>
      <Terminal session={session} tourRequest={tourRequest} outputClassName="h-[26rem]" />
    </div>
  );
}
