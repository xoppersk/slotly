/**
 * POST /api/public/bookings — create a REAL booking row via the
 * `create_booking` SECURITY DEFINER function (PostgreSQL, migration 00010).
 *
 * Body: { businessId, serviceId, staffId ("any" | uuid), startsAt, endsAt,
 * customer: { name, phone?, email?, notes? } } — mirroring create_booking's
 * own customer rules (name required; phone OR email required).
 *
 * "any" is resolved against the real availability grid first (first staff
 * whose grid still contains the exact slot). The RPC re-validates the slot
 * in-transaction and the bookings no-overlap EXCLUDE constraint is the
 * final race guard: a lost race surfaces as HTTP 409 { code: "slot_taken" }
 * and the Review step routes the customer back to Time with F-08.
 *
 * 201: { bookingId, manageToken, status, holdExpiresAt, amountDueCents }
 * The manage token is returned exactly once — the client stores it in
 * sessionStorage and passes it to the confirmation page as ?t=.
 */
import { NextResponse, type NextRequest } from "next/server";

import {
  computeAvailability,
  mapDbError,
  resolveAnyStaff,
} from "@/app/b/[slug]/_lib/server-data";
import { createBooking } from "@/lib/db/bookings";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_input", "Request body must be JSON.");
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const customer = (b.customer ?? {}) as Record<string, unknown>;
  const businessId = String(b.businessId ?? "");
  const serviceId = String(b.serviceId ?? "");
  const staffIdRaw = String(b.staffId ?? "");
  const startsAt = String(b.startsAt ?? "");
  const endsAt = String(b.endsAt ?? "");
  const name = String(customer.name ?? "").trim();
  const phone = String(customer.phone ?? "").trim();
  const email = String(customer.email ?? "").trim();
  const notes = String(customer.notes ?? "");

  if (!UUID.test(businessId) || !UUID.test(serviceId)) {
    return jsonError(400, "invalid_input", "businessId and serviceId are required.");
  }
  if (staffIdRaw !== "any" && !UUID.test(staffIdRaw)) {
    return jsonError(400, "invalid_input", "staffId must be a uuid or 'any'.");
  }
  if (!startsAt || !endsAt || Number.isNaN(Date.parse(startsAt)) || Number.isNaN(Date.parse(endsAt))) {
    return jsonError(400, "invalid_input", "startsAt and endsAt must be ISO timestamps.");
  }
  if (!name) {
    return jsonError(400, "customer_name_required", "Your name is required.");
  }
  if (!phone && !email) {
    return jsonError(400, "customer_contact_required", "Give an email or a mobile number so the shop can reach you.");
  }

  try {
    let staffId = staffIdRaw;
    if (staffIdRaw === "any") {
      // Resolve first-available against the real grid. The grid is keyed
      // by business-local date, which can sit a day either side of the UTC
      // date — so resolve over a ±1-day window around the instant.
      const ms = Date.parse(startsAt);
      const computed = await computeAvailability({
        businessId,
        serviceId,
        staffId: null,
        from: new Date(ms - 86_400_000).toISOString().slice(0, 10),
        to: new Date(ms + 86_400_000).toISOString().slice(0, 10),
      });
      const resolved = resolveAnyStaff(computed, startsAt, endsAt);
      if (!resolved) {
        return jsonError(409, "slot_taken", "That slot was just taken. Please pick another time.");
      }
      staffId = resolved;
    }

    const result = await createBooking(null, {
      businessId,
      serviceId,
      staffId,
      startsAt,
      endsAt,
      customerName: name,
      customerPhone: phone || null,
      customerEmail: email || null,
      customerNotes: notes,
      source: "online",
    });

    return NextResponse.json(
      {
        bookingId: result.booking.id,
        manageToken: result.manage_token,
        status: result.status,
        holdExpiresAt: result.hold_expires_at,
        amountDueCents: result.amount_due_cents,
      },
      { status: 201 },
    );
  } catch (err) {
    const mapped = mapDbError(err, "Could not create the booking.");
    return jsonError(mapped.status, mapped.code, mapped.message);
  }
}
