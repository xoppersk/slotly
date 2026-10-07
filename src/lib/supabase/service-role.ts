import { createClient } from "@supabase/supabase-js";

import type { Database } from "./types";

/**
 * Service-role Supabase client — bypasses Row Level Security. Server only.
 *
 * Use ONLY for operations that cannot run as the signed-in user: the Slotly
 * Stripe webhook (booking confirmation + hold expiry) and server-only cron
 * tasks. Never import from a Client Component, and never leak the key — it
 * is full database access.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Add it to .env.local (see .env.example).",
    );
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
