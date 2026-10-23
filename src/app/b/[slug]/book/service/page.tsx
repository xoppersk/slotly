"use client";
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { StepHeading } from "@/components/sl/shells/BookingShell";
import { formatCents } from "@/lib/format";
import { flowQuery, useBookingFlow } from "../../_flow/BookingFlow";
import { FlowShell } from "../../_flow/Shell";
import { FlowSummary } from "../../_flow/Summary";

/** Step 1 — services from the live `services_public` view (via the layout
    catalog). Deposit copy is honest: deposits are due at the shop, nothing
    is charged online. */
function Inner() {
  const flow = useBookingFlow();
  const sp = useSearchParams();
  const wanted = sp.get("service");
  useEffect(() => {
    if (wanted && wanted !== flow.serviceId && flow.catalog.services.some((s) => s.id === wanted)) {
      flow.setFlow({ serviceId: wanted });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, flow.hydrated]);
  const selected = flow.serviceId;
  const services = flow.catalog.services;
  const anyDeposit = services.some((s) => s.depositCents > 0);
  return (
    <FlowShell step={1}>
      <div className="sl-b-main">
        <StepHeading step={1} title="Choose a service" />
        <p className="sl-b-lead">
          {anyDeposit
            ? "Where a service asks for a deposit, it's due at the shop — nothing is charged online."
            : "You pay at the shop — nothing is charged online."}
        </p>
        <div className="sl-b-grid">
          <div>
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                className="sl-b-opt"
                aria-pressed={selected === s.id}
                onClick={() => flow.setFlow({ serviceId: s.id, startsAt: null, endsAt: null, slotStaffId: null, holdTime: null, holdExpiresAt: null })}
              >
                <span>
                  <span className="sl-b-opt__name">{s.name}</span>
                  <span className="sl-b-opt__meta" style={{ display: "block" }}>
                    {s.durationMinutes} min · {s.description}
                  </span>
                </span>
                <span className="sl-b-opt__price">
                  {formatCents(s.priceCents).replace(".00", "")}
                </span>
              </button>
            ))}
            {services.length === 0 ? (
              <p style={{ fontSize: 15, color: "var(--muted)" }}>
                No services are open for online booking yet.
              </p>
            ) : null}
          </div>
          <div className="sl-b-side">
            <FlowSummary
              barberNextStep={!flow.barberTouched}
              ctaLabel="Continue to barber"
              ctaHref={`${flow.base}/book/barber${flowQuery(flow)}`}
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
