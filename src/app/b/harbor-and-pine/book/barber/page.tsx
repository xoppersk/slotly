"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookingShell, StepHeading } from "@/components/sl/shells/BookingShell";
import { getBarbers, getService } from "@/lib/api";
import { BASE, flowQuery, stepHrefs, useBookingFlow } from "../../_flow/BookingFlow";
import { FlowSummary } from "../../_flow/Summary";

function Inner() {
  const flow = useBookingFlow(); const router = useRouter(); const sp = useSearchParams();
  const serviceId = sp.get("service") ?? flow.serviceId;
  const svc = getService(serviceId);
  const selected = sp.get("barber") ?? flow.barberId;
  const barbers = getBarbers();
  const pick = (id: string) => { flow.setFlow({ barberId: id, serviceId, barberTouched: true }); router.push(`${BASE}/book/time${flowQuery({ serviceId, barberId: id, date: flow.date, time: flow.time })}`); };
  return (
    <BookingShell step={2} stepHrefs={stepHrefs(flow)} manageHref="/b/harbor-and-pine/manage/demo-token">
      <div className="sl-b-main">
        <StepHeading step={2} title="Choose a barber" />
        <p className="sl-b-lead">{svc?.name}, {svc?.durationMinutes} min. Pick someone, or take the first open chair.</p>
        <div className="sl-b-grid">
          <div>
            <button type="button" className="sl-b-opt" aria-pressed={selected === "any"} onClick={() => pick("any")}>
              <span className="sl-b-opt__left"><span className="sl-b-opt__avatar">Any</span><span><span className="sl-b-opt__name">Any barber</span><span className="sl-b-opt__meta" style={{ display: "block" }}>Shows every open time at the shop</span></span></span>
              <span style={{ textAlign: "right", fontSize: 14 }}><span style={{ color: "var(--muted)" }}>Earliest</span><br /><b>Today, 1:30 PM</b></span>
            </button>
            {barbers.map((b) => b.id === "andre" ? (
              <div key={b.id} className="sl-b-opt sl-b-opt--away" aria-disabled="true">
                <span className="sl-b-opt__left"><span className="sl-b-opt__avatar">{b.initial}</span><span><span className="sl-b-opt__name">{b.name}</span><span className="sl-b-opt__meta" style={{ display: "block" }}>Away until Tuesday, October 20</span></span></span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Not bookable</span>
              </div>
            ) : (
              <button key={b.id} type="button" className="sl-b-opt" aria-pressed={selected === b.id} onClick={() => pick(b.id)}>
                <span className="sl-b-opt__left"><span className="sl-b-opt__avatar">{b.initial}</span><span><span className="sl-b-opt__name">{b.name}</span><span className="sl-b-opt__meta" style={{ display: "block" }}>{b.blurb}</span></span></span>
                <span style={{ textAlign: "right", fontSize: 14 }}><span style={{ color: "var(--muted)" }}>Next opening</span><br /><b>{b.nextOpeningToday}</b></span>
              </button>
            ))}
          </div>
          <div className="sl-b-side"><FlowSummary ctaLabel="Continue to time" ctaHref={`${BASE}/book/time${flowQuery(flow)}`} /></div>
        </div>
      </div>
    </BookingShell>
  );
}
export default function Page() { return <Suspense><Inner /></Suspense>; }
