import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { getAppSection } from "@/lib/app-sections";

export const metadata: Metadata = { title: getAppSection("network").label };

/**
 * The network map lives beside the terminal, in a mission or the sandbox, because nothing is saved
 * between visits: a map here would always be empty. This page says where to find it
 * (md-files/voice-and-tone.md, "Empty state": what will be here, why it's empty, one action).
 */
export default function NetworkPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        Your map of the network
      </h1>
      <div className="mt-4 space-y-4 text-lg leading-8 text-secondary">
        <p>
          A network is a group of computers connected so they can talk to each other. As you
          explore, every computer you find appears on a map, and anything you haven&apos;t found yet
          stays dark.
        </p>
        <p>
          The map lives next to your terminal: in a mission, and in the sandbox. Nothing is saved
          between visits, so each map starts dark and fills in as you go.
        </p>
      </div>

      <div className="mt-10 rounded-lg border border-dashed border-strong p-6">
        <p className="leading-7 text-secondary">
          Want to see one light up now? The sandbox&apos;s Small network has five practice computers
          to find.
        </p>
        <div className="mt-5">
          <ButtonLink
            href="/sandbox"
            variant="secondary"
            icon={<ArrowRightIcon />}
            className="flex-row-reverse"
          >
            Open the sandbox
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
