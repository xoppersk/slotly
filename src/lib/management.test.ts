/**
 * Unit tests for the dashboard management helpers (src/lib/management.ts).
 */

import { describe, expect, it } from "vitest";

import {
  buildWeeklyRuleRows,
  clampDuration,
  defaultWeeklyGrid,
  dollarsToCents,
  formatDuration,
  formatTimeLabel,
  isValidDayRange,
  toTimeString,
  validateServicePayment,
} from "./management";

describe("toTimeString", () => {
  it("pads to HH:MM:SS", () => {
    expect(toTimeString("9:00")).toBe("09:00:00");
    expect(toTimeString("17:30")).toBe("17:30:00");
  });
});

describe("formatTimeLabel", () => {
  it("formats 24h times as 12h labels", () => {
    expect(formatTimeLabel("09:00")).toBe("9:00 AM");
    expect(formatTimeLabel("13:30")).toBe("1:30 PM");
    expect(formatTimeLabel("00:00")).toBe("12:00 AM");
    expect(formatTimeLabel("12:00")).toBe("12:00 PM");
  });
});

describe("isValidDayRange", () => {
  it("requires close after open", () => {
    expect(isValidDayRange("09:00", "17:00")).toBe(true);
    expect(isValidDayRange("17:00", "09:00")).toBe(false);
    expect(isValidDayRange("09:00", "09:00")).toBe(false);
  });
});

describe("defaultWeeklyGrid", () => {
  it("opens Mon-Fri 9-5 and closes the weekend", () => {
    const grid = defaultWeeklyGrid();
    expect(grid).toHaveLength(7);
    expect(grid[0]).toMatchObject({ weekday: 0, isClosed: true });
    expect(grid[1]).toMatchObject({
      weekday: 1,
      isClosed: false,
      openTime: "09:00",
      closeTime: "17:00",
    });
    expect(grid[6]).toMatchObject({ weekday: 6, isClosed: true });
  });
});

describe("buildWeeklyRuleRows", () => {
  it("emits rows only for open days, with converted times", () => {
    const rows = buildWeeklyRuleRows("biz-1", null, defaultWeeklyGrid());
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual({
      business_id: "biz-1",
      staff_id: null,
      weekday: 1,
      open_time: "09:00:00",
      close_time: "17:00:00",
      is_closed: false,
    });
  });

  it("passes staff_id through for per-staff overrides", () => {
    const rows = buildWeeklyRuleRows("biz-1", "staff-9", [
      { weekday: 2, isClosed: false, openTime: "10:00", closeTime: "14:00" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.staff_id).toBe("staff-9");
    expect(rows[0]?.weekday).toBe(2);
  });
});

describe("validateServicePayment", () => {
  it("accepts a valid deposit policy", () => {
    expect(
      validateServicePayment({
        priceCents: 8000,
        paymentPolicy: "deposit",
        depositCents: 2000,
      }),
    ).toEqual([]);
  });

  it("rejects a deposit larger than the price", () => {
    const errors = validateServicePayment({
      priceCents: 5000,
      paymentPolicy: "deposit",
      depositCents: 6000,
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join(" ")).toMatch(/more than the full price/);
  });

  it("requires a positive deposit for the deposit policy", () => {
    const errors = validateServicePayment({
      priceCents: 5000,
      paymentPolicy: "deposit",
      depositCents: 0,
    });
    expect(errors.join(" ")).toMatch(/greater than \$0/);
  });

  it("allows a zero deposit when the policy is none", () => {
    expect(
      validateServicePayment({
        priceCents: 5000,
        paymentPolicy: "none",
        depositCents: 0,
      }),
    ).toEqual([]);
  });
});

describe("clampDuration", () => {
  it("snaps to 5-minute steps within 5..480", () => {
    expect(clampDuration(47)).toBe(45);
    expect(clampDuration(48)).toBe(50);
    expect(clampDuration(3)).toBe(5);
    expect(clampDuration(999)).toBe(480);
  });
});

describe("formatDuration", () => {
  it("formats minutes compactly", () => {
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(90)).toBe("1h 30m");
  });
});

describe("dollarsToCents", () => {
  it("converts and rounds", () => {
    expect(dollarsToCents(20)).toBe(2000);
    expect(dollarsToCents(19.99)).toBe(1999);
    expect(dollarsToCents(Number.NaN)).toBe(0);
    expect(dollarsToCents(-5)).toBe(0);
  });
});
