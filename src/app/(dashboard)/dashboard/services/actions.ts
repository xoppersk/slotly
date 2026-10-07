"use server";

/**
 * Server Actions for /dashboard/services. Owner-only: every action re-checks
 * the caller's role through requireOwner() (PostgreSQL RLS is the final
 * backstop — the services_owner_all policy only allows owner writes).
 */

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import {
  clampDuration,
  dollarsToCents,
  validateServicePayment,
} from "@/lib/management";

import type { PaymentPolicy } from "@/lib/supabase/types";

export interface ServiceFormInput {
  id?: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  paymentPolicy: PaymentPolicy;
  depositCents: number;
  isActive: boolean;
  staffIds: string[];
}

export type ActionResult = { ok: true } | { ok: false; error: string };

function validate(input: ServiceFormInput): string | null {
  if (!input.name.trim()) return "Service name is required.";
  const duration = clampDuration(input.durationMinutes);
  if (duration !== input.durationMinutes)
    return "Duration must be between 5 and 480 minutes, in 5-minute steps.";
  if (input.priceCents < 0) return "Price cannot be negative.";
  if (input.bufferBeforeMinutes < 0 || input.bufferAfterMinutes < 0)
    return "Buffers cannot be negative.";
  const paymentErrors = validateServicePayment({
    priceCents: input.priceCents,
    paymentPolicy: input.paymentPolicy,
    depositCents: input.depositCents,
  });
  if (paymentErrors.length > 0) return paymentErrors[0] ?? "Invalid payment settings.";
  if (input.staffIds.length === 0)
    return "Assign at least one staff member to this service.";
  return null;
}

export async function saveService(input: ServiceFormInput): Promise<ActionResult> {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false, error: "Only the business owner can manage services." };

  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  const { business } = gate.ctx;
  const supabase = await createClient();

  // Staff ids must belong to this business (RLS would reject otherwise, but
  // fail fast with a clear message).
  const { data: staffRows } = await supabase
    .from("staff")
    .select("id")
    .eq("business_id", business.id)
    .in("id", input.staffIds.length > 0 ? input.staffIds : ["00000000-0000-0000-0000-000000000000"]);
  const validStaffIds = new Set((staffRows ?? []).map((s) => s.id));
  const staffIds = input.staffIds.filter((id) => validStaffIds.has(id));
  if (staffIds.length === 0)
    return { ok: false, error: "Assign at least one staff member to this service." };

  const payload = {
    business_id: business.id,
    name: input.name.trim(),
    description: input.description.trim(),
    duration_minutes: input.durationMinutes,
    price_cents: Math.round(input.priceCents),
    buffer_before_minutes: Math.round(input.bufferBeforeMinutes),
    buffer_after_minutes: Math.round(input.bufferAfterMinutes),
    payment_policy: input.paymentPolicy,
    deposit_cents:
      input.paymentPolicy === "deposit" ? Math.round(input.depositCents) : 0,
    is_active: input.isActive,
  };

  let serviceId = input.id;
  if (serviceId) {
    const { error } = await supabase
      .from("services")
      .update(payload)
      .eq("id", serviceId)
      .eq("business_id", business.id);
    if (error) return { ok: false, error: "Could not save the service. Please try again." };

    // Replace staff assignments wholesale.
    const { error: delError } = await supabase
      .from("service_staff")
      .delete()
      .eq("service_id", serviceId);
    if (delError) return { ok: false, error: "Could not update staff assignments." };
  } else {
    const { data: maxRow } = await supabase
      .from("services")
      .select("sort_order")
      .eq("business_id", business.id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error } = await supabase
      .from("services")
      .insert({ ...payload, sort_order: (maxRow?.sort_order ?? -1) + 1 })
      .select("id")
      .single();
    if (error || !data)
      return { ok: false, error: "Could not create the service. Please try again." };
    serviceId = data.id;
  }

  if (serviceId && staffIds.length > 0) {
    const { error } = await supabase.from("service_staff").insert(
      staffIds.map((staff_id) => ({ service_id: serviceId as string, staff_id })),
    );
    if (error) return { ok: false, error: "Could not update staff assignments." };
  }

  revalidatePath("/dashboard/services");
  return { ok: true };
}

export async function setServiceActive(
  serviceId: string,
  active: boolean,
): Promise<ActionResult> {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false, error: "Only the business owner can manage services." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({ is_active: active })
    .eq("id", serviceId)
    .eq("business_id", gate.ctx.business.id);
  if (error) return { ok: false, error: "Could not update the service." };

  revalidatePath("/dashboard/services");
  return { ok: true };
}

/** Re-exported for the dialog's price/deposit inputs (dollars ↔ cents). */
export { dollarsToCents };
