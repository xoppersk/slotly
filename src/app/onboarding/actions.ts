"use server";

/**
 * Onboarding actions. `completeOnboarding` calls the PostgreSQL function
 * `create_business_setup` (migration 00014, SECURITY DEFINER) which — in one
 * transaction, for the signed-in user (auth.uid()) — creates the business,
 * the owner membership, the first service, and the weekly availability
 * rules. A new owner therefore always gets their OWN business and slug;
 * nothing is inherited from any existing business.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndMemberships } from "@/lib/auth-actions";

/** Mirrors the literal in src/lib/auth-actions.ts (a "use server" module
 *  cannot export constants, so the name is duplicated here). */
const PENDING_BUSINESS_COOKIE = "slotly_pending_business";

export interface OnboardingState {
  error?: string;
}

export interface SlugCheck {
  valid: boolean;
  available: boolean;
  message?: string;
}

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens.")
  .min(3, "Page name needs at least 3 characters.")
  .max(60, "Page name can be at most 60 characters.");

/** Live slug check for the onboarding form: format + collision against
 *  `businesses_public`. The view only lists page-enabled businesses, so the
 *  unique constraint on businesses.slug (enforced inside the setup RPC) is
 *  the final word — completeOnboarding maps that error too. */
export async function checkSlugAvailability(rawSlug: string): Promise<SlugCheck> {
  const parsed = slugSchema.safeParse(rawSlug);
  if (!parsed.success) {
    return { valid: false, available: false, message: parsed.error.issues[0]?.message };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses_public")
    .select("slug")
    .eq("slug", parsed.data)
    .maybeSingle();
  if (error) {
    // Never block setup on a failed pre-check; the RPC enforces uniqueness.
    return { valid: true, available: true };
  }
  return data
    ? { valid: true, available: false, message: "That page name is taken — try another." }
    : { valid: true, available: true };
}

const weeklyHoursSchema = z
  .array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      is_closed: z.boolean(),
      open_time: z.string().regex(/^\d{2}:\d{2}$/),
      close_time: z.string().regex(/^\d{2}:\d{2}$/),
    }),
  )
  .length(7, "Weekly hours must cover all 7 days.");

const setupSchema = z.object({
  businessName: z.string().trim().min(1, "Enter your business name.").max(120),
  slug: slugSchema,
  timezone: z.string().trim().min(1, "Choose a timezone.").max(80),
  serviceName: z.string().trim().min(1, "Name your first service.").max(120),
  serviceDurationMinutes: z.coerce
    .number()
    .int("Duration must be a whole number of minutes.")
    .min(5, "Duration must be at least 5 minutes.")
    .max(480, "Duration can be at most 480 minutes."),
  servicePriceCents: z.coerce
    .number()
    .int()
    .min(0, "Price can't be negative."),
  weeklyHours: weeklyHoursSchema,
});

/** Friendly text for the exception names raised by create_business_setup
 *  (migration 00014) and the slug unique constraint. */
function friendlySetupError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("duplicate key") || m.includes("businesses_slug") || m.includes("invalid_slug")) {
    return "That page name is taken — go back to the Business step and try another.";
  }
  if (m.includes("not_authenticated")) {
    return "Your session has expired. Sign in again, then finish setup.";
  }
  if (m.includes("business_name_required")) return "Enter your business name.";
  if (m.includes("service_name_required")) return "Name your first service.";
  if (m.includes("invalid_service_duration")) return "Service duration must be between 5 and 480 minutes.";
  if (m.includes("invalid_service_price")) return "Service price can't be negative.";
  return message;
}

export async function completeOnboarding(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const { user, memberships } = await getCurrentUserAndMemberships();
  if (!user) redirect("/sign-in?next=/onboarding");
  if (memberships.length > 0) redirect("/app");

  let weeklyHours: unknown;
  try {
    weeklyHours = JSON.parse(String(formData.get("weeklyHours") ?? "[]"));
  } catch {
    return { error: "Weekly hours didn't come through. Reload the page and try again." };
  }

  const parsed = setupSchema.safeParse({
    businessName: formData.get("businessName"),
    slug: formData.get("slug"),
    timezone: formData.get("timezone"),
    serviceName: formData.get("serviceName"),
    serviceDurationMinutes: formData.get("serviceDurationMinutes"),
    servicePriceCents: formData.get("servicePriceCents"),
    weeklyHours,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const slugCheck = await checkSlugAvailability(parsed.data.slug);
  if (!slugCheck.available) {
    return { error: slugCheck.message ?? "That page name is taken — try another." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_business_setup", {
    p_name: parsed.data.businessName,
    p_slug: parsed.data.slug,
    p_timezone: parsed.data.timezone,
    p_service_name: parsed.data.serviceName,
    p_service_duration_minutes: parsed.data.serviceDurationMinutes,
    p_service_price_cents: parsed.data.servicePriceCents,
    // Shape per migration 00014: [{ weekday: 0-6 (0 = Sunday), is_closed,
    // open_time: "HH:MM", close_time: "HH:MM" }] — closed days are sent
    // with is_closed: true and skipped by the RPC.
    p_weekly_hours: parsed.data.weeklyHours,
  });
  if (error) return { error: friendlySetupError(error.message) };

  const cookieStore = await cookies();
  cookieStore.delete(PENDING_BUSINESS_COOKIE);

  // Success state: /app reads ?welcome=<slug> to point the new owner at
  // their live public page, /b/<slug> (booking_page_enabled defaults true,
  // so the page is live immediately).
  redirect(`/app?welcome=${encodeURIComponent(parsed.data.slug)}`);
}
