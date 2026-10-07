import { describe, expect, it } from "vitest";

import {
  appleCalendarDataUri,
  buildIcs,
  CalendarEventInput,
  escapeIcsText,
  googleCalendarUrl,
  toIcsDateTime,
} from "./calendar";

const EVENT: CalendarEventInput = {
  title: "Haircut with Kofi",
  description: "Booking reference: SLT-8F3K2A\nManage: https://slotly.app/manage/abc",
  location: "Harbor & Pine, 123 Main St",
  startsAtUtcIso: "2026-03-09T14:00:00Z",
  endsAtUtcIso: "2026-03-09T14:30:00Z",
  organizerEmail: "book@harborpine.com",
  url: "https://slotly.app/manage/abc",
};

describe("escapeIcsText", () => {
  it("escapes backslashes, commas, semicolons, and newlines", () => {
    expect(escapeIcsText("a,b;c\\d\ne\rf\ng")).toBe("a\\,b\\;c\\\\d\\ne\\nf\\ng");
  });

  it("leaves plain text untouched", () => {
    expect(escapeIcsText("Haircut")).toBe("Haircut");
  });
});

describe("toIcsDateTime", () => {
  it("formats UTC instants in basic format with Z suffix", () => {
    expect(toIcsDateTime("2026-03-09T14:00:00Z")).toBe("20260309T140000Z");
  });

  it("normalizes offset input to UTC", () => {
    expect(toIcsDateTime("2026-03-09T10:00:00-04:00")).toBe("20260309T140000Z");
  });

  it("throws on invalid input", () => {
    expect(() => toIcsDateTime("not-a-date")).toThrow(/Invalid ISO date/);
  });
});

describe("buildIcs", () => {
  it("produces a valid single-VEVENT calendar with UTC timestamps", () => {
    const ics = buildIcs(EVENT);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART:20260309T140000Z");
    expect(ics).toContain("DTEND:20260309T143000Z");
    expect(ics).toContain("SUMMARY:Haircut with Kofi");
    expect(ics).toContain("LOCATION:Harbor & Pine\\, 123 Main St");
    expect(ics).toContain("ORGANIZER:mailto:book@harborpine.com");
    expect(ics).toContain("URL:https://slotly.app/manage/abc");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toMatch(/\r\n/); // CRLF line endings
  });

  it("escapes newlines in the description", () => {
    const ics = buildIcs(EVENT);
    expect(ics).toContain("DESCRIPTION:Booking reference: SLT-8F3K2A\\nManage:");
    expect(ics).not.toContain("DESCRIPTION:Booking reference: SLT-8F3K2A\nManage:");
  });

  it("generates a unique UID per call", () => {
    const a = buildIcs(EVENT);
    const b = buildIcs(EVENT);
    const uid = (ics: string) => ics.match(/^UID:(.+)$/m)![1];
    expect(uid(a)).not.toBe(uid(b));
    expect(uid(a)).toMatch(/@slotly$/);
  });

  it("omits optional fields when absent", () => {
    const ics = buildIcs({
      title: "Trim",
      description: "d",
      location: "l",
      startsAtUtcIso: "2026-03-09T14:00:00Z",
      endsAtUtcIso: "2026-03-09T14:30:00Z",
    });
    expect(ics).not.toContain("ORGANIZER");
    expect(ics).not.toContain("URL:");
  });

  it("throws when the end is not after the start", () => {
    expect(() =>
      buildIcs({ ...EVENT, endsAtUtcIso: "2026-03-09T14:00:00Z" }),
    ).toThrow(/must be after/);
    expect(() =>
      buildIcs({ ...EVENT, startsAtUtcIso: "garbage" }),
    ).toThrow(/Invalid ISO date/);
  });
});

describe("googleCalendarUrl", () => {
  it("builds a template link with encoded params", () => {
    const url = googleCalendarUrl(EVENT);
    expect(url.startsWith("https://calendar.google.com/calendar/render?")).toBe(true);
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("action")).toBe("TEMPLATE");
    expect(params.get("text")).toBe("Haircut with Kofi");
    expect(params.get("dates")).toBe("20260309T140000Z/20260309T143000Z");
    expect(params.get("location")).toBe("Harbor & Pine, 123 Main St");
    expect(params.get("details")).toContain("SLT-8F3K2A");
    expect(params.get("details")).toContain("https://slotly.app/manage/abc");
  });

  it("throws on an invalid range", () => {
    expect(() =>
      googleCalendarUrl({ ...EVENT, endsAtUtcIso: EVENT.startsAtUtcIso }),
    ).toThrow(/must be after/);
  });
});

describe("appleCalendarDataUri", () => {
  it("wraps the ICS in a download data URI", () => {
    const ics = buildIcs(EVENT);
    const uri = appleCalendarDataUri(ics);
    expect(uri.startsWith("data:text/calendar;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(uri)).toContain("BEGIN:VCALENDAR");
  });
});
