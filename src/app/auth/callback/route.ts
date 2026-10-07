import { NextRequest, NextResponse } from "next/server";

import { createServerClient } from "@supabase/ssr";

/**
 * /auth/callback — exchanges the OAuth/email code for a session, then
 * redirects to ?next= (default /dashboard).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/auth/sign-in", url.origin));
  }

  let response = NextResponse.redirect(new URL(next, url.origin));
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    response = NextResponse.redirect(
      new URL("/auth/sign-in?error=callback", url.origin)
    );
  }
  return response;
}
