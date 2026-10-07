import { describe, expect, it } from "vitest";
import { formatInTimeZone } from "date-fns-tz";

import {
  businessLocalRangeToUtc,
  dualTimeLabel,
  iterateBusinessDays,
  nowInTimezone,
  toBusinessDayKey,
} from "./timezone";

const NY = "America/New_York";
const FREETOWN = "Africa/Freetown";

describe("nowInTimezone", () => {
  it("returns the current instant", () => {
    const before = Date.now();
    const now = nowInTimezone(NY);
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe("toBusinessDayKey", () => {
  it("maps a UTC instant to the business-local day", () => {
    // 2026-03-08T06:30:00Z = 01:30 EST (before the spring-forward jump)
    expect(toBusinessDayKey("2026-03-08T06:30:00Z", NY)).toBe("2026-03-08");
    // Same instant is still the previous local day in zones far west
    expect(toBusinessDayKey("2026-03-08T06:30:00Z", "Pacific/Kiritimati")).toBe("2026-03-08");
  });

  it("handles midnight boundaries", () => {
    // 04:30Z = 00:30 EDT on the 8th
    expect(toBusinessDayKey("2026-03-09T04:30:00Z", NY)).toBe("2026-03-09");
    // 03:30Z = 23:30 EST on the 8th
    expect(toBusinessDayKey("2026-03-09T03:30:00Z", NY)).toBe("2026-03-08");
  });
});

describe("businessLocalRangeToUtc", () => {
  it("converts a normal business day to UTC (EDT in March)", () => {
    const { startsAtUtc, endsAtUtc } = businessLocalRangeToUtc("2026-03-09", "09:00", "17:00", NY);
    expect(startsAtUtc.toISOString()).toBe("2026-03-09T13:00:00.000Z");
    expect(endsAtUtc.toISOString()).toBe("2026-03-09T21:00:00.000Z");
  });

  it("uses EST in winter", () => {
    const { startsAtUtc } = businessLocalRangeToUtc("2026-01-15", "09:00", "17:00", NY);
    expect(startsAtUtc.toISOString()).toBe("2026-01-15T14:00:00.000Z");
  });

  it("passes through a no-DST zone (Freetown) unchanged", () => {
    const { startsAtUtc, endsAtUtc } = businessLocalRangeToUtc(
      "2026-03-08",
      "09:00",
      "17:00",
      FREETOWN,
    );
    expect(startsAtUtc.toISOString()).toBe("2026-03-08T09:00:00.000Z");
    expect(endsAtUtc.toISOString()).toBe("2026-03-08T17:00:00.000Z");
  });

  it("spring-forward gap: shifts forward past the gap, never an invalid instant", () => {
    // 02:30 never occurs on 2026-03-08 in NY; expect a shift to 03:30 EDT.
    const { startsAtUtc, endsAtUtc } = businessLocalRangeToUtc(
      "2026-03-08",
      "02:30",
      "04:00",
      NY,
    );
    const wall = (d: Date) => formatInTimeZone(d, NY, "yyyy-MM-dd'T'HH:mm:ss");
    expect(wall(startsAtUtc)).toBe("2026-03-08T03:30:00");
    expect(wall(endsAtUtc)).toBe("2026-03-08T04:00:00");
    expect(startsAtUtc.toISOString()).toBe("2026-03-08T07:30:00.000Z");
  });

  it("fall-back ambiguous time resolves to a valid instant (offset disambiguates)", () => {
    // 01:30 occurs twice on 2026-11-01; either occurrence round-trips cleanly.
    const { startsAtUtc } = businessLocalRangeToUtc("2026-11-01", "01:30", "03:00", NY);
    expect(formatInTimeZone(startsAtUtc, NY, "yyyy-MM-dd'T'HH:mm:ss")).toBe(
      "2026-11-01T01:30:00",
    );
  });

  it("throws when close is not after open", () => {
    expect(() => businessLocalRangeToUtc("2026-03-09", "17:00", "09:00", NY)).toThrow(
      /must be after openTime/,
    );
    expect(() => businessLocalRangeToUtc("2026-03-09", "09:00", "09:00", NY)).toThrow(
      /must be after openTime/,
    );
  });

  it("throws on malformed date/time inputs", () => {
    expect(() => businessLocalRangeToUtc("03/09/2026", "09:00", "17:00", NY)).toThrow(/YYYY-MM-DD/);
    expect(() => businessLocalRangeToUtc("2026-03-09", "9am", "17:00", NY)).toThrow(/HH:MM/);
    expect(() => businessLocalRangeToUtc("2026-03-09", "09:00", "25:00", NY)).toThrow(/HH:MM/);
  });
});

describe("dualTimeLabel", () => {
  it("labels the slot in both zones when they differ", () => {
    // 14:00Z = 10:00 AM EDT = 2:00 PM GMT (Freetown)
    const label = dualTimeLabel("2026-03-09T14:00:00Z", NY, FREETOWN);
    expect(label).toEqual({ customer: "2:00 PM", business: "10:00 AM", different: true });
  });

  it("marks identical zones as not different", () => {
    const label = dualTimeLabel("2026-03-09T14:00:00Z", NY, NY);
    expect(label.different).toBe(false);
    expect(label.customer).toBe(label.business);
  });

  it("treats zones sharing wall time as not different (no redundant parenthetical)", () => {
    // In March, London (GMT) and Freetown (GMT) render the same label.
    const label = dualTimeLabel("2026-03-09T14:00:00Z", FREETOWN, "Europe/London");
    expect(label.customer).toBe("2:00 PM");
    expect(label.business).toBe("2:00 PM");
    expect(label.different).toBe(false);
  });
});

describe("iterateBusinessDays", () => {
  it("lists consecutive day keys across the spring-forward transition", () => {
    expect(iterateBusinessDays("2026-03-06", 5, NY)).toEqual([
      "2026-03-06",
      "2026-03-07",
      "2026-03-08",
      "2026-03-09",
      "2026-03-10",
    ]);
  });

  it("lists consecutive day keys across the fall-back transition", () => {
    expect(iterateBusinessDays("2026-10-30", 4, NY)).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("works in a no-DST zone", () => {
    expect(iterateBusinessDays("2026-03-06", 3, FREETOWN)).toEqual([
      "2026-03-06",
      "2026-03-07",
      "2026-03-08",
    ]);
  });

  it("returns an empty list for zero days and throws on negative", () => {
    expect(iterateBusinessDays("2026-03-06", 0, NY)).toEqual([]);
    expect(() => iterateBusinessDays("2026-03-06", -1, NY)).toThrow(/non-negative/);
    expect(() => iterateBusinessDays("2026-03-06", 1.5, NY)).toThrow(/non-negative/);
  });
});
