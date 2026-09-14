import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { ArrowRightIcon, PlayIcon } from "@/components/ui/icons";
import { getMissionById } from "@/features/missions/server";

interface TryItProps {
  /** The mission's id: `net-01`. */
  mission: string;
  /** One line on what the learner will do there. Defaults to the mission's hook. */
  children?: ReactNode;
}

/**
 * `<TryIt mission="net-01" />`: a deep link from a lesson into the mission that puts it into
 * practice, with the mission's name, hook and time. Server only: it reads the mission catalog.
 *
 * An unknown id is a bug in the content, like an unknown <Term>: it throws outside production (the
 * lesson tests render every lesson) and renders nothing in production.
 */
export function TryIt({ mission: id, children }: TryItProps) {
  const mission = getMissionById(id);
  if (!mission) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(`<TryIt mission="${id}"> doesn't match any mission in src/content/missions.`);
    }
    return null;
  }

  return (
    <Card href={`/missions/${mission.slug}`} className="mt-8 flex items-start gap-4">
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-subtle text-accent [&_svg]:size-5"
      >
        <PlayIcon />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-accent">Try it in a mission</span>
        <span className="mt-1 block text-lg font-semibold">{mission.title}</span>
        <span className="mt-1 block leading-7 text-secondary">{children ?? mission.hook}</span>
        <span className="mt-2 block text-sm text-muted">
          About {mission.estimatedMinutes} minutes
        </span>
      </span>
      <ArrowRightIcon aria-hidden="true" className="mt-1 size-5 shrink-0 text-accent" />
    </Card>
  );
}
