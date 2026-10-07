/**
 * Server-side Stripe client for Slotly (test mode only).
 *
 * SERVER ONLY — never import from a Client Component. Defense in depth
 * alongside `src/lib/env.ts`: `getStripe()` and `verifyWebhookSignature()`
 * both refuse `sk_live_` keys even if env validation were ever bypassed.
 */

import Stripe from "stripe";

import { getEnv } from "./env";

/** Throw unless the key is a test-mode key. Call before any Stripe use. */
export function assertTestMode(key: string = getEnv().STRIPE_SECRET_KEY): void {
  if (key.startsWith("sk_live_")) {
    throw new Error(
      "Stripe live keys are rejected — Slotly runs in test mode only (sk_test_…).",
    );
  }
}

let cached: Stripe | null = null;

/** Lazily construct (and cache) the Stripe client. Throws without env. */
export function getStripe(): Stripe {
  assertTestMode(); // throws on sk_live_ via the default param's getEnv()
  if (!cached) {
    cached = new Stripe(getEnv().STRIPE_SECRET_KEY);
  }
  return cached;
}

/**
 * Verify a Stripe webhook payload. Reads the `stripe-signature` header value
 * passed as `signature`; tolerance is 300s per the technical requirements
 * (constant-time compare happens inside the Stripe SDK).
 */
export function verifyWebhookSignature(rawBody: Buffer, signature: string): Stripe.Event {
  const { STRIPE_WEBHOOK_SECRET } = getEnv();
  assertTestMode();
  return Stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET, 300);
}

/** Reset the cached client — test use only. */
export function __resetStripeClient(): void {
  cached = null;
}
