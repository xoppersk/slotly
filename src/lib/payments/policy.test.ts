import { describe, expect, it } from "vitest";

import {
  amountDueNow,
  buildIdempotencyKey,
  canAutoRefund,
  formatReceipt,
  remainingRefundable,
} from "./policy";

describe("amountDueNow", () => {
  it("policy none: nothing due now, full price due later", () => {
    expect(amountDueNow({ paymentPolicy: "none", priceCents: 2000, depositCents: 0 })).toEqual({
      dueNowCents: 0,
      dueLaterCents: 2000,
      kind: null,
    });
  });

  it("policy deposit: splits deposit now, remainder later", () => {
    expect(
      amountDueNow({ paymentPolicy: "deposit", priceCents: 2000, depositCents: 500 }),
    ).toEqual({ dueNowCents: 500, dueLaterCents: 1500, kind: "deposit" });
  });

  it("deposit equal to price: nothing due later", () => {
    expect(
      amountDueNow({ paymentPolicy: "deposit", priceCents: 2000, depositCents: 2000 }),
    ).toEqual({ dueNowCents: 2000, dueLaterCents: 0, kind: "deposit" });
  });

  it("policy full: entire price due now", () => {
    expect(amountDueNow({ paymentPolicy: "full", priceCents: 2000, depositCents: 0 })).toEqual({
      dueNowCents: 2000,
      dueLaterCents: 0,
      kind: "full_payment",
    });
  });

  it("zero-price service: all policies yield zeros", () => {
    expect(amountDueNow({ paymentPolicy: "full", priceCents: 0, depositCents: 0 })).toEqual({
      dueNowCents: 0,
      dueLaterCents: 0,
      kind: "full_payment",
    });
    expect(amountDueNow({ paymentPolicy: "none", priceCents: 0, depositCents: 0 })).toEqual({
      dueNowCents: 0,
      dueLaterCents: 0,
      kind: null,
    });
  });

  it("throws when deposit exceeds price", () => {
    expect(() =>
      amountDueNow({ paymentPolicy: "deposit", priceCents: 2000, depositCents: 2001 }),
    ).toThrow(/cannot exceed/);
  });

  it("throws on negative or non-integer amounts", () => {
    expect(() =>
      amountDueNow({ paymentPolicy: "full", priceCents: -1, depositCents: 0 }),
    ).toThrow(/priceCents/);
    expect(() =>
      amountDueNow({ paymentPolicy: "deposit", priceCents: 2000, depositCents: -50 }),
    ).toThrow(/depositCents/);
    expect(() =>
      amountDueNow({ paymentPolicy: "full", priceCents: 19.99, depositCents: 0 }),
    ).toThrow(/priceCents/);
  });
});

describe("buildIdempotencyKey", () => {
  it("builds slotly:{bookingId}:{kind}", () => {
    expect(buildIdempotencyKey("b123", "deposit")).toBe("slotly:b123:deposit");
    expect(buildIdempotencyKey("b123", "full_payment")).toBe("slotly:b123:full_payment");
  });

  it("throws on empty booking id", () => {
    expect(() => buildIdempotencyKey("", "deposit")).toThrow(/bookingId/);
  });
});

describe("remainingRefundable", () => {
  it("subtracts prior refunds", () => {
    expect(remainingRefundable(2000, [500])).toBe(1500);
    expect(remainingRefundable(2000, [500, 250])).toBe(1250);
  });

  it("returns the full amount with no prior refunds", () => {
    expect(remainingRefundable(2000, [])).toBe(2000);
  });

  it("clamps over-refunds to zero instead of going negative", () => {
    expect(remainingRefundable(2000, [2500])).toBe(0);
    expect(remainingRefundable(2000, [2000])).toBe(0);
  });

  it("throws on negative inputs", () => {
    expect(() => remainingRefundable(-1, [])).toThrow();
    expect(() => remainingRefundable(2000, [-5])).toThrow();
  });
});

describe("canAutoRefund", () => {
  const startsAt = new Date("2026-03-12T14:00:00Z");

  it("true when cancelled inside the free-cancel window with a succeeded payment", () => {
    expect(
      canAutoRefund({
        bookingStatus: "cancelled",
        paymentStatus: "succeeded",
        cancelledAt: new Date("2026-03-10T14:00:00Z"), // 48h before
        startsAt,
        freeCancelHours: 24,
      }),
    ).toBe(true);
  });

  it("true exactly at the window boundary", () => {
    expect(
      canAutoRefund({
        bookingStatus: "cancelled",
        paymentStatus: "succeeded",
        cancelledAt: new Date("2026-03-11T14:00:00Z"), // exactly 24h before
        startsAt,
        freeCancelHours: 24,
      }),
    ).toBe(true);
  });

  it("false when cancelled outside the free-cancel window", () => {
    expect(
      canAutoRefund({
        bookingStatus: "cancelled",
        paymentStatus: "succeeded",
        cancelledAt: new Date("2026-03-12T02:00:00Z"), // 12h before
        startsAt,
        freeCancelHours: 24,
      }),
    ).toBe(false);
  });

  it("false unless the booking is cancelled and paid", () => {
    const base = {
      cancelledAt: new Date("2026-03-10T14:00:00Z"),
      startsAt,
      freeCancelHours: 24,
    };
    expect(canAutoRefund({ ...base, bookingStatus: "confirmed", paymentStatus: "succeeded" })).toBe(
      false,
    );
    expect(canAutoRefund({ ...base, bookingStatus: "cancelled", paymentStatus: "failed" })).toBe(
      false,
    );
    expect(canAutoRefund({ ...base, bookingStatus: "cancelled", paymentStatus: "pending" })).toBe(
      false,
    );
  });

  it("false when cancelled after the appointment started", () => {
    expect(
      canAutoRefund({
        bookingStatus: "cancelled",
        paymentStatus: "succeeded",
        cancelledAt: new Date("2026-03-12T15:00:00Z"),
        startsAt,
        freeCancelHours: 24,
      }),
    ).toBe(false);
  });

  it("throws on negative freeCancelHours", () => {
    expect(() =>
      canAutoRefund({
        bookingStatus: "cancelled",
        paymentStatus: "succeeded",
        cancelledAt: new Date("2026-03-10T14:00:00Z"),
        startsAt,
        freeCancelHours: -1,
      }),
    ).toThrow(/freeCancelHours/);
  });
});

describe("formatReceipt", () => {
  it("full payment receipt shows amount, reference, and paid-in-full line", () => {
    const lines = formatReceipt({
      amountCents: 2000,
      currency: "USD",
      paymentIntentId: "pi_123",
      kind: "full_payment",
    });
    expect(lines).toContain("Amount charged: $20.00");
    expect(lines).toContain("Payment reference: pi_123");
    expect(lines.some((l) => /paid in full/i.test(l))).toBe(true);
  });

  it("deposit receipt shows what is due at the appointment", () => {
    const lines = formatReceipt({
      amountCents: 500,
      currency: "USD",
      paymentIntentId: "pi_456",
      kind: "deposit",
      dueLaterCents: 1500,
    });
    expect(lines).toContain("Amount charged: $5.00");
    expect(lines).toContain("Due at your appointment: $15.00");
  });

  it("deposit equal to price notes nothing is due later", () => {
    const lines = formatReceipt({
      amountCents: 2000,
      currency: "USD",
      paymentIntentId: "pi_789",
      kind: "deposit",
      dueLaterCents: 0,
    });
    expect(lines.some((l) => /nothing due/i.test(l))).toBe(true);
  });

  it("throws without a payment intent id", () => {
    expect(() =>
      formatReceipt({ amountCents: 2000, currency: "USD", paymentIntentId: "", kind: "full_payment" }),
    ).toThrow(/paymentIntentId/);
  });
});
