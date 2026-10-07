"use client";

import Link from "next/link";

import { formatCents } from "@/lib/format";
import { formatTimeShort } from "@/lib/dashboard/format";
import { BookingStatusChip } from "./booking-status-chip";
import type { Database } from "@/lib/supabase/types";

interface AgendaBookingCardProps {
  bookingId: string;
  startsAt: string;
  timezone: string;
  serviceName?: string | null;
  serviceColor?: string | null;
  customerName?: string | null;
  status: Database["public"]["Tables"]["bookings"]["Row"]["status"];
  priceCents: number;
  hasNotes: boolean;
}

/** One agenda row: time rail, customer, service, status, price, notes dot. */
export function AgendaBookingCard({
  bookingId,
  startsAt,
  timezone,
  serviceName,
  serviceColor,
  customerName,
  status,
  priceCents,
  hasNotes,
}: AgendaBookingCardProps) {
  return (
    <li className="animate-in fade-in slide-in-from-top-2 duration-300">
      <Link
        href={`/dashboard/bookings?booking=${bookingId}`}
        className="group flex items-center gap-3 rounded-[0.75rem] border border-border bg-card p-3 shadow-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          aria-hidden
          className="w-1 self-stretch rounded-full"
          style={{ backgroundColor: serviceColor ?? "var(--border)" }}
        />
        <span className="tnum w-20 shrink-0 text-sm font-semibold">
          {formatTimeShort(startsAt, timezone)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">
              {customerName ?? "Customer"}
            </span>
            {hasNotes && (
              <span
                aria-label="Has notes"
                title="Has notes"
                className="size-1.5 shrink-0 rounded-full bg-accent"
              />
            )}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {serviceName ?? "Appointment"}
          </span>
        </span>
        <span className="tnum hidden text-sm text-muted-foreground sm:block">
          {formatCents(priceCents)}
        </span>
        <BookingStatusChip status={status} />
      </Link>
    </li>
  );
}
