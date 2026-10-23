/**
 * Public (anon-readable) data access for Slotly booking pages.
 *
 * Reads ONLY through the whitelisted PostgreSQL views (`businesses_public`,
 * `services_public`, `staff_public`, `service_staff_public`) — Row Level
 * Security denies anon every base table, and these views expose exactly
 * the columns a public page may see. Safe to call with an anon client.
 */
import { createClient } from "@/lib/supabase/server";

import type {
  BusinessPublicRow,
  DbClient,
  ServicePublicRow,
  ServiceStaffPublicRow,
  StaffPublicRow,
} from "./types";

async function resolveClient(client?: DbClient): Promise<DbClient> {
  return client ?? (await createClient());
}

/** The public business row for a slug, or null (unknown slug or booking page disabled). */
export async function getPublicBusiness(
  slug: string,
  client?: DbClient,
): Promise<BusinessPublicRow | null> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("businesses_public")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`getPublicBusiness(${slug}): ${error.message}`);
  return data;
}

export interface PublicCatalog {
  services: ServicePublicRow[];
  staff: StaffPublicRow[];
  /**
   * service_id → staff_ids offering that service, from the
   * `service_staff_public` view (migration 00017). Empty when the view
   * has not been applied to the database yet — callers that need the
   * mapping per service can fall back to get_availability's staff array.
   */
  serviceStaff: Record<string, string[]>;
}

/** Active services + staff + their public mapping for one business. */
export async function getPublicCatalog(
  businessId: string,
  client?: DbClient,
): Promise<PublicCatalog> {
  const supabase = await resolveClient(client);

  const [servicesRes, staffRes, mappingRes] = await Promise.all([
    supabase
      .from("services_public")
      .select("*")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("staff_public")
      .select("*")
      .eq("business_id", businessId)
      .order("name", { ascending: true }),
    supabase
      .from("service_staff_public")
      .select("*")
      .eq("business_id", businessId),
  ]);

  if (servicesRes.error) {
    throw new Error(`getPublicCatalog services: ${servicesRes.error.message}`);
  }
  if (staffRes.error) {
    throw new Error(`getPublicCatalog staff: ${staffRes.error.message}`);
  }

  const serviceStaff: Record<string, string[]> = {};
  if (!mappingRes.error) {
    for (const row of (mappingRes.data ?? []) as ServiceStaffPublicRow[]) {
      (serviceStaff[row.service_id] ??= []).push(row.staff_id);
    }
  }
  // If migration 00017 is not applied yet, mappingRes carries an error and
  // we degrade to an empty mapping rather than breaking the public page.

  return {
    services: servicesRes.data ?? [],
    staff: staffRes.data ?? [],
    serviceStaff,
  };
}
