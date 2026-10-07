/**
 * Availability engine — unit tests for generate.ts.
 *
 * Fixed scenarios covering overrides, blackouts, time-off, buffers,
 * lead time, DST transitions, and the closed vs fully_booked distinction.
 */

import { formatInTimeZone } from 'date-fns-tz';
import { describe, expect, it } from 'vitest';
import { generateDayRange, generateSlotsForDay } from './generate';
import type { SlotInput, WeeklyRule } from './types';

const TZ = 'America/New_York';

const WEEKDAYS_OPEN: WeeklyRule[] = [
  { weekday: 0, openTime: '09:00', closeTime: '17:00', isClosed: true },
  { weekday: 1, openTime: '09:00', closeTime: '17:00', isClosed: false },
  { weekday: 2, openTime: '09:00', closeTime: '17:00', isClosed: false },
  { weekday: 3, openTime: '09:00', closeTime: '17:00', isClosed: false },
  { weekday: 4, openTime: '09:00', closeTime: '17:00', isClosed: false },
  { weekday: 5, openTime: '09:00', closeTime: '17:00', isClosed: false },
  { weekday: 6, openTime: '09:00', closeTime: '17:00', isClosed: true },
];

function baseInput(overrides: Partial<SlotInput> = {}): SlotInput {
  return {
    businessTimezone: TZ,
    serviceDurationMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    slotStepMinutes: 15,
    weeklyRules: WEEKDAYS_OPEN,
    overrides: [],
    blackouts: [],
    timeOff: [],
    bookings: [],
    minLeadTimeMinutes: 0,
    maxAdvanceDays: 60,
    nowIso: '2026-10-06T12:00:00.000Z', // Tue 2026-10-06 08:00 EDT
    ...overrides,
  };
}

function wallLabels(startsAts: string[]): string[] {
  return startsAts.map((s) => formatInTimeZone(Date.parse(s), TZ, 'HH:mm'));
}

describe('generateSlotsForDay', () => {
  it('uses weekly rules for an ordinary open day', () => {
    const slots = generateSlotsForDay(baseInput(), '2026-10-07', 'staff-1'); // Wed
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]!.startsAt).toBe('2026-10-07T13:00:00.000Z'); // 09:00 EDT
    expect(slots.at(-1)!.endsAt).toBe('2026-10-07T21:00:00.000Z'); // 17:00 EDT
    for (const s of slots) expect(s.staffId).toBe('staff-1');
  });

  it('a date override that closes the day beats the weekly rule', () => {
    const input = baseInput({
      overrides: [
        {
          date: '2026-10-07',
          openTime: null,
          closeTime: null,
          isClosed: true,
          reason: 'Staff training',
        },
      ],
    });
    const day = generateDayRange(input, '2026-10-07', 1, 'staff-1')[0]!;
    expect(day.status).toBe('closed');
    expect(day.reason).toBe('Staff training');
    expect(day.slots).toEqual([]);
  });

  it('a date override with custom hours beats the weekly rule', () => {
    const input = baseInput({
      overrides: [
        {
          date: '2026-10-07',
          openTime: '12:00',
          closeTime: '16:00',
          isClosed: false,
        },
      ],
    });
    const slots = generateSlotsForDay(input, '2026-10-07', 'staff-1');
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]!.startsAt).toBe('2026-10-07T16:00:00.000Z'); // 12:00 EDT
    expect(slots.at(-1)!.endsAt).toBe('2026-10-07T20:00:00.000Z'); // 16:00 EDT
  });

  it('a blackout closes the day even with an open weekly rule and override', () => {
    const input = baseInput({
      blackouts: [{ date: '2026-10-07', reason: 'Public holiday' }],
      overrides: [
        {
          date: '2026-10-07',
          openTime: '09:00',
          closeTime: '17:00',
          isClosed: false,
        },
      ],
    });
    const day = generateDayRange(input, '2026-10-07', 1, 'staff-1')[0]!;
    expect(day.status).toBe('closed');
    expect(day.reason).toBe('Public holiday');
  });

  it('staff rules win over business weekly rules for the weekday', () => {
    const input = baseInput({
      staffRules: [{ weekday: 3, openTime: '10:00', closeTime: '14:00', isClosed: false }],
    });
    const slots = generateSlotsForDay(input, '2026-10-07', 'staff-1'); // Wed
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]!.startsAt).toBe('2026-10-07T14:00:00.000Z'); // 10:00 EDT
    expect(slots.at(-1)!.endsAt).toBe('2026-10-07T18:00:00.000Z'); // 14:00 EDT
  });

  it('approved time-off blocks slots; pending/declined time-off does not', () => {
    const mk = (status: 'pending' | 'approved' | 'declined') =>
      baseInput({
        timeOff: [{ startsAt: '2026-10-07T14:00:00.000Z', endsAt: '2026-10-07T16:00:00.000Z', status }],
      });
    const labels = (status: 'pending' | 'approved' | 'declined') =>
      wallLabels(generateSlotsForDay(mk(status), '2026-10-07', 'staff-1').map((s) => s.startsAt));

    const approved = labels('approved');
    expect(approved).not.toContain('10:00');
    expect(approved).not.toContain('10:30');
    expect(approved).not.toContain('11:00');
    expect(approved).not.toContain('11:30'); // overlaps 12:00 EDT end
    expect(approved).toContain('09:00');
    expect(approved).toContain('12:00'); // boundary-touching start is fine

    expect(labels('pending')).toContain('10:00');
    expect(labels('declined')).toContain('10:00');
  });

  it('buffers expand booking blocks on both sides', () => {
    const input = baseInput({
      serviceDurationMinutes: 30,
      slotStepMinutes: 15,
      bufferBeforeMinutes: 15,
      bufferAfterMinutes: 15,
      bookings: [{ startsAt: '2026-10-07T14:00:00.000Z', endsAt: '2026-10-07T15:00:00.000Z' }], // 10:00–11:00 EDT
    });
    const labels = wallLabels(generateSlotsForDay(input, '2026-10-07', 'staff-1').map((s) => s.startsAt));
    // booking block with buffers = 09:45–11:15 EDT
    expect(labels).toContain('09:15'); // ends exactly when the block starts — allowed
    expect(labels).not.toContain('09:30');
    expect(labels).not.toContain('09:45');
    expect(labels).not.toContain('10:00');
    expect(labels).not.toContain('11:00');
    expect(labels).toContain('11:15'); // starts exactly when the block ends — allowed
  });

  it('lead time cuts early slots on the current day', () => {
    const input = baseInput({ minLeadTimeMinutes: 120 });
    const slots = generateSlotsForDay(input, '2026-10-06', 'staff-1'); // Tue, now = 08:00 EDT
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]!.startsAt).toBe('2026-10-06T14:00:00.000Z'); // 10:00 EDT = now + 2h
  });

  it('dates beyond maxAdvanceDays produce no slots', () => {
    const input = baseInput({ maxAdvanceDays: 7 });
    expect(generateSlotsForDay(input, '2026-10-14', 'staff-1')).toEqual([]); // 8 days out
    expect(generateSlotsForDay(input, '2026-10-13', 'staff-1').length).toBeGreaterThan(0); // 7 days out
  });
});

describe('DST transitions (America/New_York)', () => {
  const sundayRule: WeeklyRule[] = [
    { weekday: 0, openTime: '01:00', closeTime: '04:00', isClosed: false },
  ];

  it('spring-forward gap (2026-03-08) produces no phantom slots', () => {
    const input = baseInput({
      serviceDurationMinutes: 30,
      slotStepMinutes: 30,
      weeklyRules: sundayRule,
      nowIso: '2026-03-01T12:00:00.000Z',
    });
    const slots = generateSlotsForDay(input, '2026-03-08', 'staff-1');
    // wall candidates 01:00, 01:30, 02:00, 02:30, 03:00, 03:30 —
    // 02:00/02:30 do not exist and must be skipped
    const labels = wallLabels(slots.map((s) => s.startsAt));
    expect(labels).toEqual(['01:00', '01:30', '03:00', '03:30']);
    expect(slots[0]!.startsAt).toBe('2026-03-08T06:00:00.000Z'); // 01:00 EST
    expect(slots[2]!.startsAt).toBe('2026-03-08T07:00:00.000Z'); // 03:00 EDT (offset shifted)
  });

  it('fall-back repeats (2026-11-01) are disambiguated by offset, never crash', () => {
    const input = baseInput({
      serviceDurationMinutes: 60,
      slotStepMinutes: 60,
      weeklyRules: [{ weekday: 0, openTime: '00:00', closeTime: '04:00', isClosed: false }],
      nowIso: '2026-10-01T12:00:00.000Z',
    });
    const slots = generateSlotsForDay(input, '2026-11-01', 'staff-1');
    expect(slots).toHaveLength(4);
    // 01:00 is ambiguous; the engine takes the earlier occurrence (EDT)
    expect(slots[1]!.startsAt).toBe('2026-11-01T05:00:00.000Z');
    expect(wallLabels(slots.map((s) => s.startsAt))).toEqual(['00:00', '01:00', '02:00', '03:00']);
  });
});

describe('generateDayRange empty-state distinction', () => {
  it("distinguishes 'closed' from 'fully_booked'", () => {
    const closedInput = baseInput({
      staffRules: [{ weekday: 3, openTime: '09:00', closeTime: '17:00', isClosed: true }],
    });
    const closed = generateDayRange(closedInput, '2026-10-07', 1, 'staff-1')[0]!;
    expect(closed.status).toBe('closed');
    expect(closed.reason).toBe('Closed');

    const bookedInput = baseInput({
      timeOff: [
        { startsAt: '2026-10-07T00:00:00.000Z', endsAt: '2026-10-07T23:59:59.000Z', status: 'approved' },
      ],
    });
    const booked = generateDayRange(bookedInput, '2026-10-07', 1, 'staff-1')[0]!;
    expect(booked.status).toBe('fully_booked');
    expect(booked.reason).toMatch(/fully booked/i);
    expect(booked.reason).not.toMatch(/closed/i);
  });

  it('open days report slots and no reason', () => {
    const day = generateDayRange(baseInput(), '2026-10-07', 1, 'staff-1')[0]!;
    expect(day.status).toBe('open');
    expect(day.slots.length).toBeGreaterThan(0);
    expect(day.reason).toBeUndefined();
  });

  it('is deterministic for identical input', () => {
    const input = baseInput({
      bookings: [{ startsAt: '2026-10-07T14:00:00.000Z', endsAt: '2026-10-07T15:00:00.000Z' }],
      timeOff: [{ startsAt: '2026-10-08T12:00:00.000Z', endsAt: '2026-10-08T14:00:00.000Z', status: 'approved' }],
    });
    const a = generateDayRange(input, '2026-10-05', 7, 'staff-1');
    const b = generateDayRange(input, '2026-10-05', 7, 'staff-1');
    expect(a).toEqual(b);
  });
});
