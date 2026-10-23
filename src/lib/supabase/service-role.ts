import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getEnv } from "@/lib/env";

import type { Database } from "./types";

/**
 * Service-role client — bypasses PostgreSQL Row Level Security entirely.
 *
 * SERVER ONLY. Webhooks and cron jobs only (Stripe webhook handler, seed
 * and maintenance scripts). Never import from a page, layout, Server
 * Action reachable by a browser, or anything that ships to the client.
 */
export function createServiceRoleClient() {
  const { supabase, serviceRoleKey } = getEnv();
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. The service-role client is " +
        "required only by webhooks/cron — set the key in the server " +
        "environment (never in .env.local committed to git).",
    );
  }
  return createSupabaseClient<Database>(supabase.url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
