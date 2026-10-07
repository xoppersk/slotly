"use server";

/**
 * Server Actions for /dashboard/settings. Owner-only (requireOwner + RLS).
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwner } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/format";

import type { PaymentPolicy } from "@/lib/supabase/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

const LOGO_MAX_BYTES = 5 * 1024 * 1024;

export async function checkSlugAvailability(
  slug: string,
): Promise<{ available: boolean }> {
  const clean = slugify(slug);
  if (!clean || !/^[a-z0-9-]+$/.test(clean)) return { available: false };

  const gate = await requireOwner();
  if (!gate.ok) return { available: false };

  const supabase = await createClient();
  // businesses_public is readable by any authenticated user; the DB unique
  // constraint is the authoritative guard (race-safe) at insert time.
  const { data } = await supabase
    .from("businesses_public")
    .select("id")
    .eq("slug", clean)
    .limit(1);
  const takenByOther = (data ?? []).some((b) => b.id !== gate.ctx.business.id);
  return { available: !takenByOther };
}

export interface BusinessProfileInput {
  name: string;
  slug: string;
  description: string;
  timezone: string;
  phone: string;
  email: string;
  address: string;
  accentColor: string;
}

const ACCENTS = ["teal", "blue", "green", "amber", "rose", "violet", "slate"];

export async function updateBusinessProfile(
  input: BusinessProfileInput,
): Promise<ActionResult> {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false, error: "Only the business owner can change settings." };
  if (!input.name.trim()) return { ok: false, error: "Business name is required." };

  const slug = slugify(input.slug);
  if (!slug) return { ok: false, error: "Pick a valid slug for your booking page." };
  if (!input.timezone) return { ok: false, error: "Timezone is required." };
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))
    return { ok: false, error: "Enter a valid contact email." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      name: input.name.trim(),
      slug,
      description: input.description.trim(),
      timezone: input.timezone,
      phone: input.phone.trim() || null,
      email: input.email.trim() || null,
      address: input.address.trim() || null,
      accent_color: ACCENTS.includes(input.accentColor) ? input.accentColor : "teal",
    })
    .eq("id", gate.ctx.business.id);

  if (error) {
    // Unique violation on slug — the live check can race.
    if ((error as { code?: string }).code === "23505")
      return { ok: false, error: "That slug is taken — try another." };
    return { ok: false, error: "Could not save. Please try again." };
  }

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function uploadBusinessAsset(
  kind: "logo" | "cover",
  formData: FormData,
): Promise<ActionResult> {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false, error: "Only the business owner can change settings." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Choose an image to upload." };
  if (!file.type.startsWith("image/"))
    return { ok: false, error: "The file must be an image." };
  if (file.size > LOGO_MAX_BYTES)
    return { ok: false, error: "The image must be smaller than 5 MB." };

  const { business } = gate.ctx;
  const supabase = await createClient();
  const ext =
    (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${business.id}/${kind}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("business-logos")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) return { ok: false, error: "Could not upload the image." };

  const {
    data: { publicUrl },
  } = supabase.storage.from("business-logos").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("businesses")
    .update(kind === "logo" ? { logo_url: publicUrl } : { cover_url: publicUrl })
    .eq("id", business.id);
  if (updateError) return { ok: false, error: "Image uploaded, but the profile could not be updated." };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function updateNotificationPrefs(input: {
  ownerNotifyEmail: boolean;
  ownerNotifySms: boolean;
}): Promise<ActionResult> {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false, error: "Only the business owner can change settings." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      owner_notify_email: input.ownerNotifyEmail,
      owner_notify_sms: input.ownerNotifySms,
    })
    .eq("id", gate.ctx.business.id);
  if (error) return { ok: false, error: "Could not save notification settings." };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function updateReminderPrefs(input: {
  reminder24hEnabled: boolean;
  reminder2hEnabled: boolean;
  reminder24hChannel: "email" | "sms";
  reminder2hChannel: "email" | "sms";
}): Promise<ActionResult> {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false, error: "Only the business owner can change settings." };
  const channels = ["email", "sms"];
  if (!channels.includes(input.reminder24hChannel) || !channels.includes(input.reminder2hChannel))
    return { ok: false, error: "Invalid reminder channel." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      reminder_24h_enabled: input.reminder24hEnabled,
      reminder_2h_enabled: input.reminder2hEnabled,
      reminder_24h_channel: input.reminder24hChannel,
      reminder_2h_channel: input.reminder2hChannel,
    })
    .eq("id", gate.ctx.business.id);
  if (error) return { ok: false, error: "Could not save reminder settings." };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function updateDefaultPaymentPolicy(
  policy: PaymentPolicy,
): Promise<ActionResult> {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false, error: "Only the business owner can change settings." };
  if (!["none", "deposit", "full"].includes(policy))
    return { ok: false, error: "Invalid payment policy." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ default_payment_policy: policy })
    .eq("id", gate.ctx.business.id);
  if (error) return { ok: false, error: "Could not save the default policy." };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function setBookingPageEnabled(
  enabled: boolean,
): Promise<ActionResult> {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false, error: "Only the business owner can change settings." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ booking_page_enabled: enabled })
    .eq("id", gate.ctx.business.id);
  if (error) return { ok: false, error: "Could not update the booking page." };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function deleteBusiness(confirmation: string): Promise<ActionResult> {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false, error: "Only the business owner can delete the business." };

  const { business } = gate.ctx;
  if (confirmation.trim() !== business.name)
    return { ok: false, error: "Type the business name exactly to confirm." };

  const supabase = await createClient();
  const { error } = await supabase.from("businesses").delete().eq("id", business.id);
  if (error) return { ok: false, error: "Could not delete the business." };

  redirect("/");
}
