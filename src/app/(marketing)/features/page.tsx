import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  Users,
  CreditCard,
  BellRing,
  LayoutDashboard,
  Link2,
} from "lucide-react";

import { MarketingHeader, MarketingFooter } from "@/components/marketing/MarketingChrome";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Features — everything a front desk does",
  description:
    "Slotly features: online booking pages, smart availability, Stripe deposits, reminders, magic-link management, and an owner dashboard.",
};

const FEATURES = [
  {
    icon: Link2,
    title: "Your booking page",
    body: "A branded page at your own link — services, team, hours, and one-tap booking. Per-business accent colors, no app to install.",
  },
  {
    icon: CalendarClock,
    title: "Availability that thinks",
    body: "Weekly hours, date overrides, blackouts, staff time-off, buffers, lead times, and advance windows — customers only ever see genuinely free slots.",
  },
  {
    icon: Users,
    title: "First-available or your favorite",
    body: "Customers pick the fastest opening across the team or their preferred provider, with next-available times shown on every staff card.",
  },
  {
    icon: CreditCard,
    title: "Deposits and full payments",
    body: "Per-service policies — none, deposit, or full price — with a 10-minute slot hold, Stripe Payment Element, and same-key retries on declines.",
  },
  {
    icon: BellRing,
    title: "Reminders that reduce no-shows",
    body: "Automatic 24-hour and 2-hour reminders by email, with opt-in at booking and SMS on the way.",
  },
  {
    icon: LayoutDashboard,
    title: "Magic-link self-service",
    body: "Customers reschedule or cancel from their confirmation link — no accounts, no phone calls. Cancellations inside the free window auto-refund.",
  },
];

/**
 * /features — Slotly brand marketing page (UI-DESIGN.md §2.10).
 */
export default function FeaturesPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <MarketingHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-24 pt-12 sm:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
          Features
        </p>
        <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          Everything a great front desk does.
        </h1>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">
          Booking, payments, reminders, and rescheduling — one calm system your
          customers will actually enjoy using.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title}>
                <CardContent className="flex flex-col gap-3 p-6">
                  <span
                    aria-hidden
                    className="flex size-10 items-center justify-center rounded-[0.5rem] bg-primary/10 text-primary"
                  >
                    <Icon className="size-5" />
                  </span>
                  <h2 className="text-[15px] font-semibold">{feature.title}</h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {feature.body}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 flex flex-col items-center gap-4 rounded-[0.75rem] border border-border bg-card p-8 text-center">
          <h2 className="text-xl font-semibold tracking-tight">
            Ready to fill your day?
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Set up your business, add a service, and share your booking link —
            most owners are bookable in under 15 minutes.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="primary" size="lg" asChild>
              <Link href="/auth/sign-up">Create your booking page</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
