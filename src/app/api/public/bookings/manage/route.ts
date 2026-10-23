/**
 * POST /api/public/bookings/manage — cancel or reschedule via magic link.
 *
 * Delegates to the `manage_booking` SECURITY DEFINER function (PostgreSQL,
 * migration 00010): token hash verification, 72h expiry, slot revalidation
 * and token ROTATION all happen inside the function. The response carries
 * the NEW raw manage token — the link the customer just used stops working,
 * so the client redirects to the new token's manage URL.
 *
 * Body: { token, action: "cancel" | "reschedule", reason?,
 *         newStartsAt?, newEndsAt?, newStaffId? }
 * 200: { booking, manageToken }
 */
import { NextResponse, type NextRequest } from "next/server";

import { mapDbError } from "@/app/b/[slug]/_lib/server-data";
import { manageBooking } from "@/lib/db/bookings";

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
  const token = String(b.token ?? "");
  const action = String(b.action ?? "");
  if (!token || token.length < 20) {
    return jsonError(400, "invalid_manage_token", "This booking link is invalid.");
  }
  if (action !== "cancel" && action !== "reschedule") {
    return jsonError(400, "invalid_action", "That action is not allowed on this booking.");
  }
  const newStartsAt = b.newStartsAt ? String(b.newStartsAt) : null;
  const newEndsAt = b.newEndsAt ? String(b.newEndsAt) : null;
  if (action === "reschedule" && (!newStartsAt || !newEndsAt)) {
    return jsonError(400, "new_slot_required", "Pick a new time first.");
  }

  try {
    const result = await manageBooking(null, token, action, {
      reason: b.reason ? String(b.reason) : null,
      newStartsAt,
      newEndsAt,
      newStaffId: b.newStaffId ? String(b.newStaffId) : null,
    });
    return NextResponse.json({
      booking: result.booking,
      manageToken: result.manage_token,
    });
  } catch (err) {
    const mapped = mapDbError(err, "Could not update the booking.");
    return jsonError(mapped.status, mapped.code, mapped.message);
  }
}
