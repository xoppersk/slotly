"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StepHeading } from "@/components/sl/shells/BookingShell";
import { Button } from "@/components/sl/Button";
import { HoldTimer } from "@/components/sl/HoldTimer";
import { formatCents } from "@/lib/format";
import {
  flowQuery,
  useBookingFlow,
  useHoldExpiryRedirect,
} from "../../_flow/BookingFlow";
import { FlowShell } from "../../_flow/Shell";
import { dateLabel, endTime } from "../../_flow/Summary";
import { freeCancelLabel } from "../../_lib/types";

/* Step 6 — Review.html's composition: the light "Your visit" card (Edit
   rows, "Not booked yet" pill) + the dark Payment panel carrying the hold
   ring and money lines. Confirm calls POST /api/public/bookings, which
   runs the create_booking RPC — a REAL row lands in the owner's
   dashboard. A lost slot race (409 slot_taken) routes back to Time with
   the F-08 conflict state. No payment is charged online (coordinator
   decision): the deposit is due at the shop. */
function Row({
  label,
  children,
  editHref,
}: {
  label: string;
  children: React.ReactNode;
  editHref: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "130px 1fr auto",
        gap: 16,
        padding: "18px 0",
        borderBottom: "1px solid var(--line)",
        alignItems: "start",
      }}
    >
      <b style={{ fontSize: 14 }}>{label}</b>
      <div style={{ fontSize: 15, lineHeight: 1.55, minWidth: 0, overflowWrap: "anywhere" }}>
        {children}
      </div>
      <Link href={editHref} style={{ fontWeight: 600, fontSize: 14 }}>
        Edit
      </Link>
    </div>
  );
}

function Inner() {
  const flow = useBookingFlow();
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useHoldExpiryRedirect(true);

  useEffect(() => {
    if (flow.hydrated && !flow.startsAt) {
      router.replace(`${flow.base}/book/time${flowQuery(flow)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.hydrated, flow.startsAt]);

  const svc = flow.service;
  const barber = flow.barber;
  const d = flow.details;
  const q = flowQuery(flow);
  const base = flow.base;
  const secs = flow.secondsLeft;
  const tz = flow.catalog.business.timezone;
  const policy = flow.catalog.policy;
  const deposit = svc?.depositCents ?? 0;
  const price = svc?.priceCents ?? 0;
  const cancelLabel =
    flow.startsAt && policy
      ? freeCancelLabel(flow.startsAt, policy.freeCancelHours, tz)
      : null;
  const staffIdForBooking =
    flow.barberId === "any" ? (flow.slotStaffId ?? "any") : flow.barberId;
  const displayStaffName =
    flow.barberId === "any"
      ? flow.slotStaffId
        ? (flow.catalog.staff.find((s) => s.id === flow.slotStaffId)?.name ??
          "First available")
        : "Any barber"
      : barber?.name;

  const moneyRow = (label: string, value: string, due = false) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "5px 0",
        fontSize: 14,
        color: due ? "var(--linen)" : "#cdb8ae",
        fontWeight: due ? 700 : 400,
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );

  const confirm = async () => {
    if (submitting || !flow.startsAt || !flow.endsAt || !svc) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: flow.catalog.business.id,
          serviceId: svc.id,
          staffId: staffIdForBooking,
          startsAt: flow.startsAt,
          endsAt: flow.endsAt,
          customer: {
            name: `${d.firstName} ${d.lastName}`.trim(),
            phone: d.mobile.trim() || null,
            email: d.email.trim() || null,
            notes: d.note,
          },
        }),
      });
      const j = (await res.json().catch(() => null)) as {
        bookingId?: string;
        manageToken?: string;
        code?: string;
        message?: string;
      } | null;
      if (res.status === 409 || j?.code === "slot_taken") {
        // Lost the race — back to Time with the real F-08 conflict state.
        router.push(
          `${base}/book/time?conflict=1&service=${svc.id}&barber=${flow.barberId}&missed=${encodeURIComponent(flow.startsAt)}`,
        );
        return;
      }
      if (!res.ok || !j?.bookingId || !j?.manageToken) {
        setError(j?.message ?? "We couldn't book that time. Please try again.");
        setSubmitting(false);
        return;
      }
      // The manage token is shown exactly once — keep it in sessionStorage
      // so a revisit of the confirmation page can recover it, and pass it
      // to the confirmation page as ?t= for the server-side receipt read.
      try {
        sessionStorage.setItem(`slotly-manage:${j.bookingId}`, j.manageToken);
        sessionStorage.removeItem(`slotly-booking-flow-v2:${flow.slug}`);
      } catch {}
      router.push(`${base}/booked/${j.bookingId}?t=${encodeURIComponent(j.manageToken)}`);
    } catch {
      setError("We couldn't reach the booking service. Check your connection and try again.");
      setSubmitting(false);
    }
  };

  return (
    <FlowShell step={6}>
      <div className="sl-b-main">
        <StepHeading step={6} title="Check and confirm" />
        <p className="sl-b-lead">One look before we book it.</p>
        <div className="sl-b-grid">
          <div className="sl-b-card" style={{ paddingTop: 6 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 0 4px",
              }}
            >
              <span style={{ font: "600 20px/1.2 var(--font-display)" }}>
                Your visit
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: 28,
                  padding: "0 12px",
                  borderRadius: 16,
                  background: "#f1e8e2",
                  color: "#5c4a45",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Not booked yet
              </span>
            </div>
            <Row label="Service" editHref={`${base}/book/service${q}`}>
              <b>{svc?.name}</b>
              <br />
              <span style={{ color: "var(--muted)" }}>
                {svc?.durationMinutes} minutes · {svc ? formatCents(svc.priceCents) : ""}
              </span>
            </Row>
            <Row label="Barber" editHref={`${base}/book/barber${q}`}>
              <b>{displayStaffName}</b>
              <br />
              <span style={{ color: "var(--muted)" }}>
                {flow.catalog.business.name}
                {flow.catalog.business.address
                  ? `, ${flow.catalog.business.address}`
                  : ""}
              </span>
            </Row>
            <Row label="When" editHref={`${base}/book/time${q}`}>
              <b>
                {dateLabel(flow.date)}, {flow.date.slice(0, 4)}
              </b>
              <br />
              <span style={{ color: "var(--muted)" }}>
                {flow.timeLabel && svc
                  ? `${flow.timeLabel} – ${endTime(flow.timeLabel, svc.durationMinutes)}`
                  : "Not chosen yet"}
              </span>
            </Row>
            <Row label="Your details" editHref={`${base}/book/details${q}`}>
              <b>
                {d.firstName} {d.lastName}
              </b>
              <br />
              <span style={{ color: "var(--muted)" }}>
                {[d.email, d.mobile].filter(Boolean).join(" · ")}
              </span>
            </Row>
            <Row label="Note" editHref={`${base}/book/details${q}`}>
              {d.note ? (
                <>
                  &ldquo;{d.note}&rdquo;
                  <br />
                </>
              ) : null}
              <span style={{ color: "var(--muted)" }}>
                {displayStaffName} sees this before you arrive
              </span>
            </Row>
            <Row label="Deposit" editHref={`${base}/book/deposit${q}`}>
              <b>
                {deposit > 0
                  ? `${formatCents(deposit)} due at the shop`
                  : "No deposit for this service"}
              </b>
              <br />
              <span style={{ color: "var(--muted)" }}>
                Nothing is charged online — you pay at the shop.
              </span>
            </Row>
          </div>
          <div className="sl-b-side">
            <aside
              aria-label="Payment"
              style={{
                background: "var(--ink)",
                color: "var(--card)",
                borderRadius: "var(--radius-xl)",
                boxShadow: "var(--shadow-dark)",
                padding: 26,
              }}
            >
              <h2
                style={{
                  font: "600 24px/1.15 var(--font-display)",
                  letterSpacing: "-.02em",
                  margin: "0 0 18px",
                }}
              >
                Payment
              </h2>
              {flow.holdTime && secs !== null && secs > 0 ? (
                <div style={{ marginBottom: 18 }}>
                  <HoldTimer
                    key={`${flow.holdTime}|${flow.holdExpiresAt}`}
                    time={flow.holdTime}
                    initialSeconds={Math.max(1, secs)}
                    onDark
                  />
                </div>
              ) : null}
              <div>
                {moneyRow(svc?.name ?? "Service", svc ? formatCents(price) : "")}
                {moneyRow("Pay at the shop", formatCents(Math.max(0, price - deposit)))}
                {deposit > 0
                  ? moneyRow("Deposit due at the shop", formatCents(deposit), true)
                  : moneyRow("Due today", "$0.00", true)}
              </div>
              <label className="sl-b-check" style={{ marginTop: 18, color: "var(--linen)" }}>
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                />
                <span>
                  {deposit > 0
                    ? `I understand the ${formatCents(deposit)} deposit is due at the shop`
                    : "I understand payment is due at the shop"}
                  {cancelLabel
                    ? `, and free changes end ${cancelLabel}.`
                    : "."}
                </span>
              </label>
              {error ? (
                <p role="alert" style={{ marginTop: 14, fontSize: 14, color: "#f2c9c2", fontWeight: 600 }}>
                  {error}
                </p>
              ) : null}
              <div style={{ marginTop: 20 }}>
                <Button
                  variant="linen"
                  disabled={!agree || submitting || !flow.startsAt}
                  onClick={confirm}
                >
                  {submitting ? "Booking…" : "Confirm booking"}
                </Button>
              </div>
              <p style={{ marginTop: 14, fontSize: 13, color: "#cdb8ae", lineHeight: 1.55 }}>
                You&rsquo;ll get a confirmation
                {d.email ? ` at ${d.email}` : ""} with a link to change or
                cancel.
              </p>
            </aside>
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
