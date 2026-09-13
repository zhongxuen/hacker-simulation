import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/shell/section-placeholder";
import { getAppSection } from "@/lib/app-sections";
import { FIRST_STEP } from "@/lib/next-step";

export const metadata: Metadata = { title: getAppSection("terminal").label };

export default function TerminalPage() {
  return (
    <SectionPlaceholder headline="Talk to a computer by typing" nextStep={FIRST_STEP}>
      <p>
        A terminal is a window where you type commands instead of clicking buttons. It&apos;s how
        security professionals work with computers every day.
      </p>
      <p>
        You&apos;ll start with commands like <code className="font-mono text-primary">ls</code>,
        which lists the files in a folder, and a guide will show you what to type.
      </p>
    </SectionPlaceholder>
  );
}
