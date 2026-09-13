import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/shell/section-placeholder";
import { getAppSection } from "@/lib/app-sections";
import { FIRST_STEP } from "@/lib/next-step";

export const metadata: Metadata = { title: getAppSection("missions").label };

export default function MissionsPage() {
  return (
    <SectionPlaceholder headline="Short missions, one skill at a time" nextStep={FIRST_STEP}>
      <p>
        A mission is a short story episode, 5 to 20 minutes long. You get a briefing, try something
        hands-on, and see right away whether it worked.
      </p>
      <p>Hints are free, and mistakes never cost you anything.</p>
    </SectionPlaceholder>
  );
}
