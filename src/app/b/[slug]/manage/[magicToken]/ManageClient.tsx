"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/sl/Button";
import { TimeSlot } from "@/components/sl/TimeSlot";
import { downloadICSFor } from "../../_flow/BookingFlow";
import {
  addDaysYmd,
  dateLabel,
  todayInTz,
  type ApiDay,
  type AvailabilityResponseData,
} from "../../_lib/types";

/**
 * Manage actions — cancel + reschedule against POST
 * /api/public/bookings/manage (the manage_booking RPC). The RPC ROTATES
 * the manage token on every call, so after a successful action we
 * redirect to the NEW token's URL; the old link stops working.
 */
export function ManageActions({
  slug,
  token,
  businessId,
  serviceId,
  staffId,
  startsAt,
  endsAt,
  businessName,
  serviceName,
  staffName,
  address,
  bookingId,
  timezone,
}: {
  slug: string;
  token: string;
  businessId: string;
  serviceId: string;
  staffId: string;
  startsAt: string;
  endsAt: string;
  businessName: string;
  serviceName: string;
  staffName: string | null;
  address: string | null;
  bookingId: string;
  timezone: string;
}) {
  const router = useRouter();
  const base = `/b/${slug}`;
  const [mode, setMode] = useState<"idle" | "confirm-cancel" | "reschedule">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grid, setGrid] = useState<AvailabilityResponseData | null>(null);
  const [pick, setPick] = useState<{ day: ApiDay; slotIndex: number } | null>(null);

  useEffect(() => {
    if (mode !== "reschedule" || grid) return;
    const today = todayInTz(timezone);
    const url = `/api/public/availability?businessId=${businessId}&serviceId=${serviceId}&staffId=${staffId}&from=${today}&to=${addDaysYmd(today, 13)}`;
    let cancelled = false;
    fetch(url)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.message ?? "Could not load times.");
        return j as AvailabilityResponseData;
      })
      .then((j) => {
        if (!cancelled) setGrid(j);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, grid, businessId, serviceId, staffId, timezone]);

  const call = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/public/bookings/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...payload }),
      });
      const j = (await res.json().catch(() => null)) as {
        manageToken?: string;
        message?: string;
      } | null;
      if (!res.ok || !j?.manageToken) {
        setError(j?.message ?? "That didn't work. Please try again.");
        setBusy(false);
        return;
      }
      // Token rotated — move to the new link (old one is dead).
      try {
        sessionStorage.setItem(`slotly-manage:${bookingId}`, j.manageToken);
      } catch {}
      router.push(`${base}/manage/${j.manageToken}`);
    } catch {
      setError("We couldn't reach the booking service. Check your connection and try again.");
      setBusy(false);
    }
  };

  const chosenSlot =
    pick && grid ? grid.days.find((d) => d.date === pick.day.date)?.slots[pick.slotIndex] : undefined;

  return (
    <div>
      <div className="sl-b-actions">
        <Button variant="primary" onClick={() => setMode("reschedule")}>
          Move to another time
        </Button>
        <Button onClick={() => setMode("confirm-cancel")}>Cancel booking</Button>
        <Button
          onClick={() =>
            downloadICSFor({
              businessName,
              serviceName,
              staffName,
              startsAt,
              endsAt,
              address,
              bookingId,
              slug,
            })
          }
        >
          Add to calendar
        </Button>
      </div>

      {error ? (
        <p role="alert" style={{ marginTop: 14, fontSize: 14, color: "var(--oxblood)", fontWeight: 600 }}>
          {error}
        </p>
      ) : null}

      {mode === "confirm-cancel" ? (
        <div className="sl-b-card" style={{ marginTop: 20 }}>
          <h2 style={{ font: "600 20px/1.25 var(--font-display)", marginBottom: 8 }}>
            Cancel this booking?
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.6 }}>
            Nothing was charged online, so there&rsquo;s nothing to refund —
            the shop will simply free the chair.
          </p>
          <div className="sl-b-actions">
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => call({ action: "cancel" })}
            >
              {busy ? "Cancelling…" : "Yes, cancel it"}
            </Button>
            <Button disabled={busy} onClick={() => setMode("idle")}>
              Keep my booking
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "reschedule" ? (
        <div className="sl-b-card" style={{ marginTop: 20 }}>
          <h2 style={{ font: "600 20px/1.25 var(--font-display)", marginBottom: 8 }}>
            Pick a new time
          </h2>
          {!grid ? (
            <p style={{ fontSize: 15, color: "var(--muted)" }}>Loading times…</p>
          ) : (
            <div style={{ display: "grid", gap: 20 }}>
              {grid.days
                .filter((d) => d.slots.length > 0)
                .slice(0, 7)
                .map((d) => (
                  <div key={d.date}>
                    <h3 style={{ font: "600 15px/1.3 var(--font-display)", marginBottom: 10 }}>
                      {dateLabel(d.date)}
                    </h3>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }} role="group" aria-label={`Times on ${dateLabel(d.date)}`}>
                      {d.slots.map((s, i) => (
                        <TimeSlot
                          key={s.startsAt}
                          time={s.label}
                          selected={pick?.day.date === d.date && pick?.slotIndex === i}
                          onSelect={() => setPick({ day: d, slotIndex: i })}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              {grid.days.every((d) => d.slots.length === 0) ? (
                <p style={{ fontSize: 15, color: "var(--muted)" }}>
                  No open times in the next two weeks — call the shop and
                  they&rsquo;ll help you move it.
                </p>
              ) : null}
            </div>
          )}
          <div className="sl-b-actions">
            <Button
              variant="primary"
              disabled={busy || !chosenSlot}
              onClick={() =>
                chosenSlot &&
                call({
                  action: "reschedule",
                  newStartsAt: chosenSlot.startsAt,
                  newEndsAt: chosenSlot.endsAt,
                  newStaffId: chosenSlot.staffId,
                })
              }
            >
              {busy ? "Moving…" : "Move my booking"}
            </Button>
            <Button disabled={busy} onClick={() => setMode("idle")}>
              Keep the original time
            </Button>
          </div>
          <p style={{ marginTop: 12, fontSize: 13, color: "var(--muted)" }}>
            Moving gives you a new booking link — the one you opened just
            now stops working.
          </p>
        </div>
      ) : null}

      <div style={{ marginTop: 20 }}>
        <ButtonLink href={base}>Back to {businessName}</ButtonLink>
      </div>
    </div>
  );
}
