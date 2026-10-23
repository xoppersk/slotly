/**
 * GET /api/public/availability — public slot grid for a business + service.
 *
 * Calls the `get_availability` SECURITY DEFINER function (PostgreSQL,
 * migration 00010) through W1's data layer, generates slots with the TS
 * engine (the RPC returns rules/bookings, not slots), and returns computed
 * days. Query: businessId, serviceId, staffId ("any" | uuid), from, to
 * (YYYY-MM-DD in the business timezone; from/to default to today → +30
 * days, and a request is capped at 31 days).
 */
import { NextResponse, type NextRequest } from "next/server";

import {
  computeAvailability,
  mapDbError,
} from "@/app/b/[slug]/_lib/server-data";
import { addDaysYmd, todayInTz } from "@/app/b/[slug]/_lib/types";
import { createClient } from "@/lib/supabase/server";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status });
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const businessId = sp.get("businessId") ?? "";
  const serviceId = sp.get("serviceId") ?? "";
  const staffIdRaw = sp.get("staffId") ?? "any";
  if (!UUID.test(businessId) || !UUID.test(serviceId)) {
    return jsonError(400, "invalid_input", "businessId and serviceId are required.");
  }
  if (staffIdRaw !== "any" && !UUID.test(staffIdRaw)) {
    return jsonError(400, "invalid_input", "staffId must be a uuid or 'any'.");
  }

  // "Today" is the real today in the BUSINESS timezone (from the public view).
  let tz = "UTC";
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("businesses_public")
      .select("timezone")
      .eq("id", businessId)
      .maybeSingle();
    if (data?.timezone) tz = data.timezone;
  } catch {
    tz = "UTC";
  }

  const fromParam = sp.get("from");
  const toParam = sp.get("to");
  const from = fromParam && YMD.test(fromParam) ? fromParam : todayInTz(tz);
  let to = toParam && YMD.test(toParam) ? toParam : addDaysYmd(from, 30);
  if (to < from) to = from;
  if (addDaysYmd(from, 31) < to) to = addDaysYmd(from, 31);

  try {
    const computed = await computeAvailability({
      businessId,
      serviceId,
      staffId: staffIdRaw === "any" ? null : staffIdRaw,
      from,
      to,
    });
    return NextResponse.json(
      {
        business: computed.business,
        service: {
          id: computed.raw.service.id,
          name: computed.raw.service.name,
          durationMinutes: computed.raw.service.duration_minutes,
          priceCents: computed.raw.service.price_cents,
          depositCents: computed.raw.service.deposit_cents,
          paymentPolicy: computed.raw.service.payment_policy,
        },
        policy: {
          slotStepMinutes: computed.raw.business.slot_step_minutes,
          minLeadTimeMinutes: computed.raw.business.min_lead_time_minutes,
          maxAdvanceDays: computed.raw.business.max_advance_days,
          freeCancelHours: computed.raw.business.free_cancel_hours,
        },
        staff: computed.staff,
        days: computed.days,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    const mapped = mapDbError(err, "Could not load availability.");
    return jsonError(mapped.status, mapped.code, mapped.message);
  }
}
