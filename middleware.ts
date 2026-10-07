import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  // Server Components (incl. route-group layouts) cannot read `searchParams`;
  // expose the raw query string so getCurrentBusiness() can honor `?b=` for
  // business switching.
  response.headers.set("x-slotly-search", request.nextUrl.search);
  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every route except Next.js internals and static assets.
     * Auth state changes are reflected immediately because the session
     * cookie is refreshed here.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
