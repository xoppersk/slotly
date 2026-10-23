import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "@/lib/env";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Slotly middleware (Next 16 convention: `middleware.ts` at src/ root).
 *
 * 1. Refreshes the Supabase Auth session cookie on every matched request
 * (via updateSession) so Server Components always see a fresh JWT.
 * 2. Route guards:
 * - Unauthenticated requests to /app/*, /staff/*, /dev/* redirect to
 * /sign-in?next=<original path+query>.
 * - Authenticated users hitting /sign-in or /sign-up redirect to /app.
 *
 * Public booking pages (/b/*) must work signed-out: middleware runs on
 * them only to reject unknown slugs with a hard 404 (see below), never
 * to guard. Public API routes (/api/public/*) are excluded entirely.
 */

const PROTECTED_PREFIXES = ["/app", "/staff", "/dev"] as const;
const AUTH_PAGES = ["/sign-in", "/sign-up"] as const;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((page) => pathname === page);
}

/** Copy refreshed session cookies onto a redirect response. */
function withSessionCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

/**
 * Public booking pages: does this slug exist in `businesses_public`
 * (booking page enabled)? Returns null when the check itself fails
 * (network/DB error) — the caller then passes the request through and
 * the booking layout's own lookup renders the not-found page.
 */
async function bookingSlugExists(slug: string): Promise<boolean | null> {
  try {
    const { url, anonKey } = getSupabaseEnv();
    const res = await fetch(
      `${url}/rest/v1/businesses_public?slug=eq.${encodeURIComponent(slug)}&select=slug`,
      {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as unknown[];
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public booking pages stay signed-out accessible, but an unknown slug
  // must return a REAL 404 status. Under Partial Prerendering the layout's
  // notFound() alone streams the not-found UI with a 200 (soft 404), so the
  // existence check happens here: unknown slug → rewrite to an unmatched
  // path, which Next answers with the not-found page and a 404 status.
  const bookingSlug = pathname.match(/^\/b\/([^/]+)/)?.[1];
  if (bookingSlug) {
    const exists = await bookingSlugExists(decodeURIComponent(bookingSlug));
    if (exists === false) {
      const notFoundUrl = request.nextUrl.clone();
      notFoundUrl.pathname = "/404";
      notFoundUrl.search = "";
      return NextResponse.rewrite(notFoundUrl);
    }
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);

  if (!user && isProtectedPath(pathname)) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/sign-in";
    signInUrl.search = "";
    signInUrl.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`,
    );
    return withSessionCookies(response, NextResponse.redirect(signInUrl));
  }

  if (user && isAuthPage(pathname)) {
    const appUrl = request.nextUrl.clone();
    appUrl.pathname = "/app";
    appUrl.search = "";
    return withSessionCookies(response, NextResponse.redirect(appUrl));
  }

  // Server Components cannot read `searchParams` in layouts; expose the raw
  // query string (v1 behaviour — business switching honours `?b=`).
  response.headers.set("x-slotly-search", request.nextUrl.search);
  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every route except:
     * - Next.js internals (_next/static, _next/image) and favicon
     * - static asset extensions (svg/png/jpg/jpeg/gif/webp/ico/fonts)
     * - public API routes: /api/public/*
     * Public booking pages (/b/*) DO run through middleware, but only for
     * the slug-existence check above — never for auth guards.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/public/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)$).*)",
  ],
};
