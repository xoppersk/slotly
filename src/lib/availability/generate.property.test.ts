/**
 * Availability engine — property tests (fast-check).
 *
 * Generates randomized scheduling scenarios (timezones incl. DST, weekly
 * rules, overrides, blackouts, time-off, bookings, buffers, lead times) and
 * asserts the engine's invariants on every scenario.
 *
 * One judgement call on the "no overlapping slots" invariant: on a grid whose
 * step is smaller than the service duration + buffers (the normal case —
 * e.g. 15-min steps for a 60-min service), consecutive candidate starts
 * necessarily overlap in service time. That is expected slot-picker behavior
 * (double-booking is prevented downstream by the Postgres EXCLUDE
 * constraint), so the strict non-overlap assertion is applied only in the
 * regime where it is mathematically possible
 * (step >= duration + bufferBefore + bufferAfter). The invariant that always
 * holds — and is asserted on every scenario — is that no slot's occupied
 * block clashes with any booking's buffer-expanded block or any approved
 * time-off range.
 */

import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { addDaysYmd, generateSlotsForDay, resolveWindow } from './generate';
import type { SlotInput, WeeklyRule } from './types';

const MS_PER_MIN = 60_000;
const pad = (n: number) => String(n).padStart(2, '0');

const tzArb = fc.constantFrom(
  'America/New_York', // DST both directions
  'America/Chicago',
  'Europe/London',
  'Africa/Freetown', // no DST, whole-hour offset
  'Australia/Sydney', // southern-hemisphere DST
  'Pacific/Auckland',
);

// Dates spanning both US DST transitions in 2026: Mar 8 (forward), Nov 1 (back)
const baseDateArb = fc.constantFrom(
  '2026-01-15',
  '2026-03-01',
  '2026-03-06', // spring-forward lands inside the advance window
  '2026-06-15',
  '2026-10-01',
  '2026-10-30', // fall-back lands inside the advance window
  '2026-12-15',
);

const hoursArb = fc
  .tuple(fc.integer({ min: 0, max: 12 }), fc.integer({ min: 2, max: 10 }))
  .map(([h, len]) => ({ openTime: `${pad(h)}:00`, closeTime: `${pad(h + len)}:00` }));

const weeklyRulesArb = fc.array(
  fc.integer({ min: 0, max: 6 }).chain((weekday) =>
    fc.record({
      isClosed: fc.boolean(),
      hours: hoursArb,
    }).map(({ isClosed, hours }) => ({
      weekday,
      openTime: hours.openTime,
      closeTime: hours.closeTime,
      isClosed,
    }) satisfies WeeklyRule),
  ),
  { minLength: 7, maxLength: 7 },
);

/** Wall time "HH:mm" on dateYmd in tz → ISO UTC instant string. */
function wallToIso(dateYmd: string, hhmm: string, tz: string): string {
  return fromZonedTime(new Date(`${dateYmd}T${hhmm}:00.000Z`), tz).toISOString();
}

interface Scenario {
  input: SlotInput;
  dateYmd: string;
}

const scenarioArb: fc.Arbitrary<Scenario> = fc
  .tuple(
    tzArb,
    baseDateArb,
    fc.integer({ min: 0, max: 30 }), // day offset inside the advance window
    fc.integer({ min: 15, max: 120 }), // service duration
    fc.integer({ min: 0, max: 30 }), // buffer before
    fc.integer({ min: 0, max: 30 }), // buffer after
    fc.constantFrom(5, 10, 15, 20, 30, 60), // grid step (matches DB CHECK)
    weeklyRulesArb,
    fc.integer({ min: 0, max: 240 }), // lead time
  )
  .chain(([tz, base, offset, duration, bb, ba, step, weeklyRules, lead]) => {
    const nowIso = `${base}T12:00:00.000Z`;
    const dateYmd = addDaysYmd(base, offset);
    const maxAdvanceDays = 60;

    // random bookings landing on the chosen day (wall-clock starts, :00/:30)
    const bookingArb = fc
      .tuple(
        fc.integer({ min: 0, max: 23 }),
        fc.constantFrom(0, 30),
        fc.integer({ min: 15, max: 120 }),
      )
      .map(([h, m, dur]) => {
        const startsAt = wallToIso(dateYmd, `${pad(h!)}:${pad(m!)}`, tz);
        return {
          startsAt,
          endsAt: new Date(Date.parse(startsAt) + dur * MS_PER_MIN).toISOString(),
        };
      });

    const timeOffArb = fc
      .tuple(
        fc.integer({ min: 0, max: 23 }),
        fc.constantFrom(0, 30),
        fc.integer({ min: 30, max: 480 }),
        fc.constantFrom('pending', 'approved', 'declined') as fc.Arbitrary<
          'pending' | 'approved' | 'declined'
        >,
      )
      .map(([h, m, dur, status]) => {
        const startsAt = wallToIso(dateYmd, `${pad(h!)}:${pad(m!)}`, tz);
        return {
          startsAt,
          endsAt: new Date(Date.parse(startsAt) + dur * MS_PER_MIN).toISOString(),
          status,
        };
      });

    return fc
      .tuple(
        fc.array(bookingArb, { maxLength: 4 }),
        fc.array(timeOffArb, { maxLength: 2 }),
        fc.boolean(), // blackout the chosen day?
        fc.boolean(), // staff rule override for the weekday?
      )
      .map(([bookings, timeOff, blackoutDay, staffOverride]) => {
        const input: SlotInput = {
          businessTimezone: tz,
          serviceDurationMinutes: duration,
          bufferBeforeMinutes: bb,
          bufferAfterMinutes: ba,
          slotStepMinutes: step,
          weeklyRules,
          overrides: [],
          blackouts: blackoutDay ? [{ date: dateYmd, reason: 'holiday' }] : [],
          timeOff,
          bookings,
          minLeadTimeMinutes: lead,
          maxAdvanceDays,
          nowIso,
        };
        if (staffOverride) {
          input.staffRules = [
            {
              weekday: Number(formatInTimeZone(Date.parse(`${dateYmd}T12:00:00Z`), tz, 'i')) % 7,
              openTime: '08:00',
              closeTime: '20:00',
              isClosed: false,
            },
          ];
        }
        return { input, dateYmd };
      });
  });

describe('availability invariants', () => {
  it('holds across >=200 randomized scenarios', () => {
    fc.assert(
      fc.property(scenarioArb, ({ input, dateYmd }) => {
        const tz = input.businessTimezone;
        const slots = generateSlotsForDay(input, dateYmd, 'staff-1');
        const nowMs = Date.parse(input.nowIso);
        const leadCutoffMs = nowMs + input.minLeadTimeMinutes * MS_PER_MIN;
        const bbMs = input.bufferBeforeMinutes * MS_PER_MIN;
        const baMs = input.bufferAfterMinutes * MS_PER_MIN;

        // 1. strictly ascending, unique start times
        const starts = slots.map((s) => Date.parse(s.startsAt));
        for (let i = 1; i < starts.length; i++) {
          expect(starts[i]!).toBeGreaterThan(starts[i - 1]!);
        }

        // 2. determinism: same input → same output
        expect(generateSlotsForDay(input, dateYmd, 'staff-1')).toEqual(slots);

        const window = resolveWindow(input, dateYmd);
        if (window.status === 'closed') {
          expect(slots).toEqual([]);
          return;
        }
        const openMs = window.openMs!;
        const closeMs = window.closeMs!;

        // 3. every slot lies within the resolved open window
        for (const s of slots) {
          const st = Date.parse(s.startsAt);
          const en = Date.parse(s.endsAt);
          expect(st).toBeGreaterThanOrEqual(openMs);
          expect(en).toBeLessThanOrEqual(closeMs);
          // 4. no slot starts before now + lead time
          expect(st).toBeGreaterThanOrEqual(leadCutoffMs);
          // 5. slots are stamped with the requested staff
          expect(s.staffId).toBe('staff-1');
          // 6. slot start reads back as the requested business-local date
          expect(formatInTimeZone(st, tz, 'yyyy-MM-dd')).toBe(dateYmd);
        }

        // 7. no slot's service interval overlaps an approved time-off range
        //    or a buffer-expanded blocking booking
        for (const s of slots) {
          const st = Date.parse(s.startsAt);
          const en = Date.parse(s.endsAt);
          for (const t of input.timeOff) {
            if (t.status !== 'approved') continue;
            const ts = Date.parse(t.startsAt);
            const te = Date.parse(t.endsAt);
            expect(st < te && ts < en).toBe(false);
          }
          for (const b of input.bookings) {
            const bs = Date.parse(b.startsAt) - bbMs;
            const be = Date.parse(b.endsAt) + baMs;
            expect(st < be && bs < en).toBe(false);
          }
        }

        // 8. grid step alignment: wall-minute offsets from window open are
        //    multiples of the step
        const openWallMins = (() => {
          const t = formatInTimeZone(openMs, tz, 'HH:mm').split(':');
          return Number(t[0]) * 60 + Number(t[1]);
        })();
        for (const s of slots) {
          const t = formatInTimeZone(Date.parse(s.startsAt), tz, 'HH:mm').split(':');
          const wallMins = Number(t[0]) * 60 + Number(t[1]);
          expect((wallMins - openWallMins) % input.slotStepMinutes).toBe(0);
        }

        // 9. when the grid is coarse enough that occupied blocks cannot
        //    overlap, no two occupied blocks overlap
        if (
          input.slotStepMinutes >=
          input.serviceDurationMinutes + input.bufferBeforeMinutes + input.bufferAfterMinutes
        ) {
          const occupied = slots.map((s) => {
            const st = Date.parse(s.startsAt);
            return { s: st - bbMs, e: Date.parse(s.endsAt) + baMs };
          });
          for (let i = 0; i < occupied.length; i++) {
            for (let j = i + 1; j < occupied.length; j++) {
              const a = occupied[i]!;
              const b = occupied[j]!;
              expect(a.s < b.e && b.s < a.e).toBe(false);
            }
          }
        }
      }),
      { numRuns: 250 },
    );
  });
});
