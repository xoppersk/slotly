"use server";
/* Dashboard mutations (PROD-W4). Every action re-resolves the signed-in
 * user's active business server-side (cookie + membership) and scopes
 * writes by business_id; PostgreSQL Row Level Security enforces the same
 * boundary in the database (owner = full CRUD on own-business rows;
 * staff may update their own bookings only). Owner-only surfaces
 * (services, availability, invites, settings) additionally check the
 * membership role, matching migration 00013's app-layer gating note. */
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";

import { createClient } from "@/lib/supabase/server";
import type { BookingStatus as DbBookingStatus } from "@/lib/supabase/types";

import { ACTIVE_BUSINESS_COOKIE, getDashboardContext } from "./_lib/data";

export type ActionResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });

function revalidateDashboard() {
  revalidatePath("/app");
  revalidatePath("/app/bookings");
  revalidatePath("/app/calendar");
  revalidatePath("/app/customers");
  revalidatePath("/app/services");
  revalidatePath("/app/staff");
  revalidatePath("/app/availability");
  revalidatePath("/app/settings");
  revalidatePath("/staff");
  revalidatePath("/staff/time-off");
}

async function ctx() {
  return getDashboardContext();
}

async function ownerCtx() {
  const c = await getDashboardContext();
  if (!c) return null;
  if (!c.isOwner) return null;
  return c;
}

/** Business switcher: remember the chosen business in a cookie. The id
 *  is only honoured when it is one of the user's own memberships. */
export async function setActiveBusiness(businessId: string): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return fail("You are not signed in.");
  if (!c.memberships.some((m) => m.membership.business_id === businessId)) {
    return fail("That business is not one of yours.");
  }
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BUSINESS_COOKIE, businessId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidateDashboard();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Bookings                                                            */
/* ------------------------------------------------------------------ */

const TRANSITIONS: Record<string, DbBookingStatus[]> = {
  // From → allowed targets. The production chain (PROD-W4.md):
  // pending → confirmed → completed, plus cancelled / no_show exits.
  pending: ["confirmed", "cancelled", "no_show"],
  payment_pending: ["cancelled", "no_show"],
  payment_failed: ["cancelled", "no_show"],
  confirmed: ["completed", "cancelled", "no_show"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export async function updateBookingStatus(
  bookingId: string,
  next: DbBookingStatus,
): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return fail("You are not signed in.");
  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("id", bookingId)
    .eq("business_id", c.business.id)
    .maybeSingle();
  if (!booking) return fail("Booking not found.");
  const allowed = TRANSITIONS[booking.status as string] ?? [];
  if (!allowed.includes(next)) {
    return fail(`A ${booking.status.replace(/_/g, " ")} booking cannot become ${next.replace(/_/g, " ")}.`);
  }
  const patch: { status: DbBookingStatus; cancelled_at?: string } = { status: next };
  if (next === "cancelled") patch.cancelled_at = new Date().toISOString();
  const { error } = await supabase
    .from("bookings")
    .update(patch)
    .eq("id", bookingId)
    .eq("business_id", c.business.id);
  if (error) return fail("Could not update the booking. Please try again.");
  revalidateDashboard();
  return { ok: true };
}

export async function saveInternalNotes(bookingId: string, notes: string): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return fail("You are not signed in.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update({ internal_notes: notes.slice(0, 2000) })
    .eq("id", bookingId)
    .eq("business_id", c.business.id);
  if (error) return fail("Could not save the note.");
  revalidateDashboard();
  return { ok: true };
}

const onBehalfSchema = z.object({
  customerId: z.string().uuid().optional(),
  customerName: z.string().trim().min(2).max(120),
  customerEmail: z.string().trim().email().optional().or(z.literal("")),
  customerPhone: z.string().trim().max(40).optional().or(z.literal("")),
  serviceId: z.string().uuid(),
  staffId: z.string().uuid(),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start24: z.string().regex(/^\d{2}:\d{2}$/),
});

/** Book on a customer's behalf — goes through the create_booking
 *  SECURITY DEFINER RPC (source 'dashboard'), which validates the slot
 *  against real availability and find-or-creates the customer row
 *  (customers have no direct INSERT policy by design). */
export async function createBookingOnBehalf(
  input: z.infer<typeof onBehalfSchema>,
): Promise<ActionResult & { bookingId?: string }> {
  const c = await ctx();
  if (!c) return fail("You are not signed in.");
  const parsed = onBehalfSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form.");
  const d = parsed.data;

  const supabase = await createClient();
  const { data: service } = await supabase
    .from("services")
    .select("id, duration_minutes")
    .eq("id", d.serviceId)
    .eq("business_id", c.business.id)
    .maybeSingle();
  if (!service) return fail("Service not found.");

  let email = d.customerEmail || undefined;
  let phone = d.customerPhone || undefined;
  if (d.customerId) {
    const { data: customer } = await supabase
      .from("customers")
      .select("id, email, phone")
      .eq("id", d.customerId)
      .eq("business_id", c.business.id)
      .maybeSingle();
    if (!customer) return fail("Customer not found.");
    email = email ?? customer.email ?? undefined;
    phone = phone ?? customer.phone ?? undefined;
  }
  if (!email && !phone) {
    return fail("Add an email or phone number for the customer — bookings need one contact.");
  }

  const startsAt = fromZonedTime(`${d.dateKey}T${d.start24}:00`, c.business.timezone);
  const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60_000);
  const { data, error } = await supabase.rpc("create_booking", {
    p_business_id: c.business.id,
    p_service_id: d.serviceId,
    p_staff_id: d.staffId,
    p_starts_at: startsAt.toISOString(),
    p_ends_at: endsAt.toISOString(),
    p_customer_name: d.customerName,
    p_customer_phone: phone ?? null,
    p_customer_email: email ?? null,
    p_customer_notes: "",
    p_source: "dashboard",
  });
  if (error) {
    const m = error.message;
    if (m.includes("slot_not_available") || m.includes("not bookable") || m.includes("overlap")) {
      return fail("That time is no longer available for this staff member.");
    }
    return fail("Could not create the booking. Please try again.");
  }
  revalidateDashboard();
  const row = data as unknown as { booking?: { id?: string } } | null;
  return { ok: true, bookingId: row?.booking?.id };
}

/* ------------------------------------------------------------------ */
/* Services (owner)                                                    */
/* ------------------------------------------------------------------ */

const serviceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name is required.").max(120),
  description: z.string().trim().max(500).default(""),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  priceCents: z.coerce.number().int().min(0),
  depositCents: z.coerce.number().int().min(0),
  paymentPolicy: z.enum(["none", "deposit", "full"]),
  bufferBeforeMinutes: z.coerce.number().int().min(0).max(240),
  bufferAfterMinutes: z.coerce.number().int().min(0).max(240),
  sortOrder: z.coerce.number().int().min(0).max(999),
  isActive: z.boolean(),
  staffIds: z.array(z.string().uuid()).default([]),
});

export type ServiceInput = z.infer<typeof serviceSchema>;

export async function saveService(
  input: ServiceInput,
): Promise<ActionResult & { serviceId?: string }> {
  const c = await ownerCtx();
  if (!c) return fail("Only the business owner can edit services.");
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form.");
  const d = parsed.data;
  if (d.depositCents > d.priceCents) return fail("The deposit cannot be more than the price.");

  const supabase = await createClient();
  const row = {
    business_id: c.business.id,
    name: d.name,
    description: d.description,
    duration_minutes: d.durationMinutes,
    price_cents: d.priceCents,
    deposit_cents: d.depositCents,
    payment_policy: d.paymentPolicy,
    buffer_before_minutes: d.bufferBeforeMinutes,
    buffer_after_minutes: d.bufferAfterMinutes,
    sort_order: d.sortOrder,
    is_active: d.isActive,
  };
  let serviceId = d.id;
  if (serviceId) {
    const { error } = await supabase
      .from("services")
      .update(row)
      .eq("id", serviceId)
      .eq("business_id", c.business.id);
    if (error) return fail("Could not save the service.");
  } else {
    const { data, error } = await supabase
      .from("services")
      .insert(row)
      .select("id")
      .single();
    if (error || !data) return fail("Could not create the service.");
    serviceId = data.id;
  }

  // Staff assignment (service_staff, owner policy): replace the set.
  const { error: delError } = await supabase
    .from("service_staff")
    .delete()
    .eq("service_id", serviceId);
  if (delError) return fail("Service saved, but staff assignment failed.");
  if (d.staffIds.length > 0) {
    const { error: insError } = await supabase
      .from("service_staff")
      .insert(d.staffIds.map((staffId) => ({ service_id: serviceId!, staff_id: staffId })));
    if (insError) return fail("Service saved, but staff assignment failed.");
  }
  revalidateDashboard();
  return { ok: true, serviceId };
}

export async function setServiceActive(serviceId: string, isActive: boolean): Promise<ActionResult> {
  const c = await ownerCtx();
  if (!c) return fail("Only the business owner can edit services.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({ is_active: isActive })
    .eq("id", serviceId)
    .eq("business_id", c.business.id);
  if (error) return fail("Could not update the service.");
  revalidateDashboard();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Availability (owner)                                                  */
/* ------------------------------------------------------------------ */

const weeklyDaySchema = z.object({
  weekday: z.number().int().min(0).max(6),
  isClosed: z.boolean(),
  openTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

/** Replace the weekly rules for one scope (staffId null = shop hours). */
export async function saveWeeklyRules(
  staffId: string | null,
  days: z.infer<typeof weeklyDaySchema>[],
): Promise<ActionResult> {
  const c = await ownerCtx();
  if (!c) return fail("Only the business owner can edit availability.");
  const parsed = z.array(weeklyDaySchema).min(1).max(7).safeParse(days);
  if (!parsed.success) return fail("Check the hours and try again.");
  for (const d of parsed.data) {
    if (!d.isClosed && d.closeTime <= d.openTime) {
      return fail("Closing time must be after opening time.");
    }
  }
  const supabase = await createClient();
  let del = supabase
    .from("availability_rules")
    .delete()
    .eq("business_id", c.business.id);
  del = staffId ? del.eq("staff_id", staffId) : del.is("staff_id", null);
  const { error: delError } = await del;
  if (delError) return fail("Could not save the hours.");
  const rows = parsed.data.map((d) => ({
    business_id: c.business.id,
    staff_id: staffId,
    weekday: d.weekday,
    open_time: d.openTime.length === 5 ? `${d.openTime}:00` : d.openTime,
    close_time: d.closeTime.length === 5 ? `${d.closeTime}:00` : d.closeTime,
    is_closed: d.isClosed,
  }));
  const { error } = await supabase.from("availability_rules").insert(rows);
  if (error) return fail("Could not save the hours.");
  revalidateDashboard();
  return { ok: true };
}

const overrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  staffId: z.string().uuid().nullable(),
  isClosed: z.boolean(),
  openTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  reason: z.string().trim().max(200).nullable(),
});

export async function saveOverride(
  input: z.infer<typeof overrideSchema>,
): Promise<ActionResult> {
  const c = await ownerCtx();
  if (!c) return fail("Only the business owner can edit availability.");
  const parsed = overrideSchema.safeParse(input);
  if (!parsed.success) return fail("Check the date change and try again.");
  const d = parsed.data;
  if (!d.isClosed && (!d.openTime || !d.closeTime || d.closeTime <= d.openTime)) {
    return fail("Add opening and closing times, or mark the day closed.");
  }
  const supabase = await createClient();
  const row = {
    business_id: c.business.id,
    staff_id: d.staffId,
    date: d.date,
    open_time: d.isClosed ? null : `${d.openTime}:00`,
    close_time: d.isClosed ? null : `${d.closeTime}:00`,
    is_closed: d.isClosed,
    reason: d.reason,
  };
  // One row per (business, staff scope, date) — partial unique indexes.
  let del = supabase
    .from("availability_overrides")
    .delete()
    .eq("business_id", c.business.id)
    .eq("date", d.date);
  del = d.staffId ? del.eq("staff_id", d.staffId) : del.is("staff_id", null);
  const { error: delError } = await del;
  if (delError) return fail("Could not save the date change.");
  const { error } = await supabase.from("availability_overrides").insert(row);
  if (error) return fail("Could not save the date change.");
  revalidateDashboard();
  return { ok: true };
}

export async function deleteOverride(overrideId: string): Promise<ActionResult> {
  const c = await ownerCtx();
  if (!c) return fail("Only the business owner can edit availability.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("availability_overrides")
    .delete()
    .eq("id", overrideId)
    .eq("business_id", c.business.id);
  if (error) return fail("Could not remove the date change.");
  revalidateDashboard();
  return { ok: true };
}

export async function saveBlackout(date: string, reason: string): Promise<ActionResult> {
  const c = await ownerCtx();
  if (!c) return fail("Only the business owner can edit availability.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Pick a date.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("blackout_dates")
    .upsert(
      { business_id: c.business.id, date, reason: reason.trim().slice(0, 200) || null },
      { onConflict: "business_id,date" },
    );
  if (error) return fail("Could not save the closure.");
  revalidateDashboard();
  return { ok: true };
}

export async function deleteBlackout(blackoutId: string): Promise<ActionResult> {
  const c = await ownerCtx();
  if (!c) return fail("Only the business owner can edit availability.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("blackout_dates")
    .delete()
    .eq("id", blackoutId)
    .eq("business_id", c.business.id);
  if (error) return fail("Could not remove the closure.");
  revalidateDashboard();
  return { ok: true };
}

/** Booking policies live on the businesses row (also edited in Settings). */
export async function updateBookingPolicies(input: {
  minLeadTimeMinutes: number;
  maxAdvanceDays: number;
  slotStepMinutes: number;
}): Promise<ActionResult> {
  const c = await ownerCtx();
  if (!c) return fail("Only the business owner can edit booking rules.");
  const parsed = z
    .object({
      minLeadTimeMinutes: z.coerce.number().int().min(0).max(60 * 24 * 7),
      maxAdvanceDays: z.coerce.number().int().min(1).max(365),
      slotStepMinutes: z.coerce.number().int(),
    })
    .safeParse(input);
  if (!parsed.success) return fail("Check the booking rules.");
  if (![5, 10, 15, 20, 30, 60].includes(parsed.data.slotStepMinutes)) {
    return fail("Start times must step by 5, 10, 15, 20, 30 or 60 minutes.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      min_lead_time_minutes: parsed.data.minLeadTimeMinutes,
      max_advance_days: parsed.data.maxAdvanceDays,
      slot_step_minutes: parsed.data.slotStepMinutes,
    })
    .eq("id", c.business.id);
  if (error) return fail("Could not save the booking rules.");
  revalidateDashboard();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Staff + invites (owner)                                             */
/* ------------------------------------------------------------------ */

const INVITE_TTL_DAYS = 7;

/** Invite by email. Creates the staff_invites row (token stored as
 *  sha256 hex, migration 00015 scheme) and returns the RAW invite link
 *  ONCE — production has no email provider keys, so the link is the
 *  delivery: the owner copies it and sends it themselves. */
export async function inviteStaffMember(input: {
  email: string;
  role: "staff" | "owner";
}): Promise<ActionResult & { inviteUrl?: string }> {
  const c = await ownerCtx();
  if (!c) return fail("Only the business owner can invite staff.");
  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().email("Enter a valid email address."),
      role: z.enum(["staff", "owner"]),
    })
    .safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the invite.");

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("staff_invites")
    .select("id")
    .eq("business_id", c.business.id)
    .eq("email", parsed.data.email)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1);
  if (existing && existing.length > 0) {
    return fail("That email already has a pending invite.");
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 3600 * 1000).toISOString();
  const { error } = await supabase.from("staff_invites").insert({
    business_id: c.business.id,
    email: parsed.data.email,
    role: parsed.data.role,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
  if (error) return fail("Could not create the invite. Please try again.");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL ?? "");
  revalidateDashboard();
  return { ok: true, inviteUrl: `${origin}/invite/${token}` };
}

export async function revokeInvite(inviteId: string): Promise<ActionResult> {
  const c = await ownerCtx();
  if (!c) return fail("Only the business owner can manage invites.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_invites")
    .delete()
    .eq("id", inviteId)
    .eq("business_id", c.business.id);
  if (error) return fail("Could not revoke the invite.");
  revalidateDashboard();
  return { ok: true };
}

export async function setStaffActive(staffId: string, isActive: boolean): Promise<ActionResult> {
  const c = await ownerCtx();
  if (!c) return fail("Only the business owner can edit staff.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("staff")
    .update({ is_active: isActive })
    .eq("id", staffId)
    .eq("business_id", c.business.id);
  if (error) return fail("Could not update the staff member.");
  revalidateDashboard();
  return { ok: true };
}

/** Owner review of a staff time-off request (staff_time_off_owner_all). */
export async function reviewTimeOff(
  timeOffId: string,
  decision: "approved" | "declined",
): Promise<ActionResult> {
  const c = await ownerCtx();
  if (!c) return fail("Only the business owner can review time-off requests.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_time_off")
    .update({ status: decision })
    .eq("id", timeOffId)
    .eq("business_id", c.business.id)
    .eq("status", "pending");
  if (error) return fail("Could not update the request.");
  revalidateDashboard();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Settings (owner)                                                    */
/* ------------------------------------------------------------------ */

const settingsSchema = z.object({
  name: z.string().trim().min(1, "Business name is required.").max(120),
  description: z.string().trim().max(1000),
  phone: z.string().trim().max(40),
  email: z.string().trim().email("Enter a valid email address.").or(z.literal("")),
  address: z.string().trim().max(300),
  timezone: z.string().trim().min(1).max(80),
  minLeadTimeMinutes: z.coerce.number().int().min(0).max(60 * 24 * 7),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365),
  slotStepMinutes: z.coerce.number().int(),
  freeCancelHours: z.coerce.number().int().min(0).max(24 * 30),
  reminder24hEnabled: z.boolean(),
  reminder2hEnabled: z.boolean(),
});

export async function updateBusinessSettings(
  input: z.infer<typeof settingsSchema>,
): Promise<ActionResult> {
  const c = await ownerCtx();
  if (!c) return fail("Only the business owner can edit settings.");
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form.");
  const d = parsed.data;
  if (![5, 10, 15, 20, 30, 60].includes(d.slotStepMinutes)) {
    return fail("Start times must step by 5, 10, 15, 20, 30 or 60 minutes.");
  }
  try {
    Intl.supportedValuesOf("timeZone");
    new Intl.DateTimeFormat("en-US", { timeZone: d.timezone });
  } catch {
    return fail("That time zone is not recognised.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      name: d.name,
      description: d.description,
      phone: d.phone || null,
      email: d.email || null,
      address: d.address || null,
      timezone: d.timezone,
      min_lead_time_minutes: d.minLeadTimeMinutes,
      max_advance_days: d.maxAdvanceDays,
      slot_step_minutes: d.slotStepMinutes,
      free_cancel_hours: d.freeCancelHours,
      reminder_24h_enabled: d.reminder24hEnabled,
      reminder_2h_enabled: d.reminder2hEnabled,
    })
    .eq("id", c.business.id);
  if (error) return fail("Could not save settings. Please try again.");
  revalidateDashboard();
  return { ok: true };
}
