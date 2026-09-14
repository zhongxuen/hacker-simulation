import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { ArrowRightIcon } from "@/components/ui/icons";
import { SimulatedBadge } from "@/components/ui/simulated-badge";
import { cx } from "@/lib/cx";
import { FIRST_STEP } from "@/lib/next-step";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-wrap items-center gap-3">
        <SimulatedBadge side="bottom" />
        <p className="text-sm text-secondary">Nothing here touches a real computer.</p>
      </div>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Hacker Simulation</h1>
      <p className="text-lg leading-8 text-secondary">
        Learn how hackers think, and how to stop them, starting from zero. You&apos;ll join a team
        of good-guy hackers, solve short story missions, and type your first commands with a
        friendly mentor at your side. No experience needed.
      </p>
      <div className="space-y-3">
        <ButtonLink
          href={FIRST_STEP.href}
          variant="primary"
          size="lg"
          icon={<ArrowRightIcon />}
          className="flex-row-reverse"
        >
          Start your first mission
        </ButtonLink>
        <p className="text-base leading-7 text-secondary">
          No sign-up. Nothing to install. Nothing you do here is saved.{" "}
          <Link
            href="/privacy"
            className={cx("rounded-sm text-accent underline underline-offset-4", FOCUS_RING)}
          >
            What we store
          </Link>
        </p>
      </div>
      <p className="text-sm text-muted">
        Your first mission takes about 8 minutes, and you&apos;ll type your first command in the
        first minute.
      </p>
    </main>
  );
}
