import type { Metadata } from "next";
import "../../styles/site.css";
import { SiteChrome, Tick } from "./_chrome";
import { PLANS as CONFIG_PLANS, type Plan } from "@/lib/config";
import { formatWholeDollars } from "@/lib/format";

export const metadata: Metadata = { title: "Pricing" };

/* F-02 — Pricing. Prices come from src/lib/config.ts PLANS (config-driven;
   Sheku ruled final prices on 2026-10-25 — Solo $0 / Shop $19/mo /
   Studios $19/mo flat per business, 14-day trial). The drawn per-plan
   copy below is presentation only. */

const PLAN_COPY: Record<
  Plan["id"],
  { per: string; blurb: string; cta: string; ink: boolean; chip?: string; features: string[] }
> = {
  starter: {
    per: " forever",
    blurb: "One person taking bookings.",
    cta: "Start free",
    ink: false,
    features: ["1 bookable person", "Booking page and change links", "Email confirmations and reminders", "Deposits"],
  },
  shop: {
    per: " per month",
    blurb: "A shop with a team, up to 5 people.",
    cta: "Start 14-day trial",
    ink: true,
    chip: "Most shops pick this",
    features: [
      "Up to 5 bookable people",
      "Text reminders",
      "Staff app: agenda, time off, check-ins",
      "Book on behalf and waitlist",
      "Everything in Solo",
    ],
  },
  studios: {
    per: " per month",
    blurb: "Two or more locations.",
    cta: "Start 14-day trial",
    ink: false,
    features: ["Unlimited people", "Multiple locations, one login", "Per-location hours and pricing", "Everything in Shop"],
  },
};

const PLANS = CONFIG_PLANS.map((plan) => ({
  ...PLAN_COPY[plan.id],
  name: plan.name,
  price: formatWholeDollars(plan.monthlyPriceCents),
}));

const FAQ = [
  {
    q: "Who keeps the deposit?",
    a: "You do. It’s paid out with your other card payments. Slotly takes no cut of deposits.",
  },
  {
    q: "Do my customers need an account?",
    a: "No. They book with a name, email and phone, and change plans from the link in their confirmation.",
  },
  {
    q: "What happens when the trial ends?",
    a: "You pick a plan or drop to Solo. Your bookings and customers stay put either way.",
  },
  {
    q: "Can I bring my customer list?",
    a: "Yes. Import a CSV from Customers and their history starts from their first Slotly booking.",
  },
];

export default function PricingPage() {
  return (
    <SiteChrome current="pricing">
      <div className="sl-wrap">
        <div className="sl-price-head">
          <h1 className="sl-price-h1">Pay for the chairs you fill</h1>
          <p className="sl-price-lead">
            Start free on your own. Move up when your team does. Deposits go to your bank, minus card processing.
          </p>
        </div>

        <div className="sl-plans">
          {PLANS.map((plan) =>
            plan.ink ? (
              <section key={plan.name} className="sl-plan sl-plan--ink">
                <div className="sl-plan__top">
                  <h2>{plan.name}</h2>
                  {"chip" in plan && plan.chip ? <span className="sl-chip sl-plan__chip">{plan.chip}</span> : <span />}
                </div>
                <p className="sl-plan__price">
                  <span className="amt">{plan.price}</span>
                  <span className="per">{plan.per}</span>
                </p>
                <p className="sl-plan__blurb">{plan.blurb}</p>
                <a href="/sign-up" className="sl-pri sl-pri--linen">
                  {plan.cta}
                </a>
                <ul className="sl-ticks">
                  {plan.features.map((f) => (
                    <li key={f}>
                      <Tick tone="#b9dca5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <section key={plan.name} className="sl-card sl-plan">
                <div className="sl-plan__top">
                  <h2>{plan.name}</h2>
                  <span />
                </div>
                <p className="sl-plan__price">
                  <span className="amt">{plan.price}</span>
                  <span className="per">{plan.per}</span>
                </p>
                <p className="sl-plan__blurb">{plan.blurb}</p>
                <a href="/sign-up" className="sl-sec sl-sec--56">
                  {plan.cta}
                </a>
                <ul className="sl-ticks">
                  {plan.features.map((f) => (
                    <li key={f}>
                      <Tick />
                      {f}
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>

        <section className="sl-faq">
          <h2>Questions owners ask</h2>
          <div className="sl-faq__grid">
            {FAQ.map((item) => (
              <div key={item.q} className="sl-card sl-faq__card">
                <h3>{item.q}</h3>
                <p>{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
