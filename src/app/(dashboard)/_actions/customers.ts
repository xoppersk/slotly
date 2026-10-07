"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business";
import type { Database } from "@/lib/supabase/types";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];

interface Guard {
  supabase: Awaited<ReturnType<typeof createClient>>;
  businessId: string;
}

async function guardBusiness(businessId: string): Promise<Guard> {
  const ctx = await getCurrentBusiness();
  if (!ctx || ctx.business.id !== businessId) throw new Error("not_authorized");
  const supabase = await createClient();
  return { supabase, businessId };
}

export interface CustomerProfile {
  customer: CustomerRow;
  visits: Array<{
    id: string;
    starts_at: string;
    status: string;
    price_cents: number;
    service_name: string | null;
    staff_name: string | null;
  }>;
}

/** Full customer profile: contact, visit timeline, counters. */
export async function getCustomerProfile(
  businessId: string,
  customerId: string
): Promise<CustomerProfile | null> {
  let guard: Guard;
  try {
    guard = await guardBusiness(businessId);
  } catch {
    return null;
  }
  const { data: customer } = await guard.supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!customer) return null;

  const { data: bookings } = await guard.supabase
    .from("bookings")
    .select("id, starts_at, status, price_cents, services(name), staff(name)")
    .eq("customer_id", customerId)
    .order("starts_at", { ascending: false })
    .limit(100);

  const first = (v: unknown) =>
    (Array.isArray(v) ? v[0] : v) as { name?: string | null } | null;

  return {
    customer,
    visits: ((bookings ?? []) as unknown as Array<{
      id: string;
      starts_at: string;
      status: string;
      price_cents: number;
      services: { name: string } | null;
      staff: { name: string } | null;
    }>).map((b) => ({
      id: b.id,
      starts_at: b.starts_at,
      status: b.status,
      price_cents: b.price_cents,
      service_name: first(b.services)?.name ?? null,
      staff_name: first(b.staff)?.name ?? null,
    })),
  };
}

/**
 * Save private customer notes (autosaved from the profile drawer).
 * PostgreSQL RLS permits customers UPDATE for business members.
 */
export async function updateCustomerNotes(
  businessId: string,
  customerId: string,
  notes: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  let guard: Guard;
  try {
    guard = await guardBusiness(businessId);
  } catch {
    return { ok: false, error: "not_authorized" };
  }
  const { error } = await guard.supabase
    .from("customers")
    .update({ notes: notes.slice(0, 5000) })
    .eq("id", customerId)
    .eq("business_id", businessId);
  if (error) return { ok: false, error: "save_failed" };
  revalidatePath("/dashboard/customers");
  return { ok: true };
}
