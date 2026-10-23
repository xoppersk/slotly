"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StepHeading } from "@/components/sl/shells/BookingShell";
import { flowQuery, useBookingFlow } from "../../_flow/BookingFlow";
import { FlowShell } from "../../_flow/Shell";
import { FlowSummary } from "../../_flow/Summary";
import {
  addDaysYmd,
  todayInTz,
  type AvailabilityResponseData,
} from "../../_lib/types";

/** Step 2 — staff from the live `staff_public` view, narrowed to whoever
    offers the chosen service (service_staff_public mapping; falls back to
    the availability RPC's staff list, which is service-filtered by the
    function itself). "Next opening" lines come from the real slot grid. */
function Inner() {
  const flow = useBookingFlow();
  const router = useRouter();
  const sp = useSearchParams();
  const serviceId = sp.get("service") ?? flow.serviceId;
  const svc = flow.catalog.services.find((s) => s.id === serviceId);
  const selected = sp.get("barber") ?? flow.barberId;
  const tz = flow.catalog.business.timezone;

  const mapped = flow.catalog.serviceStaff[serviceId];
  const barbers = useMemo(() => {
    if (mapped && mapped.length > 0) {
      return flow.catalog.staff.filter((b) => mapped.includes(b.id));
    }
    return flow.catalog.staff;
  }, [flow.catalog.staff, mapped]);

  // Real next openings: pull the coming week's grid for this service.
  const [grid, setGrid] = useState<AvailabilityResponseData | null>(null);
  useEffect(() => {
    if (!svc) return;
    const today = todayInTz(tz);
    const url = `/api/public/availability?businessId=${flow.catalog.business.id}&serviceId=${serviceId}&staffId=any&from=${today}&to=${addDaysYmd(today, 6)}`;
    let cancelled = false;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j) setGrid(j as AvailabilityResponseData);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [serviceId, svc, tz, flow.catalog.business.id]);

  const nextFor = (staffId: string | "any"): string | null => {
    if (!grid) return null;
    for (const day of grid.days) {
      const slot =
        staffId === "any"
          ? day.slots[0]
          : day.slots.find((s) => s.staffId === staffId);
      if (slot) {
        const when =
          day.date === todayInTz(tz)
            ? "Today"
            : new Date(`${day.date}T12:00:00Z`).toLocaleDateString("en-US", {
                weekday: "short",
                timeZone: "UTC",
              });
        return `${when}, ${slot.label}`;
      }
    }
    return null;
  };

  const pick = (id: string) => {
    flow.setFlow({ barberId: id, serviceId, barberTouched: true, startsAt: null, endsAt: null, slotStaffId: null, holdTime: null, holdExpiresAt: null });
    router.push(
      `${flow.base}/book/time${flowQuery({ serviceId, barberId: id, date: flow.date, startsAt: null })}`,
    );
  };

  return (
    <FlowShell step={2}>
      <div className="sl-b-main">
        <StepHeading step={2} title="Choose a barber" />
        <p className="sl-b-lead">
          {svc?.name}, {svc?.durationMinutes} min. Pick someone, or take the
          first open chair.
        </p>
        <div className="sl-b-grid">
          <div>
            <button
              type="button"
              className="sl-b-opt"
              aria-pressed={selected === "any"}
              onClick={() => pick("any")}
            >
              <span className="sl-b-opt__left">
                <span className="sl-b-opt__avatar">Any</span>
                <span>
                  <span className="sl-b-opt__name">Any barber</span>
                  <span className="sl-b-opt__meta" style={{ display: "block" }}>
                    Shows every open time at the shop
                  </span>
                </span>
              </span>
              <span style={{ textAlign: "right", fontSize: 14 }}>
                <span style={{ color: "var(--muted)" }}>Earliest</span>
                <br />
                <b>{nextFor("any") ?? "See times"}</b>
              </span>
            </button>
            {barbers.map((b) => (
              <button
                key={b.id}
                type="button"
                className="sl-b-opt"
                aria-pressed={selected === b.id}
                onClick={() => pick(b.id)}
              >
                <span className="sl-b-opt__left">
                  <span className="sl-b-opt__avatar">{b.initial}</span>
                  <span>
                    <span className="sl-b-opt__name">{b.name}</span>
                    <span className="sl-b-opt__meta" style={{ display: "block" }}>
                      {[b.title, b.specialties.join(" · "), b.bio]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </span>
                <span style={{ textAlign: "right", fontSize: 14 }}>
                  <span style={{ color: "var(--muted)" }}>Next opening</span>
                  <br />
                  <b>{nextFor(b.id) ?? "See times"}</b>
                </span>
              </button>
            ))}
            {barbers.length === 0 ? (
              <p style={{ fontSize: 15, color: "var(--muted)" }}>
                Nobody is listed for this service yet — choose &ldquo;Any
                barber&rdquo; to see open times.
              </p>
            ) : null}
          </div>
          <div className="sl-b-side">
            <FlowSummary
              ctaLabel="Continue to time"
              ctaHref={`${flow.base}/book/time${flowQuery(flow)}`}
            />
          </div>
        </div>
      </div>
    </FlowShell>
  );
}
export default function Page() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
