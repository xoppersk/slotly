import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseEnv } from "@/lib/env";

import type { Database } from "./types";

/**
 * Server-side Supabase client. Creates a fresh client per request so auth
 * cookies stay scoped to the current request — never share across requests.
 *
 * Use in Server Components, Route Handlers, and Server Actions. Row Level
 * Security enforces authorization at the PostgreSQL level: with a session
 * cookie the client acts as that user; without one it acts as anon.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component where setting cookies is not
          // allowed. The middleware refreshes the session instead.
        }
      },
    },
  });
}
