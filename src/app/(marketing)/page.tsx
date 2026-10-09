import Link from "next/link";
import { ArrowRight, CalendarCheck, Clock, CreditCard, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  MarketingHeader,
  MarketingFooter,
  SlotlyLogo,
} from "@/components/marketing/MarketingChrome";

/**
 * Slotly marketing home (Flagship UI Designs · Slotly · Marketing).
 *
 * Hospitality voice, Newsreader display type: time-themed hero, the product
 * loop visual (service → staff → slot → confirm), social proof strip, and
 * the "Create your booking page" CTA. No interaction states beyond CTAs.
 */

const LOOP_STEPS = [
  {
    icon: CalendarCheck,
    step: "Service",
    text: "Customers pick what they need — duration and price up front.",
  },
  {
    icon: Users,
    step: "Staff",
    text: "They choose their favorite specialist, or the first available.",
  },
  {
    icon: Clock,
    step: "Slot",
    text: "One unmistakable slot grid. No dead ends, ever.",
  },
  {
    icon: CreditCard,
    step: "Confirm",
    text: "Deposit or pay-at-visit — then a confirmation that feels certain.",
  },
];

const PROOF = [
  {
    quote:
      "Thursday used to be phone-tag chaos. Now the day just fills itself.",
    name: "Micah",
    detail: "Harbor & Pine Barbershop",
  },
  {
    quote:
      "Customers book at midnight. I wake up to a full chair and zero voicemails.",
    name: "Nia",
    detail: "Harbor & Pine Barbershop",
  },
  {
    quote:
      "The no-show rate dropped the week we turned on reminders.",
    name: "Andre",
    detail: "Harbor & Pine Barbershop",
  },
];

export default function MarketingHomePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <MarketingHeader />

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 pb-16 pt-16 text-center sm:pt-24">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
            Booking for service businesses
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl leading-[1.05] sm:text-6xl">
            A better appointment starts with the right time.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Slotly is the calm, dependable front desk your business never
            had — the open calendar. Customers pick a time; you fill your
            day.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button variant="primary" size="lg" asChild>
              <Link href="/auth/sign-up">
                Create your booking page
                <ArrowRight className="ml-1 size-4" aria-hidden />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/harbor-and-pine">See booking journey</Link>
            </Button>
          </div>
          <p className="tnum mt-4 text-sm text-muted-foreground">
            Free 14-day trial · No card required · Cancel anytime
          </p>
        </section>

        {/* Product loop visual: service → staff → slot → confirm */}
        <section
          aria-label="How Slotly works"
          className="border-y border-border bg-card"
        >
          <div className="mx-auto w-full max-w-5xl px-4 py-14">
            <h2 className="text-center text-2xl sm:text-3xl">
              One decision per step
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
              The booking flow asks exactly one question at a time — service,
              staff, time, details — then confirms with certainty.
            </p>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {LOOP_STEPS.map(({ icon: Icon, step, text }, i) => (
                <li key={step}>
                  <Card className="h-full">
                    <CardContent className="flex flex-col gap-3 p-5">
                      <div className="flex items-center justify-between">
                        <span
                          aria-hidden
                          className="flex size-10 items-center justify-center rounded-[0.5rem] bg-primary/10 text-primary"
                        >
                          <Icon className="size-5" />
                        </span>
                        <span className="tnum text-xs font-semibold text-muted-foreground">
                          {i + 1} / 4
                        </span>
                      </div>
                      <h3 className="text-lg">{step}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {text}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
            {/* Signature slot strip */}
            <div
              className="mt-8 flex flex-wrap items-center justify-center gap-2"
              aria-hidden
            >
              {["9:00 AM", "9:45 AM", "10:30 AM", "11:15 AM"].map((t, i) => (
                <span
                  key={t}
                  className={
                    i === 0
                      ? "tnum inline-flex min-h-[48px] items-center rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-[inset_0_0_0_2px_var(--card)]"
                      : i === 2
                        ? "tnum inline-flex min-h-[48px] items-center rounded-full bg-muted px-5 text-sm text-muted-foreground line-through"
                        : "tnum inline-flex min-h-[48px] items-center rounded-full border border-border bg-card px-5 text-sm font-medium"
                  }
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Social proof */}
        <section aria-label="Loved by service businesses" className="mx-auto w-full max-w-5xl px-4 py-14">
          <h2 className="text-center text-2xl sm:text-3xl">
            The front desk that never sleeps
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {PROOF.map((p) => (
              <figure key={p.name} className="rounded-[0.75rem] border border-border bg-card p-5">
                <blockquote className="font-display text-lg leading-snug">
                  “{p.quote}”
                </blockquote>
                <figcaption className="mt-4 text-sm">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-muted-foreground">{p.detail}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border bg-summary">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-16 text-center">
            <SlotlyLogo className="size-12 [&_svg]:size-7" />
            <h2 className="mt-4 max-w-xl text-3xl sm:text-4xl">
              Open your calendar tonight.
            </h2>
            <p className="mt-3 max-w-md text-muted-foreground">
              Set up your services, hours, and team in under fifteen minutes —
              take your first online booking tomorrow morning.
            </p>
            <Button variant="primary" size="lg" asChild className="mt-6">
              <Link href="/auth/sign-up">
                Create your booking page
                <ArrowRight className="ml-1 size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
