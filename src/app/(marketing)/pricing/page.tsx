import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";

import { MarketingHeader, MarketingFooter } from "@/components/marketing/MarketingChrome";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing — one plan, every booking",
  description:
    "Slotly pricing: one flat monthly plan per business. No per-booking fees, unlimited services and staff.",
};

const PLANS = [
  {
    name: "Starter",
    price: "$19",
    period: "/month",
    blurb: "For solo providers getting their first online bookings.",
    features: [
      "1 staff member",
      "Unlimited services",
      "Your booking page (yourname.slotly)",
      "Email confirmations + reminders",
      "Deposits via Stripe (test mode)",
    ],
    cta: "Start free trial",
    featured: false,
  },
  {
    name: "Growth",
    price: "$39",
    period: "/month",
    blurb: "For teams that live on their calendar.",
    features: [
      "Unlimited staff",
      "Everything in Starter",
      "Staff time-off management",
      "SMS reminders + confirmations",
      "No-show tracking",
      "Waitlist for fully-booked days",
    ],
    cta: "Start free trial",
    featured: true,
  },
  {
    name: "Scale",
    price: "$79",
    period: "/month",
    blurb: "For multi-location and high-volume books.",
    features: [
      "Everything in Growth",
      "Multiple locations",
      "Advanced reporting + exports",
      "Priority support",
      "Custom domain (book.yourbusiness.com)",
    ],
    cta: "Talk to us",
    featured: false,
  },
];

/**
 * /pricing — Slotly brand marketing page. Light, static, no interaction
 * states beyond CTAs (UI-DESIGN.md §2.10).
 */
export default function PricingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <MarketingHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-24 pt-12 sm:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
          Pricing
        </p>
        <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          One plan per business. No per-booking fees.
        </h1>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">
          Every plan includes unlimited bookings, your public booking page, and
          the full 6-step customer wizard. Start with a 14-day free trial —
          no card required.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={cn(
                "flex flex-col",
                plan.featured && "border-primary ring-1 ring-primary"
              )}
            >
              <CardContent className="flex flex-1 flex-col p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{plan.name}</h2>
                  {plan.featured && (
                    <Badge variant="default">Most popular</Badge>
                  )}
                </div>
                <p className="tnum mt-3 text-4xl font-bold tracking-tight">
                  {plan.price}
                  <span className="text-base font-normal text-muted-foreground">
                    {plan.period}
                  </span>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{plan.blurb}</p>
                <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-success"
                        aria-hidden
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.featured ? "primary" : "outline"}
                  size="lg"
                  asChild
                  className="mt-6"
                >
                  <Link href="/auth/sign-up">{plan.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 rounded-[0.75rem] border border-border bg-card p-6 text-center">
          <h2 className="text-lg font-semibold">Stripe fees, kept honest</h2>
          <p className="tnum mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Slotly never takes a cut of your bookings. Standard Stripe
            processing fees (2.9% + $0.30 in the US) apply to card payments you
            collect.
          </p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
