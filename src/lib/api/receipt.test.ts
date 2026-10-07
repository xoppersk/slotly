import { describe, expect, it } from "vitest";

import {
  buildReceiptLines,
  pickReceiptPayment,
  receiptDayKey,
  receiptToTemplateContext,
  shortReference,
} from "./receipt";

function receipt(overrides: Record<string, unknown> = {}) {
  return {
    booking: {
      id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
      starts_at: "2026-10-08T14:00:00Z", // 10:00 AM in America/New_York (EDT)
      ends_at: "2026-10-08T14:30:00Z",
      status: "confirmed",
      price_cents: 4000,
    },
    business: {
      name: "Harbor & Pine",
      timezone: "America/New_York",
      phone: "+15550001111",
      address: "12 Dock St",
      free_cancel_hours: 4,
    },
    service: {
      name: "Signature Cut",
      payment_policy: "deposit",
      deposit_cents: 2000,
      price_cents: 4000,
    },
    staff: { name: "Ada" },
    customer: { name: "Kwame", email: "kwame@example.com", phone: "+15551234567" },
    payments: [
      {
        amount_cents: 2000,
        currency: "usd",
        stripe_payment_intent_id: "pi_test_123",
        kind: "deposit",
        status: "succeeded",
      },
    ],
    ...overrides,
  };
}

describe("pickReceiptPayment", () => {
  it("picks the succeeded payment and computes the remainder", () => {
    const picked = pickReceiptPayment(receipt());
    expect(picked).toMatchObject({
      amountCents: 2000,
      currency: "usd",
      paymentIntentId: "pi_test_123",
      kind: "deposit",
      dueLaterCents: 2000,
    });
  });

  it("returns null when nothing succeeded", () => {
    const r = receipt({ payments: [] });
    expect(pickReceiptPayment(r)).toBeNull();
  });

  it("returns null on garbage input", () => {
    expect(pickReceiptPayment(null)).toBeNull();
    expect(pickReceiptPayment({})).toBeNull();
  });
});

describe("buildReceiptLines", () => {
  it("formats deposit receipt lines via formatReceipt", () => {
    const lines = buildReceiptLines(receipt());
    expect(lines).toEqual([
      "Amount charged: $20.00",
      "Payment reference: pi_test_123",
      "Due at your appointment: $20.00",
    ]);
  });

  it("returns an empty array when unpaid", () => {
    expect(buildReceiptLines(receipt({ payments: [] }))).toEqual([]);
  });
});

describe("receiptToTemplateContext", () => {
  it("renders business-local labels (EDT: 14:00Z -> 10:00 AM)", () => {
    const ctx = receiptToTemplateContext(receipt(), {
      manageUrl: "https://slotly.test/manage/abc",
    });
    expect(ctx.whenLabel).toBe("Thursday at 10:00 AM");
    expect(ctx.dateTimeLabel).toBe("Thursday, October 8 at 10:00 AM");
    expect(ctx.businessName).toBe("Harbor & Pine");
    expect(ctx.staffName).toBe("Ada");
    expect(ctx.customerName).toBe("Kwame");
    expect(ctx.bookingReference).toBe("AAAAAAAA");
    expect(ctx.manageUrl).toBe("https://slotly.test/manage/abc");
    expect(ctx.amountCharged).toBe("$20.00");
    expect(ctx.amountDueLater).toBe("$20.00");
    expect(ctx.freeCancelUntilLabel).toBe("Thursday at 6:00 AM");
  });

  it("carries the refund amount for cancellation notices", () => {
    const ctx = receiptToTemplateContext(receipt(), {
      manageUrl: "https://slotly.test/manage/abc",
      refundAmount: "$20.00",
    });
    expect(ctx.refundAmount).toBe("$20.00");
  });

  it("omits payment lines when unpaid", () => {
    const ctx = receiptToTemplateContext(receipt({ payments: [] }), {
      manageUrl: "https://slotly.test/manage/abc",
    });
    expect(ctx.amountCharged).toBeUndefined();
    expect(ctx.amountDueLater).toBeUndefined();
  });

  it("throws on garbage input", () => {
    expect(() =>
      receiptToTemplateContext(null, { manageUrl: "x" }),
    ).toThrow(TypeError);
  });
});

describe("receiptDayKey", () => {
  it("anchors on the business-local day", () => {
    expect(receiptDayKey(receipt())).toBe("2026-10-08");
  });
});

describe("shortReference", () => {
  it("derives an 8-char uppercase reference", () => {
    expect(shortReference("aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa")).toBe("AAAAAAAA");
  });
});
