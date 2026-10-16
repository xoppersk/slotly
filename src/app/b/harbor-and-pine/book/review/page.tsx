"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookingShell, StepHeading } from "@/components/sl/shells/BookingShell";
import { Button } from "@/components/sl/Button";
import { HoldTimer } from "@/components/sl/HoldTimer";
import { formatCents, getBarber, getService } from "@/lib/api";
import { BASE, flowQuery, stepHrefs, useBookingFlow, useHoldExpiryRedirect } from "../../_flow/BookingFlow";
import { dateLabel, endTime } from "../../_flow/Summary";

/* SL-13: Review.html's composition — main column is the light "Your visit"
   card (6 Edit rows, "Not booked yet" pill); the dark Payment panel in the
   side column carries the hold ring, the money lines, the checkbox and
   Confirm. (Previously all of that sat in the main column under an answers
   table, with the generic summary at the side.) */
function Row({ label, children, editHref }: { label: string; children: React.ReactNode; editHref: string }) {
  return <div style={{ display: "grid", gridTemplateColumns: "130px 1fr auto", gap: 16, padding: "18px 0", borderBottom: "1px solid var(--line)", alignItems: "start" }}><b style={{ fontSize: 14 }}>{label}</b><div style={{ fontSize: 15, lineHeight: 1.55, minWidth: 0, overflowWrap: "anywhere" }}>{children}</div><Link href={editHref} style={{ fontWeight: 600, fontSize: 14 }}>Edit</Link></div>;
}

function Inner() {
  const flow = useBookingFlow(); const router = useRouter(); const [agree, setAgree] = useState(false);
  // SL-03: an expired hold routes to F-08 from this step too (§10).
  useHoldExpiryRedirect(true);
  // SL-05: fresh loads carry the drawn narrative hold (Thu Oct 8, 9:00 AM).
  useEffect(() => { if (flow.hydrated) flow.ensureNarrativeHold(); }, [flow.hydrated]); // eslint-disable-line react-hooks/exhaustive-deps
  const svc = getService(flow.serviceId); const barber = getBarber(flow.barberId); const d = flow.details;
  const q = flowQuery(flow);
  const secs = flow.secondsLeft;
  const moneyRow = (label: string, value: string, due = false) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 14, color: due ? "var(--linen)" : "#cdb8ae", fontWeight: due ? 700 : 400 }}><span>{label}</span><span>{value}</span></div>
  );
  return (
    <BookingShell step={6} stepHrefs={stepHrefs(flow)} manageHref="/b/harbor-and-pine/manage/demo-token">
      <div className="sl-b-main">
        <StepHeading step={6} title="Check and confirm" />
        <p className="sl-b-lead">One look before we book it.</p>
        <div className="sl-b-grid">
          <div className="sl-b-card" style={{ paddingTop: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 4px" }}>
              <span style={{ font: "600 20px/1.2 var(--font-display)" }}>Your visit</span>
              <span style={{ display: "inline-flex", alignItems: "center", height: 28, padding: "0 12px", borderRadius: 16, background: "#f1e8e2", color: "#5c4a45", fontSize: 12, fontWeight: 600 }}>Not booked yet</span>
            </div>
            <Row label="Service" editHref={`${BASE}/book/service${q}`}><b>{svc?.name}</b><br /><span style={{ color: "var(--muted)" }}>{svc?.durationMinutes} minutes · {svc ? formatCents(svc.priceCents) : ""}</span></Row>
            <Row label="Barber" editHref={`${BASE}/book/barber${q}`}><b>{flow.barberId === "any" ? "Any barber" : barber?.name}</b><br /><span style={{ color: "var(--muted)" }}>Harbor &amp; Pine, 214 Fairmount Ave</span></Row>
            <Row label="When" editHref={`${BASE}/book/time${q}`}><b>{dateLabel(flow.date)}, 2026</b><br /><span style={{ color: "var(--muted)" }}>{flow.time ? `${flow.time} – ${svc ? endTime(flow.time, svc.durationMinutes) : ""}, Eastern` : "Not chosen yet"}</span></Row>
            <Row label="Your details" editHref={`${BASE}/book/details${q}`}><b>{d.firstName} {d.lastName}</b><br /><span style={{ color: "var(--muted)" }}>{d.email} · {d.mobile}</span></Row>
            <Row label="Note" editHref={`${BASE}/book/details${q}`}>&ldquo;{d.note}&rdquo;<br /><span style={{ color: "var(--muted)" }}>{barber?.name ?? "Micah"} sees this before you arrive</span></Row>
            <Row label="Deposit" editHref={`${BASE}/book/deposit${q}`}><b>Visa ending {flow.cardLast4}</b><br /><span style={{ color: "var(--muted)" }}>$20.00 charged when you confirm</span></Row>
          </div>
          <div className="sl-b-side">
            <aside aria-label="Payment" style={{ background: "var(--ink)", color: "var(--card)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-dark)", padding: 26 }}>
              <h2 style={{ font: "600 24px/1.15 var(--font-display)", letterSpacing: "-.02em", margin: "0 0 18px" }}>Payment</h2>
              {flow.holdTime && secs !== null && secs > 0 ? <div style={{ marginBottom: 18 }}><HoldTimer key={`${flow.holdTime}|${flow.holdExpiresAt}`} time={flow.holdTime} initialSeconds={Math.max(1, secs)} onDark /></div> : null}
              <div>
                {moneyRow(svc?.name ?? "Service", svc ? formatCents(svc.priceCents) : "")}
                {moneyRow("Pay at the shop", svc ? formatCents(svc.priceCents - 2000) : "")}
                {moneyRow("Deposit charged now", "$20.00", true)}
              </div>
              <label className="sl-b-check" style={{ marginTop: 18, color: "var(--linen)" }}><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>I understand the $20 deposit is kept if I cancel or move after Wednesday, October 7 at 9:00 AM.</span></label>
              <div style={{ marginTop: 20 }}><Button variant="linen" disabled={!agree} onClick={() => router.push(`${BASE}/booked/SLY-2026-1008-091`)}>Confirm and pay $20</Button></div>
              <p style={{ marginTop: 14, fontSize: 13, color: "#cdb8ae", lineHeight: 1.55 }}>You&rsquo;ll get a confirmation at {d.email} with a link to change or cancel.</p>
            </aside>
          </div>
        </div>
      </div>
    </BookingShell>
  );
}
export default function Page() { return <Suspense><Inner /></Suspense>; }
