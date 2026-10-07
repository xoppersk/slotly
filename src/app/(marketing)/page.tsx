import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Slotly marketing home — Phase 0 skeleton. Hero + product loop visual
 * placeholder + CTA. The full marketing pages are finished in the
 * marketing phase; this keeps the root route real and styled.
 */
export default function MarketingHomePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5">
        <Link href="/" className="flex items-center gap-2" aria-label="Slotly home">
          <span
            aria-hidden
            className="flex size-8 items-center justify-center rounded-[0.5rem] bg-primary text-primary-foreground"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </span>
          <span className="text-lg font-semibold tracking-tight">Slotly</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/auth/sign-in">Sign in</Link>
          </Button>
          <Button variant="primary" asChild>
            <Link href="/auth/sign-up">Get started</Link>
          </Button>
        </nav>
      </header>

      {/* Hero */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 pb-24 pt-16 text-center sm:pt-24">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
          Booking for service businesses
        </p>
        <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
          The slot you want, simply.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Slotly is the calm, dependable front desk your business never had.
          Customers pick a time; you fill your day.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button variant="primary" size="lg" asChild>
            <Link href="/auth/sign-up">Start booking</Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="#how-it-works">See how it works</Link>
          </Button>
        </div>

        {/* Product loop visual placeholder */}
        <div
          id="how-it-works"
          className="mt-16 w-full scroll-mt-16"
          aria-label="Product preview placeholder"
        >
          <Card>
            <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-3 p-8">
              <div className="flex gap-2" aria-hidden>
                {["9:00", "9:30", "10:00", "10:30", "11:00"].map((t, i) => (
                  <span
                    key={t}
                    className={
                      i === 2
                        ? "rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground tnum"
                        : "rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground tnum"
                    }
                  >
                    {t}
                  </span>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                The booking wizard goes here — week strip, slot pills, and a
                timezone-aware confirmation.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <p className="mx-auto max-w-5xl px-4 text-sm text-muted-foreground">
          Slotly — the slot you want, simply.
        </p>
      </footer>
    </div>
  );
}
