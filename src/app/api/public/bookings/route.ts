/**
 * POST /api/public/bookings — create a public booking (no auth).
 *
 * Validates input with Zod, delegates to the `create_public_booking`
 * SECURITY DEFINER function (PostgreSQL, migration 00010): service lookup,
 * slot revalidation against v_slot_minutes + bookings (double-booking
 * safe via pg_advisory_xact_lock), staff validation, slot alignment,
 * customer upsert, and a 15-minute hold keyed by an idempotency key
 * generated from the request payload.
 *
 * 201: { booking: Booking, manageToken } — manageToken is returned RAW
 * only once; the manage URL must be built with it immediately.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { mapDbError } from "@/app/b/[slug]/_lib/server-data";
import { createPublicBooking } from "@/lib/db/bookings";

const CreateBookingSchema = z.object({
  businessId: z.string().uuid(),
  serviceId: z.string().uuid(),
  staffId: z.string().uuid().nullable().optional(),
  startsAt: z.string().datetime({ offset: true }),
  name: z.string().trim().min(1, "name is required").max(120),
  phone: z.string().trim().min(4, "phone is required").max(40),
  notes: z.string().trim().max(500).optional(),
});

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
  const parsed = CreateBookingSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "invalid_input", parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const input = parsed.data;

  try {
    const result = await createPublicBooking(null, {
      businessId: input.businessId,
      serviceId: input.serviceId,
      staffId: input.staffId ?? null,
      startsAt: input.startsAt,
      name: input.name,
      phone: input.phone,
      notes: input.notes ?? null,
    });
    return NextResponse.json(
      { booking: result.booking, manageToken: result.manage_token },
      { status: 201 },
    );
  } catch (err) {
    const mapped = mapDbError(err, "Could not create the booking.");
    return jsonError(mapped.status, mapped.code, mapped.message);
  }
}
