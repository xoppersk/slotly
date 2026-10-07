/**
 * GET /api/customers/lookup — repeat-customer pre-fill (public, PII-safe).
 *
 * Matches by phone number within one business and returns ONLY `{ name,
 * email }` — no history, no notes, no other identifiers. Phone matching is
 * done on the last 10 digits so formatting/country-code differences don't
 * matter. Tighter rate limit (30/min/IP) since this is an enumeration
 * surface: the response reveals nothing beyond what the caller already
 * knew (the phone number).
 *
 * 200 { name, email } | 404 { code: "customer_not_found" }
 */

import { NextResponse, type NextRequest } from "next/server";

import { CustomerLookupQuerySchema } from "@/lib/api/schemas";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

import { jsonError, jsonOk, rateLimitOr429, zodError } from "../../_lib/http";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const limited = rateLimitOr429(request, 30);
  if (limited) return limited;

  const parsed = CustomerLookupQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) return zodError(parsed.error);
  const { businessId, phone } = parsed.data;

  const digits = phone.replace(/\D/g, "");
  const last10 = digits.slice(-10);
  if (last10.length < 7) {
    return jsonError("invalid_input", "phone: Phone number looks too short", 400);
  }

  const svc = createServiceRoleClient();
  const { data, error } = await svc
    .from("customers")
    .select("name, email, phone")
    .eq("business_id", businessId)
    .like("phone", `%${last10}`)
    .limit(25);
  if (error) {
    return jsonError("internal_error", "Lookup failed. Please try again.", 500);
  }

  const match = (data ?? []).find(
    (c) => (c.phone ?? "").replace(/\D/g, "").slice(-10) === last10,
  );
  if (!match) {
    return jsonError(
      "customer_not_found",
      "No saved details for that number.",
      404,
    );
  }

  // PII-minimal: name + email only. Never history, notes, or other fields.
  return jsonOk({ name: match.name, email: match.email });
}
