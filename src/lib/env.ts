/**
 * Environment access for Slotly.
 *
 * `getSupabaseEnv()` — the public PostgreSQL/Auth config (URL + anon key).
 * These two values are NEXT_PUBLIC_ (safe in the browser); PostgreSQL Row
 * Level Security and JWT verification are what protect the data, not key
 * secrecy. This function is import-safe from client and server code and is
 * the ONLY source the Supabase clients in `src/lib/supabase/` read from.
 *
 * `getEnv()` — server-only secrets (service-role key, Stripe test keys,
 * Resend/Twilio, cron). NEVER import it from a Client Component. Adapted
 * from v1: v1 required every secret at boot; v2 boots with only the
 * Supabase pair + APP_URL because no Stripe/Resend/Twilio keys exist in
 * production yet. The Stripe test-mode-only guard is preserved.
 */

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

let cachedSupabaseEnv: SupabaseEnv | null = null;

export function getSupabaseEnv(): SupabaseEnv {
  if (cachedSupabaseEnv) return cachedSupabaseEnv;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    const missing = [
      !url ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !anonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : null,
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `Missing required environment variable(s): ${missing}. ` +
        `Set them in .env.local (see .env.example) — Slotly cannot reach ` +
        `its PostgreSQL database without them.`,
    );
  }

  cachedSupabaseEnv = { url, anonKey };
  return cachedSupabaseEnv;
}

export interface ServerEnv {
  supabase: SupabaseEnv;
  /** Service-role key: bypasses Row Level Security. Server only. */
  serviceRoleKey: string | null;
  stripeSecretKey: string | null;
  stripePublishableKey: string | null;
  stripeWebhookSecret: string | null;
  resendApiKey: string | null;
  twilioAccountSid: string | null;
  twilioAuthToken: string | null;
  twilioFromNumber: string | null;
  smsEnabled: boolean;
  appUrl: string;
  cronSecret: string | null;
}

let cachedServerEnv: ServerEnv | null = null;

/** Server only — throws on a live Stripe key (Slotly is test-mode only). */
export function getEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? null;
  if (stripeSecretKey?.startsWith("sk_live_")) {
    throw new Error(
      "STRIPE_SECRET_KEY must be a test-mode key (sk_test_…) per the Slotly spec. " +
        "Live keys are rejected at startup.",
    );
  }

  cachedServerEnv = {
    supabase: getSupabaseEnv(),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? null,
    stripeSecretKey,
    stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? null,
    resendApiKey: process.env.RESEND_API_KEY ?? null,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? null,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? null,
    twilioFromNumber: process.env.TWILIO_FROM_NUMBER ?? null,
    smsEnabled: process.env.NEXT_PUBLIC_ENABLE_SMS === "true",
    appUrl: process.env.APP_URL ?? "http://localhost:3000",
    cronSecret: process.env.CRON_SECRET ?? null,
  };
  return cachedServerEnv;
}

/** Reset the caches — test use only. */
export function __resetEnvCache() {
  cachedSupabaseEnv = null;
  cachedServerEnv = null;
}
