/**
 * Calendar export for the booking confirmation screen: ICS download,
 * Google Calendar template link, and Apple Calendar data URI.
 *
 * Pure functions — safe to import from client components (uses only the
 * global `crypto.randomUUID`, no node: imports). RFC 5545: VTIMEZONE is
 * omitted and all timestamps are UTC with the Z suffix; text fields escape
 * backslashes, commas, semicolons, and newlines.
 */

export interface CalendarEventInput {
  title: string;
  description: string;
  location: string;
  /** ISO 8601 UTC instant, e.g. "2026-03-09T14:00:00Z". */
  startsAtUtcIso: string;
  /** ISO 8601 UTC instant. */
  endsAtUtcIso: string;
  organizerEmail?: string;
  /** Manage-booking URL, included in the description and as URL. */
  url?: string;
}

/** Escape a value for ICS TEXT fields (RFC 5545 §3.3.11). */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** "2026-03-09T14:00:00Z" → "20260309T140000Z" (basic format, UTC). */
export function toIcsDateTime(utcIso: string): string {
  const d = new Date(utcIso);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ISO date: ${utcIso}`);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

function assertValidRange(startsAtUtcIso: string, endsAtUtcIso: string): void {
  const start = new Date(startsAtUtcIso);
  const end = new Date(endsAtUtcIso);
  if (Number.isNaN(start.getTime())) throw new Error(`Invalid ISO date: ${startsAtUtcIso}`);
  if (Number.isNaN(end.getTime())) throw new Error(`Invalid ISO date: ${endsAtUtcIso}`);
  if (end.getTime() <= start.getTime()) {
    throw new Error("endsAtUtcIso must be after startsAtUtcIso");
  }
}

/**
 * Build a single-VEVENT .ics file body (CRLF line endings per RFC 5545).
 */
export function buildIcs(input: CalendarEventInput): string {
  assertValidRange(input.startsAtUtcIso, input.endsAtUtcIso);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Slotly//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${globalThis.crypto.randomUUID()}@slotly`,
    `DTSTAMP:${toIcsDateTime(new Date().toISOString())}`,
    `DTSTART:${toIcsDateTime(input.startsAtUtcIso)}`,
    `DTEND:${toIcsDateTime(input.endsAtUtcIso)}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
    `DESCRIPTION:${escapeIcsText(input.description)}`,
    `LOCATION:${escapeIcsText(input.location)}`,
    ...(input.organizerEmail
      ? [`ORGANIZER:mailto:${escapeIcsText(input.organizerEmail)}`]
      : []),
    ...(input.url ? [`URL:${escapeIcsText(input.url)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

/**
 * Google Calendar "add event" template link (opens pre-filled in the browser).
 */
export function googleCalendarUrl(input: CalendarEventInput): string {
  assertValidRange(input.startsAtUtcIso, input.endsAtUtcIso);
  const details = input.url ? `${input.description}\n${input.url}` : input.description;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${toIcsDateTime(input.startsAtUtcIso)}/${toIcsDateTime(input.endsAtUtcIso)}`,
    details,
    location: input.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** data: URI so the browser downloads the .ics (Apple Calendar "Add to Apple Calendar"). */
export function appleCalendarDataUri(ics: string): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}
