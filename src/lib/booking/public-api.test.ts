import { describe, expect, it } from "vitest";

import {
  ApiError,
  apiJson,
  isValidTokenShape,
  pickNearestAlternatives,
  type ApiDayAvailability,
} from "./public-api";

describe("isValidTokenShape", () => {
  it("accepts URL-safe tokens of at least 20 chars", () => {
    expect(isValidTokenShape("a".repeat(20))).toBe(true);
    expect(isValidTokenShape("Abc123_-XYZ".repeat(3))).toBe(true);
  });

  it("rejects short or malformed tokens", () => {
    expect(isValidTokenShape("")).toBe(false);
    expect(isValidTokenShape("short")).toBe(false);
    expect(isValidTokenShape("has space in it abcdefghij")).toBe(false);
    expect(isValidTokenShape("has/slash/xxxxxxxxxxxxxxxx")).toBe(false);
  });
});

describe("pickNearestAlternatives", () => {
  const days: ApiDayAvailability[] = [
    {
      date: "2026-10-08",
      status: "open",
      slots: [
        { startsAt: "2026-10-08T13:00:00Z", endsAt: "2026-10-08T14:00:00Z", staffId: "s1" },
        { startsAt: "2026-10-08T14:00:00Z", endsAt: "2026-10-08T15:00:00Z", staffId: "s1" },
        { startsAt: "2026-10-08T15:00:00Z", endsAt: "2026-10-08T16:00:00Z", staffId: "s2" },
      ],
    },
    {
      date: "2026-10-09",
      status: "open",
      slots: [
        { startsAt: "2026-10-09T09:00:00Z", endsAt: "2026-10-09T10:00:00Z", staffId: "s1" },
      ],
    },
  ];

  it("returns the next slots strictly after the missed one", () => {
    const alt = pickNearestAlternatives(days, "2026-10-08T13:00:00Z", 3);
    expect(alt.map((s) => s.startsAt)).toEqual([
      "2026-10-08T14:00:00Z",
      "2026-10-08T15:00:00Z",
      "2026-10-09T09:00:00Z",
    ]);
  });

  it("returns fewer when the window is exhausted", () => {
    const alt = pickNearestAlternatives(days, "2026-10-09T09:00:00Z", 3);
    expect(alt).toEqual([]);
  });
});

describe("ApiError / apiJson", () => {
  it("throws ApiError with the server code on non-2xx", async () => {
    const res = new Response(JSON.stringify({ code: "slot_taken" }), {
      status: 409,
    });
    await expect(apiJson(res, "Booking failed")).rejects.toMatchObject({
      code: "slot_taken",
      status: 409,
    });
  });

  it("returns the parsed body on success", async () => {
    const res = new Response(JSON.stringify({ ok: true }), { status: 200 });
    await expect(apiJson<{ ok: boolean }>(res, "x")).resolves.toEqual({
      ok: true,
    });
  });

  it("ApiError falls back gracefully without a JSON body", () => {
    const err = new ApiError(500, null, "Server error");
    expect(err.code).toBe("unknown");
    expect(err.message).toBe("Server error");
  });
});
