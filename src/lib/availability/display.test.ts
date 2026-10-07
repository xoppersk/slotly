/**
 * Availability engine — unit tests for display.ts.
 */

import { describe, expect, it } from 'vitest';
import {
  formatDayLabel,
  formatSlotForCustomer,
  nextAvailableSlot,
} from './display';
import type { DayAvailability } from './types';

describe('formatSlotForCustomer', () => {
  it('shows both timezones when they differ', () => {
    const out = formatSlotForCustomer(
      '2026-10-06T14:00:00.000Z',
      'America/New_York',
      'Europe/London',
    );
    expect(out.customerLabel).toBe('3:00 PM'); // BST = UTC+1
    expect(out.businessLabel).toBe('10:00 AM'); // EDT = UTC-4
    expect(out.showDual).toBe(true);
  });

  it('shows a single label when timezones match', () => {
    const out = formatSlotForCustomer(
      '2026-10-06T14:00:00.000Z',
      'America/New_York',
      'America/New_York',
    );
    expect(out.customerLabel).toBe('10:00 AM');
    expect(out.businessLabel).toBe('10:00 AM');
    expect(out.showDual).toBe(false);
  });

  it('throws on invalid input', () => {
    expect(() => formatSlotForCustomer('not-a-date', 'UTC', 'UTC')).toThrow(TypeError);
  });
});

describe('formatDayLabel', () => {
  it('formats a business-local date', () => {
    expect(formatDayLabel('2026-10-08', 'America/New_York')).toBe('Thursday, Oct 8');
  });
});

describe('nextAvailableSlot', () => {
  const day = (status: DayAvailability['status'], startsAts: string[]): DayAvailability => ({
    date: '2026-10-07',
    status,
    slots: startsAts.map((startsAt) => ({
      startsAt,
      endsAt: startsAt,
      staffId: 'staff-1',
    })),
  });

  it('returns the earliest slot across the range', () => {
    const days = [
      day('closed', []),
      day('fully_booked', []),
      day('open', ['2026-10-07T14:00:00.000Z', '2026-10-07T14:15:00.000Z']),
    ];
    expect(nextAvailableSlot(days)?.startsAt).toBe('2026-10-07T14:00:00.000Z');
  });

  it('returns null when nothing is available', () => {
    expect(nextAvailableSlot([day('closed', []), day('fully_booked', [])])).toBeNull();
    expect(nextAvailableSlot([])).toBeNull();
  });
});
