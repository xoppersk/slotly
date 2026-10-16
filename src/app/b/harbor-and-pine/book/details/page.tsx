"use client";
import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BookingShell, StepHeading } from "@/components/sl/shells/BookingShell";
import { Button } from "@/components/sl/Button";
import { BASE, flowQuery, stepHrefs, useBookingFlow, useHoldExpiryRedirect } from "../../_flow/BookingFlow";
import { FlowSummary } from "../../_flow/Summary";

function Inner() {
  const flow = useBookingFlow(); const router = useRouter(); const d = flow.details;
  // SL-03: an expired hold routes to F-08 from this step too (§10).
  useHoldExpiryRedirect(true);
  // SL-05: fresh loads carry the drawn narrative hold (Thu Oct 8, 9:00 AM).
  useEffect(() => { if (flow.hydrated) flow.ensureNarrativeHold(); }, [flow.hydrated]); // eslint-disable-line react-hooks/exhaustive-deps
  const next = () => router.push(`${BASE}/book/deposit${flowQuery(flow)}`);
  return (
    <BookingShell step={4} stepHrefs={stepHrefs(flow)} manageHref="/b/harbor-and-pine/manage/demo-token">
      <div className="sl-b-main">
        <StepHeading step={4} title="Your details" />
        <p className="sl-b-lead">So Micah knows who&rsquo;s coming and we can send your confirmation.</p>
        <div className="sl-b-grid">
          <form id="details-form" onSubmit={(e) => { e.preventDefault(); next(); }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="sl-b-field"><label htmlFor="fn">First name</label><input id="fn" className="sl-b-input" value={d.firstName} onChange={(e) => flow.setDetails({ firstName: e.target.value })} required /></div>
              <div className="sl-b-field"><label htmlFor="ln">Last name</label><input id="ln" className="sl-b-input" value={d.lastName} onChange={(e) => flow.setDetails({ lastName: e.target.value })} required /></div>
            </div>
            <div className="sl-b-field"><label htmlFor="em">Email</label><input id="em" type="email" className="sl-b-input" value={d.email} onChange={(e) => flow.setDetails({ email: e.target.value })} required /><p className="hint">Your confirmation and the link to change your booking go here.</p></div>
            <div className="sl-b-field"><label htmlFor="mo">Mobile number</label><input id="mo" className="sl-b-input" value={d.mobile} onChange={(e) => flow.setDetails({ mobile: e.target.value })} /><p className="hint">Only used for a reminder and if the shop needs to reach you.</p></div>
            <div className="sl-b-field"><label htmlFor="no">Note for Micah (optional)</label><textarea id="no" className="sl-b-input" rows={3} value={d.note} onChange={(e) => flow.setDetails({ note: e.target.value })} /></div>
            <label className="sl-b-check"><input type="checkbox" checked={d.reminder} onChange={(e) => flow.setDetails({ reminder: e.target.checked })} /><span>Text me a reminder the day before, Wednesday at 9:00 AM</span></label>
          </form>
          <div className="sl-b-side"><FlowSummary ctaNode={<Button variant="linen" type="submit" form="details-form">Continue to deposit</Button>} /></div>
        </div>
      </div>
    </BookingShell>
  );
}
export default function Page() { return <Suspense><Inner /></Suspense>; }
