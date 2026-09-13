import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/shell/section-placeholder";
import { getAppSection } from "@/lib/app-sections";
import { FIRST_STEP } from "@/lib/next-step";

export const metadata: Metadata = { title: getAppSection("network").label };

export default function NetworkPage() {
  return (
    <SectionPlaceholder headline="Your map of the network" nextStep={FIRST_STEP}>
      <p>
        A network is a group of computers connected so they can talk to each other. As you explore
        during missions, every computer you find appears on this map.
      </p>
      <p>
        Anything you haven&apos;t found yet stays dark, so the map shows how far you&apos;ve come.
      </p>
    </SectionPlaceholder>
  );
}
