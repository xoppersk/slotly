"use server";

/**
 * Server Actions for /onboarding. The publish step calls the
 * create_business_setup() SECURITY DEFINER function (migration 00014), which
 * creates the business + owner membership + first service + weekly rules in a
 * single transaction — any failure rolls everything back atomically, so no
 * best-effort cleanup is needed.
 */

import { createClient } from "@/lib/supabase/server";
import { clampDuration, dollarsToCents, type WeeklyDayInput } from "@/lib/management";
import { slugify } from "@/lib/format";

import { checkSlugAvailability } from "../(dashboard)/dashboard/settings/actions";

export type ActionResult = { ok: true } | { ok: false; error: string };

export { checkSlugAvailability };

export interface CreateBusinessInput {
  name: string;
  slug: string;
  timezone: string;
  serviceName: string;
  serviceDurationMinutes: number;
  servicePriceCents: number;
  weeklyHours: WeeklyDayInput[];
}

export async function createBusiness(
  input: CreateBusinessInput,
): Promise<ActionResult & { slug?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in first." };

  const name = input.name.trim();
  const slug = slugify(input.slug);
  const serviceName = input.serviceName.trim();
  if (!name) return { ok: false, error: "Business name is required." };
  if (!slug) return { ok: false, error: "Pick a valid slug for your booking page." };
  if (!serviceName) return { ok: false, error: "Give your first service a name." };

  const weeklyHours = input.weeklyHours.map((d) => ({
    weekday: d.weekday,
    is_closed: d.isClosed,
    open_time: d.openTime,
    close_time: d.closeTime,
  }));

  const { data, error } = await supabase.rpc("create_business_setup", {
    p_name: name,
    p_slug: slug,
    p_timezone: input.timezone || "UTC",
    p_service_name: serviceName,
    p_service_duration_minutes: clampDuration(input.serviceDurationMinutes),
    p_service_price_cents: Math.max(0, Math.round(input.servicePriceCents)),
    p_weekly_hours: weeklyHours,
  });

  if (error || !data) {
    if ((error as { code?: string } | null)?.code === "23505")
      return { ok: false, error: "That slug is taken — try another." };
    return { ok: false, error: "Could not create your business. Please try again." };
  }

  return { ok: true, slug };
}

/** Dollars helper for the wizard's price input. */
export { dollarsToCents };
