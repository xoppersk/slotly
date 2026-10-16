"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BookingShell, StepHeading } from "@/components/sl/shells/BookingShell";
import { formatCents, getServices } from "@/lib/api";
import { BASE, flowQuery, stepHrefs, useBookingFlow } from "../../_flow/BookingFlow";
import { FlowSummary } from "../../_flow/Summary";

function Inner() {
  const flow = useBookingFlow(); const sp = useSearchParams();
  const selected = sp.get("service") ?? flow.serviceId;
  const services = getServices();
  return (
    <BookingShell step={1} stepHrefs={stepHrefs(flow)} manageHref="/b/harbor-and-pine/manage/demo-token">
      <div className="sl-b-main">
        <StepHeading step={1} title="Choose a service" />
        <p className="sl-b-lead">Prices include the hot-towel finish. You pay a $20 deposit now and the rest at the shop.</p>
        <div className="sl-b-grid">
          <div>
            {services.map((s) => (
              <button key={s.id} type="button" className="sl-b-opt" aria-pressed={selected === s.id} onClick={() => flow.setFlow({ serviceId: s.id })}>
                <span><span className="sl-b-opt__name">{s.name}</span><span className="sl-b-opt__meta" style={{ display: "block" }}>{s.durationMinutes} min · {s.description}</span></span>
                <span className="sl-b-opt__price">{formatCents(s.priceCents).replace(".00", "")}</span>
              </button>
            ))}
          </div>
          <div className="sl-b-side"><FlowSummary barberNextStep={!flow.barberTouched} ctaLabel="Continue to barber" ctaHref={`${BASE}/book/barber${flowQuery(flow)}`} /></div>
        </div>
      </div>
    </BookingShell>
  );
}
export default function Page() { return <Suspense><Inner /></Suspense>; }
