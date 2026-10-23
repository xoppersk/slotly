import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

import { getSupabaseEnv } from "@/lib/env";

import type { Database } from "./types";

export interface UpdateSessionResult {
  response: NextResponse;
  /** The JWT-verified user for this request, or null when signed out. */
  user: User | null;
}

/**
 * Refreshes the Supabase Auth session cookie on every request and reports
 * the verified user so `src/middleware.ts` can apply route guards.
 * Must run in middleware so Server Components always see a fresh session.
 *
 * (v1's helper returned only the response; v2 also returns the user —
 * `supabase.auth.getUser()` revalidates the JWT with the Auth server, it
 * does not trust the cookie blindly.)
 */
export async function updateSession(
  request: NextRequest,
): Promise<UpdateSessionResult> {
  let supabaseResponse = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response: supabaseResponse, user };
}
