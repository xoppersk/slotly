"use client";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookingShell } from "@/components/sl/shells/BookingShell";
import { Button, ButtonLink } from "@/components/sl/Button";
import { StatusPill } from "@/components/sl/StatusPill";
import { BASE, downloadICS } from "../../_flow/BookingFlow";

function Cancelled() {
  return (
    <BookingShell manageHref="#">
      <div className="sl-b-main" style={{ maxWidth: 760 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--oxblood)" }}>Booking SLY-2026-1008-091</p>
        <h1 className="sl-b-moment" style={{ marginTop: 10 }}>Your appointment is cancelled.</h1>
        <p className="sl-b-lead">You cancelled before Wednesday 9:00 AM, so your $20 deposit is on its way back to Visa 4242. Nothing else is owed.</p>
        <div className="sl-b-card" style={{ marginTop: 28 }}>
          <dl className="sl-b-kv">
            <dt>Was</dt><dd>Thu, Oct 8 · 9:00 AM</dd>
            <dt>Refund</dt><dd>$20.00 to Visa 4242</dd>
            <dt>Status</dt><dd>Cancelled</dd>
          </dl>
          <div className="sl-b-actions"><ButtonLink variant="primary" href={`${BASE}/book/service`}>Book another visit</ButtonLink><ButtonLink href={BASE}>Back to Harbor &amp; Pine</ButtonLink></div>
          <p style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}>Refunds usually show on your statement in 5–10 business days. We emailed a receipt to avery.lewis@sevynlabs.io.</p>
        </div>
      </div>
    </BookingShell>
  );
}
function Inner() {
  const sp = useSearchParams(); const router = useRouter();
  if (sp.get("state") === "cancelled") return <Cancelled />;
  return (
    <BookingShell manageHref="#">
      <div className="sl-b-main" style={{ maxWidth: 760 }}>
        <p style={{ fontSize: 14, color: "var(--muted)" }}>Opened from the link sent to avery.lewis@sevynlabs.io · <Link href={BASE}>Not you?</Link></p>
        <h1 className="sl-b-moment" style={{ marginTop: 12 }}>Your booking</h1>
        <p className="sl-b-lead">Thursday, October 8<br />9:00 – 9:45 AM · in 2 days&nbsp; <StatusPill status="Confirmed" /></p>
        <div className="sl-b-card" style={{ marginTop: 28 }}>
          <dl className="sl-b-kv">
            <dt>Service</dt><dd>Signature haircut · 45 min · $48.00</dd>
            <dt>Barber</dt><dd>Micah</dd>
            <dt>Where</dt><dd>Harbor &amp; Pine, 214 Fairmount Ave</dd>
            <dt>Paid</dt><dd>$20.00 deposit · $28.00 at the shop</dd>
            <dt>Booking</dt><dd>SLY-2026-1008-091</dd>
          </dl>
          <div className="sl-b-actions">
            <ButtonLink variant="primary" href={`${BASE}/book/time?service=signature-haircut&barber=micah&date=2026-10-08`}>Move to another time</ButtonLink>
            <Button onClick={() => router.push(`?state=cancelled`)}>Cancel booking</Button>
            <Button onClick={downloadICS}>Add to calendar</Button>
          </div>
        </div>
        <div className="sl-b-card" style={{ marginTop: 20 }}>
          <h2 style={{ font: "600 20px/1.25 var(--font-display)", marginBottom: 12 }}>Changing your plans</h2>
          <p style={{ fontSize: 15, lineHeight: 1.6 }}><b>Free until Wednesday, October 7 at 9:00 AM.</b></p>
          <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 1.7, fontSize: 15 }}>
            <li><b>Move it</b> — Your deposit carries over to the new time.</li>
            <li><b>Cancel before the deadline</b> — $20 goes back to Visa 4242.</li>
            <li><b>Cancel after it</b> — The shop keeps the $20 deposit.</li>
          </ul>
          <p style={{ marginTop: 14, fontSize: 14, color: "var(--muted)" }}>Running late on the day? Call (215) 555-0148.</p>
        </div>
      </div>
    </BookingShell>
  );
}
export default function Page() { return <Suspense><Inner /></Suspense>; }
