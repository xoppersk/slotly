import { describe, expect, it } from "vitest";

import {
  formatTimeShort,
  formatWhenLabel,
  greetingForHour,
  noShowRate,
} from "./format";

describe("dashboard format helpers", () => {
  it("formats times in the business timezone", () => {
    // 2026-10-06T14:00:00Z is 10:00 AM in America/New_York (EDT)
    expect(formatTimeShort("2026-10-06T14:00:00Z", "America/New_York")).toBe(
      "10:00 AM"
    );
    expect(formatWhenLabel("2026-10-06T14:00:00Z", "America/New_York")).toBe(
      "Tuesday at 10:00 AM"
    );
  });

  it("picks a greeting by hour", () => {
    expect(greetingForHour(8)).toBe("Good morning");
    expect(greetingForHour(13)).toBe("Good afternoon");
    expect(greetingForHour(20)).toBe("Good evening");
  });

  it("computes no-show rate with a zero-history guard", () => {
    expect(noShowRate(2, 8)).toBe(20);
    expect(noShowRate(0, 0)).toBe(0);
  });
});
