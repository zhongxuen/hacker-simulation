import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/shell/section-placeholder";
import { FIRST_STEP } from "@/lib/next-step";

// Until phase 06 loads missions from src/content, the only mission page is the first one, where
// "Start here" points. Any other slug is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ slug: "intro-01" }];
}

export const metadata: Metadata = { title: FIRST_STEP.title };

export default function MissionPage() {
  return (
    <SectionPlaceholder
      headline={FIRST_STEP.title}
      status="We're still building this mission. Check back soon to play it."
    >
      <p>
        Your first mission. You&apos;ll meet the team, learn the rules every good-guy hacker
        follows, and find out what you&apos;ll be working on. It takes about 8 minutes.
      </p>
    </SectionPlaceholder>
  );
}
