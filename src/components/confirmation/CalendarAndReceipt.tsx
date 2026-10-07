"use client";

import * as React from "react";
import { Download, CalendarPlus, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/format";
import {
  buildIcs,
  googleCalendarUrl,
  appleCalendarDataUri,
  type CalendarEventInput,
} from "@/lib/calendar";

/**
 * AddToCalendarMenu — Google / Apple / .ics download for the confirmation
 * screen, built on the pure functions in src/lib/calendar.ts.
 */
export function AddToCalendarMenu({ event }: { event: CalendarEventInput }) {
  const googleUrl = React.useMemo(() => googleCalendarUrl(event), [event]);
  const ics = React.useMemo(() => buildIcs(event), [event]);
  const appleUri = React.useMemo(() => appleCalendarDataUri(ics), [ics]);

  const downloadIcs = () => {
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "slotly-booking.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button variant="outline" asChild className="flex-1">
        <a href={googleUrl} target="_blank" rel="noopener noreferrer">
          <CalendarPlus className="mr-1.5 size-4" aria-hidden />
          Add to Google Calendar
          <ExternalLink className="ml-1 size-3.5" aria-hidden />
        </a>
      </Button>
      <Button variant="outline" asChild className="flex-1">
        <a href={appleUri}>
          <CalendarPlus className="mr-1.5 size-4" aria-hidden />
          Add to Apple Calendar
        </a>
      </Button>
      <Button variant="outline" onClick={downloadIcs} className="flex-1">
        <Download className="mr-1.5 size-4" aria-hidden />
        Download .ics
      </Button>
    </div>
  );
}

/**
 * ReceiptBlock — amount charged, payment reference, and what's still due at
 * the appointment (deposits). Renders from the receipt's payments +
 * receiptLines.
 */
export function ReceiptBlock({
  payments,
  receiptLines,
}: {
  payments: { amountCents: number; status: string; paymentReference?: string | null }[];
  receiptLines: { label: string; amountCents: number }[];
}) {
  const succeeded = payments.filter((p) => p.status === "succeeded");
  const chargedCents = succeeded.reduce((sum, p) => sum + p.amountCents, 0);
  const references = succeeded
    .map((p) => p.paymentReference)
    .filter((r): r is string => !!r);

  return (
    <section
      aria-label="Payment receipt"
      className="rounded-[0.75rem] border border-border bg-card p-4"
    >
      <h2 className="text-sm font-semibold">Payment receipt</h2>
      <dl className="tnum mt-3 flex flex-col gap-1.5 text-sm">
        {receiptLines.map((line) => (
          <div key={line.label} className="flex items-center justify-between">
            <dt className="text-muted-foreground">{line.label}</dt>
            <dd className="font-medium">{formatCents(line.amountCents)}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-border pt-2">
          <dt className="font-medium">Charged</dt>
          <dd className="font-semibold">{formatCents(chargedCents)}</dd>
        </div>
        {references.map((ref) => (
          <div key={ref} className="flex items-center justify-between">
            <dt className="text-muted-foreground">Payment reference</dt>
            <dd className="font-mono text-xs">{ref}</dd>
          </div>
        ))}
        {succeeded.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing charged online — pay at your appointment.
          </p>
        )}
      </dl>
    </section>
  );
}
