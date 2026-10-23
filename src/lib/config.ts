/**
 * App-wide configuration for Slotly.
 *
 * PLANS: pricing is CONFIG-DRIVEN ONLY. Sheku has not ruled final prices —
 * the defaults below are the standing placeholders (Solo $0 / Shop $24 /
 * Studios $59 per month). Override per-environment with
 * NEXT_PUBLIC_PLAN_STARTER_CENTS / NEXT_PUBLIC_PLAN_SHOP_CENTS /
 * NEXT_PUBLIC_PLAN_STUDIOS_CENTS. Never hard-code a plan price in a page.
 */

/** PLANS_ARE_PLACEHOLDER = true — prices are placeholders until Sheku rules. */
export const PLANS_ARE_PLACEHOLDER = true;

export const APP_NAME = "Slotly";
export const APP_TAGLINE = "Booking pages for service businesses";

export interface Plan {
  id: "starter" | "shop" | "studios";
  name: string;
  /** Monthly price in integer cents (money is always integer cents). */
  monthlyPriceCents: number;
  blurb: string;
  features: string[];
}

function priceOverride(envVar: string | undefined, fallback: number): number {
  if (envVar === undefined || envVar === "") return fallback;
  const parsed = Number.parseInt(envVar, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Solo",
    monthlyPriceCents: priceOverride(
      process.env.NEXT_PUBLIC_PLAN_STARTER_CENTS,
      0,
    ),
    blurb: "For one-person businesses getting booked online.",
    features: [
      "1 staff member",
      "Unlimited services",
      "Public booking page",
      "Email confirmations and reminders",
    ],
  },
  {
    id: "shop",
    name: "Shop",
    monthlyPriceCents: priceOverride(process.env.NEXT_PUBLIC_PLAN_SHOP_CENTS, 2400),
    blurb: "For small teams that live on the calendar.",
    features: [
      "Up to 5 staff members",
      "Everything in Solo",
      "Deposits and no-show protection",
      "SMS reminders",
      "Customer history and notes",
    ],
  },
  {
    id: "studios",
    name: "Studios",
    monthlyPriceCents: priceOverride(
      process.env.NEXT_PUBLIC_PLAN_STUDIOS_CENTS,
      5900,
    ),
    blurb: "For multi-chair shops and multi-location studios.",
    features: [
      "Unlimited staff members",
      "Everything in Shop",
      "Multiple locations",
      "Advanced availability rules",
      "Priority support",
    ],
  },
];

export function getPlan(id: Plan["id"]): Plan {
  const plan = PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`Unknown plan id: ${id}`);
  return plan;
}
