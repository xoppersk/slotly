"use server";

/**
 * Server Actions for /dashboard/staff. Owner-only (requireOwner + RLS).
 *
 * Invites: creates a staff_invites row with a SHA-256 token hash (the raw
 * token only ever travels in the emailed link) and sends the invite email via
 * the notify template + sender (server-only).
 */

import { createHash, randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { buildWeeklyRuleRows, type WeeklyDayInput } from "@/lib/management";
import { staffInvite } from "@/lib/notify/templates";
import { defaultSender, isSendSuccess } from "@/lib/notify/sender";

import type { MemberRole } from "@/lib/supabase/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

const INVITE_TTL_DAYS = 7;
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

function appUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}

export async function inviteStaff(input: {
  email: string;
  role: MemberRole;
}): Promise<ActionResult & { inviteUrl?: string }> {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false, error: "Only the business owner can invite staff." };

  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false, error: "Enter a valid email address." };
  if (input.role !== "staff" && input.role !== "owner")
    return { ok: false, error: "Invalid role." };

  const { business } = gate.ctx;
  const supabase = await createClient();

  // Don't invite someone who is already on the team.
  const { data: existing } = await supabase
    .from("staff_invites")
    .select("id")
    .eq("business_id", business.id)
    .eq("email", email)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1);
  if (existing && existing.length > 0)
    return { ok: false, error: "That email already has a pending invite." };

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 3600 * 1000).toISOString();
  const inviteUrl = `${appUrl()}/auth/invite/${token}`;

  const { error } = await supabase.from("staff_invites").insert({
    business_id: business.id,
    email,
    role: input.role,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
  if (error) return { ok: false, error: "Could not create the invite. Please try again." };

  const template = staffInvite({
    businessName: business.name,
    serviceName: "",
    staffName: "",
    customerName: "",
    whenLabel: "",
    dateTimeLabel: "",
    bookingReference: "",
    manageUrl: "",
    inviteUrl,
    inviteRole: input.role === "owner" ? "owner" : "staff member",
  });
  const sender = defaultSender();
  const sent = await sender.sendEmail({ to: email, ...template });
  if (!isSendSuccess(sent)) {
    // The invite row stays (owner can resend); surface the email failure.
    return {
      ok: false,
      error: "Invite saved, but the email could not be sent. Please resend it.",
      inviteUrl,
    };
  }

  revalidatePath("/dashboard/staff");
  return { ok: true, inviteUrl };
}

export async function resendInvite(inviteId: string): Promise<ActionResult> {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false, error: "Only the business owner can invite staff." };

  const { business } = gate.ctx;
  const supabase = await createClient();
  const { data: invite } = await supabase
    .from("staff_invites")
    .select("id, email, role")
    .eq("id", inviteId)
    .eq("business_id", business.id)
    .is("accepted_at", null)
    .maybeSingle();
  if (!invite) return { ok: false, error: "Invite not found." };

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 3600 * 1000).toISOString();
  const inviteUrl = `${appUrl()}/auth/invite/${token}`;

  const { error } = await supabase
    .from("staff_invites")
    .update({ token_hash: tokenHash, expires_at: expiresAt })
    .eq("id", invite.id);
  if (error) return { ok: false, error: "Could not refresh the invite." };

  const template = staffInvite({
    businessName: business.name,
    serviceName: "",
    staffName: "",
    customerName: "",
    whenLabel: "",
    dateTimeLabel: "",
    bookingReference: "",
    manageUrl: "",
    inviteUrl,
    inviteRole: invite.role === "owner" ? "owner" : "staff member",
  });
  const sent = await defaultSender().sendEmail({ to: invite.email, ...template });
  if (!isSendSuccess(sent))
    return { ok: false, error: "Invite refreshed, but the email could not be sent." };

  revalidatePath("/dashboard/staff");
  return { ok: true };
}

export async function revokeInvite(inviteId: string): Promise<ActionResult> {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false, error: "Only the business owner can manage invites." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_invites")
    .delete()
    .eq("id", inviteId)
    .eq("business_id", gate.ctx.business.id);
  if (error) return { ok: false, error: "Could not revoke the invite." };

  revalidatePath("/dashboard/staff");
  return { ok: true };
}

export interface StaffProfileInput {
  staffId: string;
  name: string;
  title: string;
  bio: string;
  specialties: string[];
  phone: string;
  isActive: boolean;
}

export async function updateStaffProfile(
  input: StaffProfileInput,
): Promise<ActionResult> {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false, error: "Only the business owner can edit staff." };
  if (!input.name.trim()) return { ok: false, error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff")
    .update({
      name: input.name.trim(),
      title: input.title.trim() || null,
      bio: input.bio.trim(),
      specialties: input.specialties.map((s) => s.trim()).filter(Boolean),
      phone: input.phone.trim() || null,
      is_active: input.isActive,
    })
    .eq("id", input.staffId)
    .eq("business_id", gate.ctx.business.id);
  if (error) return { ok: false, error: "Could not save the profile." };

  revalidatePath("/dashboard/staff");
  return { ok: true };
}

export async function uploadStaffPhoto(
  staffId: string,
  formData: FormData,
): Promise<ActionResult> {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false, error: "Only the business owner can edit staff." };

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Choose a photo to upload." };
  if (!file.type.startsWith("image/"))
    return { ok: false, error: "The photo must be an image file." };
  if (file.size > PHOTO_MAX_BYTES)
    return { ok: false, error: "The photo must be smaller than 5 MB." };

  const { business } = gate.ctx;
  const supabase = await createClient();

  const { data: staffRow } = await supabase
    .from("staff")
    .select("id")
    .eq("id", staffId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!staffRow) return { ok: false, error: "Staff member not found." };

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${business.id}/${staffId}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("staff-photos")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) return { ok: false, error: "Could not upload the photo." };

  const {
    data: { publicUrl },
  } = supabase.storage.from("staff-photos").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("staff")
    .update({ photo_url: publicUrl })
    .eq("id", staffId);
  if (updateError) return { ok: false, error: "Photo uploaded, but the profile could not be updated." };

  revalidatePath("/dashboard/staff");
  return { ok: true };
}

export async function saveStaffHours(input: {
  staffId: string;
  inherit: boolean;
  grid: WeeklyDayInput[];
}): Promise<ActionResult> {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false, error: "Only the business owner can edit hours." };

  const { business } = gate.ctx;
  const supabase = await createClient();

  const { data: staffRow } = await supabase
    .from("staff")
    .select("id")
    .eq("id", input.staffId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!staffRow) return { ok: false, error: "Staff member not found." };

  const { error: delError } = await supabase
    .from("availability_rules")
    .delete()
    .eq("business_id", business.id)
    .eq("staff_id", input.staffId);
  if (delError) return { ok: false, error: "Could not update working hours." };

  if (!input.inherit) {
    const rows = buildWeeklyRuleRows(business.id, input.staffId, input.grid);
    if (rows.length > 0) {
      const { error } = await supabase.from("availability_rules").insert(rows);
      if (error) return { ok: false, error: "Could not save working hours." };
    }
  }

  revalidatePath("/dashboard/staff");
  return { ok: true };
}

export async function updateStaffNotifications(input: {
  staffId: string;
  notifyNewBooking: boolean;
  notifyCancellation: boolean;
}): Promise<ActionResult> {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false, error: "Only the business owner can edit staff." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff")
    .update({
      notify_new_booking: input.notifyNewBooking,
      notify_cancellation: input.notifyCancellation,
    })
    .eq("id", input.staffId)
    .eq("business_id", gate.ctx.business.id);
  if (error) return { ok: false, error: "Could not save notification preferences." };

  revalidatePath("/dashboard/staff");
  return { ok: true };
}

/**
 * Review a staff time-off request: approve (it starts blocking the slot
 * grid via get_availability's approved filter) or decline.
 */
export async function reviewTimeOff(
  timeOffId: string,
  decision: "approved" | "declined"
): Promise<ActionResult> {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false, error: "Only the business owner can review time-off requests." };
  if (decision !== "approved" && decision !== "declined") {
    return { ok: false, error: "Invalid decision." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_time_off")
    .update({ status: decision })
    .eq("id", timeOffId)
    .eq("business_id", gate.ctx.business.id)
    .eq("status", "pending");
  if (error) return { ok: false, error: "Could not update the request." };

  revalidatePath("/dashboard/staff");
  return { ok: true };
}
