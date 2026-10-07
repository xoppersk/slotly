import { cookies, headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type BusinessRow = Database["public"]["Tables"]["businesses"]["Row"];
type MembershipRow = Database["public"]["Tables"]["business_members"]["Row"];

export interface BusinessMembership {
  businessId: string;
  businessName: string;
  businessSlug: string;
  role: "owner" | "staff";
  staffId: string | null;
}

export interface BusinessContext {
  business: BusinessRow;
  membership: { role: "owner" | "staff"; staffId: string | null };
}

/**
 * Owner gate for dashboard Server Components / Server Actions.
 * Returns the context, or `null`-ish when the caller must be redirected away.
 * Callers: no session → redirect to sign-in; staff → redirect to /dashboard;
 * no business → redirect to onboarding.
 */
export async function requireOwner(): Promise<
  | { ok: true; ctx: BusinessContext }
  | { ok: false; reason: "signed-out" | "no-business" | "not-owner" }
> {
  const ctx = await getCurrentBusiness();
  if (!ctx) {
    // Distinguish "signed out" from "signed in with no business".
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return { ok: false, reason: user ? "no-business" : "signed-out" };
  }
  if (ctx.membership.role !== "owner")
    return { ok: false, reason: "not-owner" };
  return { ok: true, ctx };
}

/**
 * Resolves the business the current session is operating in.
 *
 * Reads the session user's `business_members` rows (PostgreSQL RLS on
 * `business_members` scopes them to the signed-in user), then picks:
 *   1. the `?b=` search param (via the `x-slotly-search` middleware header),
 *   2. the `slotly_business` cookie,
 *   3. the first membership.
 *
 * The explicit `?b=` value is only honored when it belongs to one of the
 * user's memberships — an arbitrary id never grants access to another
 * business. Returns `null` when there is no session or no membership (the
 * caller redirects to sign-in or onboarding).
 *
 * Server-only: reads request cookies/headers.
 */
export async function getCurrentBusiness(): Promise<{
  business: BusinessRow;
  membership: { role: "owner" | "staff"; staffId: string | null };
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const memberships = await listMemberships(supabase, user.id);
  if (memberships.length === 0) return null;

  const picked = await pickBusinessId(memberships);
  const chosen =
    memberships.find((m) => m.business_id === picked) ?? memberships[0];
  if (!chosen) return null;

  const { data: business, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", chosen.business_id)
    .single();
  if (error || !business) return null;

  return {
    business,
    membership: { role: chosen.role, staffId: chosen.staff_id },
  };
}

/**
 * All businesses the session user belongs to — drives the business
 * switcher. Same ordering as the pick logic (oldest membership first).
 */
export async function getBusinessMemberships(): Promise<BusinessMembership[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const memberships = await listMemberships(supabase, user.id);
  if (memberships.length === 0) return [];

  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, slug")
    .in(
      "id",
      memberships.map((m) => m.business_id)
    );

  const byId = new Map((businesses ?? []).map((b) => [b.id, b]));
  return memberships.flatMap((m) => {
    const b = byId.get(m.business_id);
    if (!b) return [];
    return [
      {
        businessId: b.id,
        businessName: b.name,
        businessSlug: b.slug,
        role: m.role,
        staffId: m.staff_id,
      },
    ];
  });
}

async function listMemberships(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<MembershipRow[]> {
  const { data, error } = await supabase
    .from("business_members")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data;
}

/** Applies the `?b=` → cookie → first pick order, validating membership. */
async function pickBusinessId(
  memberships: MembershipRow[]
): Promise<string | null> {
  const ids = new Set(memberships.map((m) => m.business_id));

  const headerList = await headers();
  const search = headerList.get("x-slotly-search") ?? "";
  const bParam = new URLSearchParams(search).get("b");
  if (bParam && ids.has(bParam)) return bParam;

  const cookieStore = await cookies();
  const cookieBusiness = cookieStore.get("slotly_business")?.value;
  if (cookieBusiness && ids.has(cookieBusiness)) return cookieBusiness;

  return memberships[0]?.business_id ?? null;
}
