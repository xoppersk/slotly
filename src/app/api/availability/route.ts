/**
 * GET /api/availability — public slot grid for a business + service.
 *
 * Calls the `get_availability` SECURITY DEFINER function, maps the jsonb
 * into the pure TS availability engine's per-staff inputs, runs
 * `generateDayRange` per staff (or every staff performing the service when
 * `staffId=any`), and merges the grids: slots carry their `staffId`, a day
 * is `open` when any staff has slots, `fully_booked` when windows exist but
 * no slots survive, `closed` otherwise.
 *
 * Response is cacheable for 60s (`Cache-Control: public, max-age=60`).
 */

import { NextResponse, type NextRequest } from "next/server";

import {
  AvailabilityMappingError,
  mapAvailabilityPayload,
  mergeDayGrids,
} from "@/lib/api/availability-mapping";
import { generateDayRange } from "@/lib/availability";
import { AvailabilityQuerySchema } from "@/lib/api/schemas";
import { createClient } from "@/lib/supabase/server";
import {
  DEMO_BUSINESS_ID,
  demoAvailability,
  demoBusiness,
  demoStaff,
} from "@/lib/demo-data";

import { jsonError, jsonOk, rateLimitOr429, zodError } from "../_lib/http";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const limited = rateLimitOr429(request, 100);
  if (limited) return limited;

  const parsed = AvailabilityQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) return zodError(parsed.error);
  const { businessId, serviceId, staffId, from, to } = parsed.data;

  // Demo fallback: the Harbor & Pine demo business has no live database
  // row, so its slot grid is synthesized from the design truth ledger
  // (the signature day reproduces the artifact's exact slot layout).
  if (businessId === DEMO_BUSINESS_ID) {
    const staff = demoStaff.find((m) => m.id === staffId) ?? demoStaff[0]!;
    const days = demoAvailability(from, to, staff.id);
    return jsonOk(
      {
        business: {
          id: demoBusiness.id,
          name: demoBusiness.name,
          slug: demoBusiness.slug,
          timezone: demoBusiness.timezone,
        },
        days: days.map((d) => ({
          date: d.date,
          status: d.closed
            ? "closed"
            : d.slots.length === 0
              ? "fully_booked"
              : "open",
          slots: d.slots,
        })),
      },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_availability", {
    p_business_id: businessId,
    p_service_id: serviceId,
    p_staff_id: staffId === "any" ? null : staffId,
    p_from_date: from,
    p_to_date: to,
  });
  if (error) {
    // Never leak raw database text.
    return jsonError("availability_failed", "Could not load availability.", 500);
  }

  let mapped;
  try {
    mapped = mapAvailabilityPayload(data, new Date().toISOString());
  } catch (err) {
    if (err instanceof AvailabilityMappingError) {
      return jsonError("availability_failed", "Could not load availability.", 500);
    }
    throw err;
  }

  const selected =
    staffId === "any"
      ? mapped.perStaff
      : mapped.perStaff.filter((s) => s.staffId === staffId);
  if (selected.length === 0) {
    return jsonError("staff_not_found", "That staff member was not found.", 404);
  }

  const days =
    Math.round(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
    ) + 1;

  const grids = selected.map((s) => ({
    staffId: s.staffId,
    days: generateDayRange(s.input, from, days, s.staffId),
  }));

  return jsonOk(
    {
      business: {
        id: mapped.business.id,
        name: mapped.business.name,
        slug: mapped.business.slug,
        timezone: mapped.business.timezone,
      },
      days: mergeDayGrids(grids),
    },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
