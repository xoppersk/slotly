"use client";

import * as React from "react";

import { apiJson, type AvailabilityResponse } from "@/lib/booking/public-api";
import { formatDayLabel, formatSlotForCustomer } from "@/lib/availability";

/**
 * BusinessStatusLine — a light "open now / next opening" line for the
 * business page header.
 *
 * Fetches availability for the business's first service ("any" staff) over
 * the next 3 days and derives a customer-facing line:
 * - "Bookable today — next opening {time}" when today's slots exist
 * - "Next opening {day label}" when a later day is open
 * - nothing on error or when nothing is bookable in the window
 *
 * Note: this is derived from slot availability, not the raw business hours,
 * so it only reflects bookable time.
 */
export function BusinessStatusLine({
  businessId,
  serviceId,
  businessName,
  businessTimezone,
}: {
  businessId: string;
  serviceId: string;
  businessName: string;
  businessTimezone: string;
}) {
  const [line, setLine] = React.useState<string | null>(null);
  const customerTz = React.useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );

  React.useEffect(() => {
    let cancelled = false;
    const today = new Date();
    const to = new Date(today);
    to.setDate(to.getDate() + 3);
    const ymd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
    const params = new URLSearchParams({
      businessId,
      serviceId,
      staffId: "any",
      from: ymd(today),
      to: ymd(to),
    });
    fetch(`/api/availability?${params.toString()}`)
      .then((res) => apiJson<AvailabilityResponse>(res, "Availability lookup failed"))
      .then((data) => {
        if (cancelled) return;
        const openDays = data.days.filter((d) => d.slots.length > 0);
        if (openDays.length === 0) {
          setLine(null);
          return;
        }
        const first = openDays[0]!;
        const firstSlot = first.slots[0];
        if (!firstSlot) {
          setLine(null);
          return;
        }
        const label = formatSlotForCustomer(
          firstSlot.startsAt,
          businessTimezone,
          customerTz
        );
        const dayLabel = formatDayLabel(first.date, businessTimezone);
        // Is "today" bookable? Compare the business-local date.
        const todayKey = ymd(today);
        const isToday = first.date === todayKey;
        setLine(
          isToday
            ? `Bookable today — next opening ${label.customerLabel}`
            : `Next opening ${dayLabel} at ${label.customerLabel}`
        );
      })
      .catch(() => {
        if (!cancelled) setLine(null);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, serviceId, businessTimezone, customerTz]);

  if (!line) return null;
  return (
    <p aria-live="polite" className="text-sm text-muted-foreground">
      <span className="mr-1.5 inline-block size-2 rounded-full bg-success align-middle" />
      {line} at {businessName}
    </p>
  );
}
