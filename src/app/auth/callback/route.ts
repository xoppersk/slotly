import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback — every emailed link (confirm sign-up, magic link, password
 * recovery) lands here with a PKCE `code`. We exchange it for a session
 * (cookies set by the server client) and forward to `next`:
 *
 * - confirm sign-up / magic link → `next` (default /app; /app entry then
 * routes brand-new owners with no business to /onboarding)
 * - recovery → `next=/reset-password` (set by requestPasswordReset)
 *
 * Failures go back to /sign-in with the reason in `?error=` — never silent.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const rawNext = searchParams.get("next") ?? "/app";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("\\")
      ? rawNext
      : "/app";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/reset-password`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(
        "That link is invalid or has expired. Sign in, or request a fresh link.",
      )}`,
    );
  }

  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error");
  return NextResponse.redirect(
    `${origin}/sign-in?error=${encodeURIComponent(
      providerError ?? "That link is invalid or has expired.",
    )}`,
  );
}
