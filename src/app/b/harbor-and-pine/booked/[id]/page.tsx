"use client";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { BookingShell } from "@/components/sl/shells/BookingShell";
import { Button, ButtonLink } from "@/components/sl/Button";
import { StatusPill } from "@/components/sl/StatusPill";
import { downloadICS } from "../../_flow/BookingFlow";

function Inner() {
  const params = useParams(); const id = String(params.id ?? "SLY-2026-1008-091");
  return (
    <BookingShell manageHref="/b/harbor-and-pine/manage/demo-token">
      <div className="sl-b-main" style={{ maxWidth: 760 }}>
        <h1 className="sl-b-moment">You&rsquo;re booked, Avery.</h1>
        <p className="sl-b-lead">Thursday, October 8 at 9:00 AM with Micah.</p>
        <div className="sl-b-actions">
          <Button variant="primary" onClick={downloadICS}>Add to calendar</Button>
          <ButtonLink href="#">Get directions</ButtonLink>
          <ButtonLink href="/b/harbor-and-pine/manage/demo-token">Change or cancel</ButtonLink>
        </div>
        <div className="sl-b-card" style={{ marginTop: 28 }}>
          <dl className="sl-b-kv">
            <dt>Confirmation sent</dt><dd style={{ fontWeight: 400 }}>To avery.lewis@sevynlabs.io, with your link to make changes.</dd>
            <dt>Reminder</dt><dd style={{ fontWeight: 400 }}>We&rsquo;ll text (215) 555-0192 on Wednesday at 9:00 AM.</dd>
            <dt>Free changes until</dt><dd style={{ fontWeight: 400 }}>Wednesday, October 7 at 9:00 AM. After that the deposit is kept.</dd>
            <dt>Booking</dt><dd>{id} <StatusPill status="Confirmed" /></dd>
            <dt>Service</dt><dd>Signature haircut · 45 min</dd>
            <dt>Where</dt><dd>214 Fairmount Ave, Philadelphia</dd>
            <dt>Paid today</dt><dd>$20.00 deposit · Visa 4242</dd>
            <dt>At the shop</dt><dd>$28.00</dd>
          </dl>
        </div>
      </div>
    </BookingShell>
  );
}
export default function Page() { return <Suspense><Inner /></Suspense>; }
