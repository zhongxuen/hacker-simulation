import type { Metadata } from "next";
import Link from "next/link";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { getAppSection } from "@/lib/app-sections";
import { cx } from "@/lib/cx";
import { LazyTerminalPlayground } from "./lazy-terminal-playground";

export const metadata: Metadata = { title: getAppSection("terminal").label };

export default function TerminalPage() {
  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Talk to a computer by typing
        </h1>
        <div className="mt-4 space-y-4 text-lg leading-8 text-secondary">
          <p>
            A terminal is a window where you type commands instead of clicking buttons. It&apos;s
            how security professionals work with computers every day.
          </p>
          <p>
            This one is connected to a practice computer, so nothing you type can harm anything. For
            more machines to explore, try the{" "}
            <Link
              href="/sandbox"
              className={cx("rounded-sm text-accent underline underline-offset-4", FOCUS_RING)}
            >
              sandbox
            </Link>
            .
          </p>
        </div>
      </div>
      <LazyTerminalPlayground />
    </div>
  );
}
