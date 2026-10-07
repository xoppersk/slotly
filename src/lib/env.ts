/**
 * Server-side environment validation for Slotly.
 *
 * SERVER ONLY — never import from a Client Component. Call `getEnv()` at
 * the top of Server Components, Route Handlers, and Server Actions that
 * need secrets; it caches after the first call so validation runs once.
 *
 * Stripe is TEST MODE ONLY per the product spec: a live key throws.
 */

type Env = {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  STRIPE_SECRET_KEY: string;
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  RESEND_API_KEY: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_FROM_NUMBER: string;
  NEXT_PUBLIC_ENABLE_SMS: string;
  APP_URL: string;
  CRON_SECRET: string;
};

const REQUIRED: (keyof Env)[] = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "APP_URL",
  "CRON_SECRET",
];

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. See .env.example.`,
    );
  }

  // Slotly is test-mode only: refuse to boot with a live Stripe key.
  const stripeKey = process.env.STRIPE_SECRET_KEY!;
  if (stripeKey.startsWith("sk_live_")) {
    throw new Error(
      "STRIPE_SECRET_KEY must be a test-mode key (sk_test_…) per the Slotly spec. " +
        "Live keys are rejected at startup.",
    );
  }

  cached = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    STRIPE_SECRET_KEY: stripeKey,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET!,
    RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ?? "",
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ?? "",
    TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER ?? "",
    NEXT_PUBLIC_ENABLE_SMS: process.env.NEXT_PUBLIC_ENABLE_SMS ?? "false",
    APP_URL: process.env.APP_URL!,
    CRON_SECRET: process.env.CRON_SECRET!,
  };
  return cached;
}

/** Reset the cache — test use only. */
export function __resetEnvCache() {
  cached = null;
}
