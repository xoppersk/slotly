import { describe, expect, it } from "vitest";

import {
  DEMO_BOOKING_REF,
  DEMO_BUSINESS_ID,
  DEMO_SLUG,
  demoAvailability,
  demoBooking,
  demoBusiness,
  demoCustomers,
  demoPublicData,
  demoServices,
  demoStaff,
  demoTodayAppointments,
  demoUtilization,
} from "./demo-data";

/**
 * Truth-ledger consistency: the hardcoded demo dataset must stay
 * reconciled with the Flagship UI Designs (Slotly) artifact — one record,
 * one set of facts, everywhere it appears.
 */
describe("demo truth ledger", () => {
  it("identifies the Harbor & Pine demo business", () => {
    expect(DEMO_SLUG).toBe("harbor-and-pine");
    expect(DEMO_BUSINESS_ID).toBe("a1b2c3d4-0000-4000-8000-000000000001");
    expect(demoBusiness.name).toBe("Harbor & Pine Barbershop");
    expect(demoBusiness.timezone).toBe("America/New_York");
  });

  it("keeps the canonical booking facts stable", () => {
    expect(demoBooking.ref).toBe(DEMO_BOOKING_REF);
    expect(demoBooking.ref).toBe("SLY-2026-1008-091");
    expect(demoBooking.customer).toBe("Avery Lewis");
    expect(demoBooking.service).toBe("Signature haircut");
    expect(demoBooking.staff).toBe("Micah");
    expect(demoBooking.dateLabel).toBe("Thursday, October 8, 2026");
    expect(demoBooking.timeLabel).toBe("9:00 AM");
    expect(demoBooking.priceCents).toBe(4800);
    expect(demoBooking.status).toBe("Confirmed");
  });

  it("lists the ledger services, staff, and customers", () => {
    const haircut = demoServices.find((s) => s.name === "Signature haircut");
    expect(haircut?.duration_minutes).toBe(45);
    expect(haircut?.price_cents).toBe(4800);
    expect(demoServices.map((s) => s.name)).toContain("Beard trim");
    expect(demoServices.map((s) => s.name)).toContain("Cut + beard");
    expect(demoStaff.map((m) => m.name)).toEqual(["Micah", "Nia", "Andre"]);
    expect(demoCustomers[0]?.name).toBe("Avery Lewis");
  });

  it("shapes public-view rows for the demo business", () => {
    const { business, services, staff } = demoPublicData();
    expect(business.slug).toBe(DEMO_SLUG);
    expect(business.id).toBe(DEMO_BUSINESS_ID);
    expect(services).toHaveLength(demoServices.length);
    expect(staff).toHaveLength(3);
    expect(services[0]?.payment_policy).toBe("none");
  });

  it("reproduces the signature day slot layout exactly", () => {
    const micah = demoStaff[0]!.id;
    const [day] = demoAvailability("2026-10-08", "2026-10-08", micah);
    expect(day?.closed).toBe(false);
    const labels = (day?.slots ?? []).map((s) =>
      new Date(s.startsAt).toISOString().slice(11, 16),
    );
    // 9:00 AM EDT = 13:00 UTC; the two taken pills stay out of the grid.
    expect(labels).toContain("13:00");
    expect(labels).toContain("13:45");
    expect(labels).not.toContain("14:30");
    expect(labels).not.toContain("20:30");
    expect(labels).toContain("21:15");
    // Slots carry the staff id and 45-minute duration.
    for (const s of day?.slots ?? []) {
      expect(s.staffId).toBe(micah);
      expect(Date.parse(s.endsAt) - Date.parse(s.startsAt)).toBe(45 * 60_000);
    }
  });

  it("closes the demo business on Sundays and Mondays", () => {
    const micah = demoStaff[0]!.id;
    const days = demoAvailability("2026-10-04", "2026-10-05", micah);
    expect(days.map((d) => d.date)).toEqual(["2026-10-04", "2026-10-05"]);
    expect(days.every((d) => d.closed && d.slots.length === 0)).toBe(true);
  });

  it("keeps the utilization chart at the designed 63%", () => {
    const booked = demoUtilization.reduce((a, d) => a + d.booked, 0);
    const available = demoUtilization.reduce((a, d) => a + d.available, 0);
    expect(Math.round((booked / available) * 100)).toBe(63);
    expect(demoUtilization.map((d) => d.label)).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
  });

  it("opens the day with the ledger booking", () => {
    const first = demoTodayAppointments[0];
    expect(first?.customer).toBe("Avery Lewis");
    expect(first?.time).toBe("9:00 AM");
    expect(first?.status).toBe("confirmed");
  });
});
