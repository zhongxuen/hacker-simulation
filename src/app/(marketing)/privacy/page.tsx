import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { cx } from "@/lib/cx";
import { FIRST_STEP } from "@/lib/next-step";

export const metadata: Metadata = {
  title: "What we store – Hacker Simulation",
  description:
    "Almost nothing. No sign-up, no accounts, no cookies, and nothing you do in a mission is saved.",
};

const INLINE_LINK = cx("rounded-sm text-accent underline underline-offset-4", FOCUS_RING);

/**
 * "What we store", for a complete beginner. It mirrors the table in
 * md-files/03-app-state-and-privacy.md ("What the app remembers"): keep the two in step when a
 * phase adds a setting or starts sending something.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">What we store</h1>
      <p className="mt-5 text-lg leading-8 text-secondary">
        Almost nothing. There&apos;s no sign-up and no accounts, and nothing you do in a mission is
        saved. Here&apos;s everything Hacker Simulation keeps, where it lives, and for how long.
      </p>

      <div className="mt-10 space-y-6">
        <StoreCard
          title="The mission you're playing"
          where="In this browser tab's memory, only while the tab is open."
          howLong="Until you leave the mission, reload the page, or close the tab. Then it's gone, and your next visit starts fresh."
        >
          Everything about the mission you&apos;re in right now: the practice computer, the commands
          you&apos;ve typed, the goals you&apos;ve ticked off, the hints you&apos;ve opened, what
          your mentor told you, and any notes you&apos;ve made. That&apos;s why every mission fits
          in one sitting, 5 to 20 minutes.
        </StoreCard>

        <StoreCard
          title="Your settings"
          where="In this browser's own storage on your device (called local storage). Never on our computers."
          howLong={
            <>
              Until you press &ldquo;Reset settings&rdquo; on the{" "}
              <Link href="/settings" className={INLINE_LINK}>
                Settings page
              </Link>
              , or clear your browser&apos;s data.
            </>
          }
        >
          A few choices about how the app looks and helps: whether the sidebar is small, how many
          animations you see, whether the terminal shows beginner help, the terminal&apos;s colours,
          prompt and cursor, whether the network map shows as a drawing or a table, whether your
          mentor offers a nudge when you seem stuck, and whether anonymous counts are sent (below).
          New settings will join them as the app grows. They&apos;ll always be choices about how the
          app looks and works, never a record of what you&apos;ve done.
        </StoreCard>

        <StoreCard
          title="Sent, but not kept"
          where="Passed along to write you an answer, then dropped."
          howLong="We don't store any of it."
        >
          When you ask the mentor for something (a hint, an explanation of a line or a word, or a
          look back at a mission you finished), some of your recent commands in that mission go to
          an AI service (a program that writes text) so the answer fits what you tried. For an
          explanation, the line or word you pointed at goes too. For a look back, it&apos;s more of
          your commands, with only the start of what each one printed, plus which goals you ticked
          and how many hints you opened. It&apos;s never sent unless you ask, and nothing in it says
          who you are. It&apos;s used to write the answer and then dropped; we don&apos;t keep it.
          If the mentor is switched off or busy, you still get an answer written ahead of time.
        </StoreCard>

        <StoreCard
          title="Anonymous counts"
          where="Added up by Vercel, the company that runs this website, as totals we can look at. Never a record of one person."
          howLong={
            <>
              Vercel keeps the totals. It tells one visit from another without a cookie, and forgets
              which was which after 24 hours. Turn counts off any time on the{" "}
              <Link href="/settings" className={INLINE_LINK}>
                Settings page
              </Link>
              .
            </>
          }
        >
          To find the parts of a mission that are too hard, we count things like &ldquo;a mission
          was started&rdquo;, &ldquo;this step was ticked&rdquo;, &ldquo;a hint was opened&rdquo;
          and roughly how long the first tick took (in ranges, like &ldquo;1 to 2 minutes&rdquo;).
          We also count which pages are opened and how fast they load. With each count Vercel sees
          what any website sees: the page, the kind of browser and device, and roughly which
          country. It doesn&apos;t keep your internet address. Nothing you type is ever counted: no
          commands, answers or notes. If your browser asks websites not to track it (a setting
          called Do Not Track, or Global Privacy Control), nothing is sent at all.
        </StoreCard>

        <StoreCard title="Never stored, anywhere" where="Nowhere." howLong="Not at all.">
          Finished missions, scores, your name, your email address, what you type, or anything else
          about you. There are no accounts and no database, so there&apos;s nowhere to put them.
        </StoreCard>
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">No cookies</h2>
        <p className="mt-3 text-lg leading-8 text-secondary">
          Cookies are small notes a website asks your browser to keep, often to remember who you
          are. Hacker Simulation doesn&apos;t use any, and neither do the anonymous counts.
          There&apos;s no sign-in, so there&apos;s nothing for a cookie to remember.
        </p>
      </section>

      <div className="mt-12 flex flex-wrap gap-3">
        <ButtonLink href={FIRST_STEP.href} variant="primary">
          Start your first mission
        </ButtonLink>
        <ButtonLink href="/settings" variant="secondary">
          Change your settings
        </ButtonLink>
      </div>
    </main>
  );
}

function StoreCard({
  title,
  where,
  howLong,
  children,
}: {
  title: string;
  where: ReactNode;
  howLong: ReactNode;
  /** What's kept, in plain words. */
  children: ReactNode;
}) {
  return (
    <Card as="section" padding="lg">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-3 leading-7 text-secondary">{children}</p>
      <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-subtle pt-4 sm:grid-cols-[max-content_1fr]">
        <dt className="font-medium text-primary">Where</dt>
        <dd className="leading-7 text-secondary">{where}</dd>
        <dt className="font-medium text-primary">How long</dt>
        <dd className="leading-7 text-secondary">{howLong}</dd>
      </dl>
    </Card>
  );
}
