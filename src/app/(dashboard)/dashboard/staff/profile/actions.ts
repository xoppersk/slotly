"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business";

export interface OwnProfileInput {
  name: string;
  title?: string;
  bio?: string;
  specialties?: string; // comma-separated
  phone?: string;
}

/**
 * Staff self-service: edit own profile. The UPDATE is whitelisted to the
 * staff-editable columns (name, title, bio, specialties, phone); RLS
 * (staff_own_update, migration 00016) confines it to the caller's own
 * staff row. Owner-only fields (is_active, notify_*) can't be reached.
 */
export async function updateOwnProfile(
  input: OwnProfileInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getCurrentBusiness();
  if (!ctx) return { ok: false, error: "not_signed_in" };
  if (ctx.membership.role !== "staff" || !ctx.membership.staffId) {
    return { ok: false, error: "not_authorized" };
  }

  const name = input.name.trim();
  if (name.length < 1 || name.length > 120) {
    return { ok: false, error: "invalid_name" };
  }
  const title = (input.title ?? "").trim();
  const bio = (input.bio ?? "").trim();
  const phone = (input.phone ?? "").trim();
  const specialties = (input.specialties ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 20);
  if (title.length > 120 || bio.length > 2000 || phone.length > 40) {
    return { ok: false, error: "field_too_long" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff")
    .update({
      name,
      title: title || null,
      bio,
      specialties,
      phone: phone || null,
    })
    .eq("id", ctx.membership.staffId)
    .eq("business_id", ctx.business.id);
  if (error) return { ok: false, error: "save_failed" };

  revalidatePath("/dashboard/staff/profile");
  return { ok: true };
}
