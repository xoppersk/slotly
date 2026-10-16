"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookingShell, StepHeading } from "@/components/sl/shells/BookingShell";
import { Button } from "@/components/sl/Button";
import { BASE, flowQuery, stepHrefs, useBookingFlow, useHoldExpiryRedirect } from "../../_flow/BookingFlow";
import { FlowSummary } from "../../_flow/Summary";

function Inner() {
  const flow = useBookingFlow(); const router = useRouter();
  const [card, setCard] = useState("4242 4242 4242 4242");
  // SL-03: an expired hold routes to F-08 from this step too (§10).
  useHoldExpiryRedirect(true);
  // SL-05: fresh loads carry the drawn narrative hold (Thu Oct 8, 9:00 AM).
  useEffect(() => { if (flow.hydrated) flow.ensureNarrativeHold(); }, [flow.hydrated]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <BookingShell step={5} stepHrefs={stepHrefs(flow)} manageHref="/b/harbor-and-pine/manage/demo-token">
      <div className="sl-b-main">
        <StepHeading step={5} title="Pay the $20 deposit" />
        <p className="sl-b-lead">It holds Micah&rsquo;s chair and comes off your bill. You pay the other $28 at the shop.</p>
        <div className="sl-b-grid">
          <form id="deposit-form" onSubmit={(e) => { e.preventDefault(); flow.setFlow({ cardLast4: card.replace(/\s/g, "").slice(-4) || "4242" }); router.push(`${BASE}/book/review${flowQuery(flow)}`); }}>
            <div className="sl-b-field"><label htmlFor="nc">Name on card</label><input id="nc" className="sl-b-input" defaultValue="Avery Lewis" /></div>
            <div className="sl-b-field"><label htmlFor="cn">Card number</label><input id="cn" className="sl-b-input" inputMode="numeric" value={card} onChange={(e) => setCard(e.target.value)} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div className="sl-b-field"><label htmlFor="ex">Expiry</label><input id="ex" className="sl-b-input" placeholder="MM / YY" defaultValue="12 / 28" /></div>
              <div className="sl-b-field"><label htmlFor="cv">Security code</label><input id="cv" className="sl-b-input" inputMode="numeric" defaultValue="424" /></div>
              <div className="sl-b-field"><label htmlFor="zp">ZIP code</label><input id="zp" className="sl-b-input" inputMode="numeric" defaultValue="19123" /></div>
            </div>
            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>Your card goes straight to our payment processor. Harbor &amp; Pine never sees the full number. Nothing is charged until you confirm on the next screen.</p>
          </form>
          <div className="sl-b-side"><FlowSummary showFor ctaNode={<Button variant="linen" type="submit" form="deposit-form">Continue to review</Button>} /></div>
        </div>
      </div>
    </BookingShell>
  );
}
export default function Page() { return <Suspense><Inner /></Suspense>; }
