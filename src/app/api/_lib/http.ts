/**
 * Shared helpers for Slotly's API route handlers (Wave 3C).
 *
 * Server-only: rate limiting, client IP extraction, and the standard
 * `{ code, message }` JSON error envelope. Never import from client code.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";

import { checkRateLimit } from "@/lib/rate-limit";

export function jsonError(
  code: string,
  message: string,
  status: number,
): NextResponse {
  return NextResponse.json({ code, message }, { status });
}

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Enforce the per-IP rate limit for a route. Returns a 429 response when
 * the bucket is exhausted, or `null` when the request may proceed.
 */
export function rateLimitOr429(
  request: NextRequest,
  limit: number,
): NextResponse | null {
  const key = `slotly-api:${request.nextUrl.pathname}:${clientIp(request)}`;
  const result = checkRateLimit(key, { limit, windowMs: 60_000 });
  if (!result.allowed) {
    const res = jsonError(
      "rate_limited",
      "Too many requests. Please slow down and try again.",
      429,
    );
    res.headers.set("Retry-After", "60");
    return res;
  }
  return null;
}

/** Map a Zod failure to the standard `{ code: "invalid_input" }` 400. */
export function zodError(error: z.ZodError): NextResponse {
  const first = error.issues[0];
  const where = first?.path.length ? `${first.path.join(".")}: ` : "";
  return jsonError("invalid_input", `${where}${first?.message ?? "Invalid input"}`, 400);
}
