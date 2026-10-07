/**
 * GET /api/bookings/receipt — booker-facing receipt via magic link (no auth).
 *
 * Verifies the token shape, reads the booking through the
 * `get_booking_receipt` SECURITY DEFINER function, and appends plain-text
 * receipt lines (via `formatReceipt`) when a payment succeeded.
 *
 * 200 { receipt, receiptLines }
 */

import { NextResponse, type NextRequest } from "next/server";

import { mapDbError } from "@/lib/api/errors";
import { buildReceiptLines } from "@/lib/api/receipt";
import { ReceiptQuerySchema } from "@/lib/api/schemas";
import { createClient } from "@/lib/supabase/server";
import { verifyManageTokenFormat } from "@/lib/tokens";

import { jsonError, jsonOk, rateLimitOr429, zodError } from "../../_lib/http";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const limited = rateLimitOr429(request, 100);
  if (limited) return limited;

  const parsed = ReceiptQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) return zodError(parsed.error);
  const { token } = parsed.data;

  if (!verifyManageTokenFormat(token)) {
    return jsonError("invalid_manage_token", "This manage link is invalid.", 400);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_booking_receipt", {
    p_token: token,
  });
  if (error || !data) {
    const mapped = mapDbError(error);
    return jsonError(mapped.code, mapped.message, mapped.status);
  }

  return jsonOk({ receipt: data, receiptLines: buildReceiptLines(data) });
}
