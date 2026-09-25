import Link from "next/link";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { cx } from "@/lib/cx";

const FOOTER_LINK = cx("rounded-sm hover:text-primary", FOCUS_RING);

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {children}
      <footer className="border-t border-subtle px-6 py-6">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm leading-6 text-muted">
          <p>Everything here is simulated. Nothing touches a real computer.</p>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              <li>
                <Link href="/" className={FOOTER_LINK}>
                  Home
                </Link>
              </li>
              <li>
                <Link href="/privacy" className={FOOTER_LINK}>
                  What we store
                </Link>
              </li>
              <li>
                {/* The sibling game: the same world, from the blue team's side. */}
                <a href="https://forensics-simulation.vercel.app" className={FOOTER_LINK}>
                  Candlewright: Incident Room, the blue team&apos;s cases
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </>
  );
}
