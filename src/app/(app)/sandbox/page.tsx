import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/shell/section-placeholder";
import { getAppSection } from "@/lib/app-sections";
import { FIRST_STEP } from "@/lib/next-step";

export const metadata: Metadata = { title: getAppSection("sandbox").label };

export default function SandboxPage() {
  return (
    <SectionPlaceholder headline="Practice freely. Nothing can break." nextStep={FIRST_STEP}>
      <p>
        The sandbox is a practice space: a pretend network of computers where you can try any
        command as often as you like.
      </p>
      <p>
        Everything in it is simulated, so nothing you do can harm a real computer. If something goes
        wrong, you can start it fresh with one click.
      </p>
    </SectionPlaceholder>
  );
}
