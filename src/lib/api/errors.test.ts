import { describe, expect, it } from "vitest";

import { mapDbError } from "./errors";

describe("mapDbError", () => {
  it("maps the EXCLUDE race (23P01) to 409 slot_taken", () => {
    const err = {
      code: "23P01",
      message:
        'duplicate key value violates exclusion constraint "no_overlap"',
    };
    expect(mapDbError(err)).toEqual({
      status: 409,
      code: "slot_taken",
      message: expect.stringContaining("just taken"),
    });
  });

  it("maps snake_case SQLERRM codes to their HTTP status", () => {
    expect(mapDbError({ message: "raise: slot_taken" }).status).toBe(409);
    expect(mapDbError({ message: "raise: invalid_manage_token" })).toMatchObject({
      status: 400,
      code: "invalid_manage_token",
    });
    expect(mapDbError({ message: "raise: manage_token_expired" })).toMatchObject({
      status: 410,
      code: "manage_token_expired",
    });
    expect(mapDbError({ message: "raise: below_min_lead_time" }).status).toBe(400);
    expect(mapDbError({ message: "raise: outside_hours" }).status).toBe(400);
  });

  it("maps duplicate payment rows (23505) to 409 payment_in_progress", () => {
    const err = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "payments_booking_id_kind"',
    };
    expect(mapDbError(err)).toMatchObject({
      status: 409,
      code: "payment_in_progress",
    });
  });

  it("maps unknown errors to 500 without leaking the raw message", () => {
    const raw = "secret internal detail: connection string postgres://x";
    const mapped = mapDbError(new Error(raw));
    expect(mapped.status).toBe(500);
    expect(mapped.code).toBe("internal_error");
    expect(mapped.message).not.toContain("postgres://");
    expect(mapped.message).not.toContain(raw);
  });

  it("handles non-object throws", () => {
    expect(mapDbError("boom").status).toBe(500);
    expect(mapDbError(null).status).toBe(500);
  });
});
