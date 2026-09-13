import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/shell/section-placeholder";
import { getAppSection } from "@/lib/app-sections";
import { FIRST_STEP } from "@/lib/next-step";

export const metadata: Metadata = { title: getAppSection("campaign").label };

export default function CampaignPage() {
  return (
    <SectionPlaceholder headline="Your story starts here" nextStep={FIRST_STEP}>
      <p>
        You&apos;re the newest recruit on a team of good-guy hackers. Companies hire the team to
        find the weak spots in their computers before criminals do, and always with permission.
      </p>
      <p>
        The campaign is your path through the story. Each mission teaches you one new skill and
        moves the story forward.
      </p>
    </SectionPlaceholder>
  );
}
