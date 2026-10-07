"use client";

import * as React from "react";
import { formatInTimeZone } from "date-fns-tz";

import { SlotPill } from "@/components/booking/SlotPill";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimeLabel } from "@/lib/management";

/**
 * Contract for GET /api/availability (implemented by the API wave):
 *   ?businessId=&serviceId=&staffId=&from=YYYY-MM-DD&to=YYYY-MM-DD
 * → 200 { business: { id, name, slug, timezone },
 *         days: [{ date, status: "open"|"closed"|"fully_booked",
 *                  slots: [{ startsAt, endsAt, staffId }], reason? }] }
 */
interface PreviewSlot {
  startsAt: string;
  endsAt: string;
  staffId: string;
}

interface PreviewDay {
  date: string;
  status: "open" | "closed" | "fully_booked";
  slots: PreviewSlot[];
  reason?: string;
}

interface PreviewResponse {
  business: { id: string; name: string; slug: string; timezone: string };
  days: PreviewDay[];
}

interface SlotPreviewProps {
  businessId: string;
  businessTimezone: string;
  serviceId: string | null;
  staffId: string | null;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Live slot preview — renders SlotPills exactly as customers see them, by
 * calling the public availability API for the chosen date. Read-only.
 */
export function SlotPreview({
  businessId,
  businessTimezone,
  serviceId,
  staffId,
}: SlotPreviewProps) {
  const [date, setDate] = React.useState<Date>(() => new Date());
  const [result, setResult] = React.useState<{
    key: string;
    day: PreviewDay | null;
    error: string | null;
  } | null>(null);

  const ymd = toYmd(date);
  const requestKey = serviceId
    ? `${businessId}|${serviceId}|${staffId ?? ""}|${ymd}`
    : null;

  React.useEffect(() => {
    if (!requestKey || !serviceId) return;
    const params = new URLSearchParams({
      businessId,
      serviceId,
      // The API requires staffId: a UUID or "any" (all staff merged).
      staffId: staffId ?? "any",
      from: ymd,
      to: ymd,
    });

    let cancelled = false;
    fetch(`/api/availability?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as PreviewResponse;
        if (!cancelled)
          setResult({ key: requestKey, day: json.days[0] ?? null, error: null });
      })
      .catch(() => {
        if (!cancelled)
          setResult({
            key: requestKey,
            day: null,
            error:
              "Slot preview is unavailable right now — your saved hours are unaffected.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, businessId, serviceId, staffId, ymd]);

  // Loading / data / error are derived from whether the latest request has
  // resolved — no synchronous setState inside the effect.
  const loading = !!requestKey && result?.key !== requestKey;
  const day = result?.key === requestKey ? result.day : null;
  const error = result?.key === requestKey ? result.error : null;

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold">Live slot preview</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Exactly what customers see for this date.
      </p>

      {!serviceId ? (
        <p className="text-sm text-muted-foreground">
          Create a service first to preview its slots.
        </p>
      ) : (
        <>
          <Calendar value={date} onSelect={(d) => d && setDate(d)} />
          <div className="mt-3 min-h-24" aria-live="polite">
            {loading ? (
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-20 rounded-full" />
                ))}
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : !day ? (
              <p className="text-sm text-muted-foreground">Pick a date.</p>
            ) : day.status === "closed" ? (
              <p className="text-sm text-muted-foreground">
                Closed{day.reason ? ` — ${day.reason}` : "."}
              </p>
            ) : day.status === "fully_booked" ? (
              <p className="text-sm text-muted-foreground">
                Fully booked{day.reason ? ` — ${day.reason}` : "."} Customers see
                the next opening instead.
              </p>
            ) : day.slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No times that day.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {day.slots.map((slot) => (
                  <SlotPill key={`${slot.startsAt}-${slot.staffId}`} as="span" state="available">
                    <span className="tnum">
                      {formatTimeLabel(
                        formatInTimeZone(slot.startsAt, businessTimezone, "HH:mm"),
                      )}
                    </span>
                  </SlotPill>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
