"use client";
/* D-03 Booking drawer — 480px, scrim, role="dialog" aria-modal, focus
   trap, Esc closes. Works for any booking by id; Jordan Bell is the
   drawn default case. Top actions advance the run-sheet status (§10);
   No-show / Cancel sit at the bottom. */
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/sl/Button";
import { StatusPill } from "@/components/sl/StatusPill";
import { actionForStatus } from "@/components/sl/RunSheetRow";
import { formatWholeDollars, getCustomer } from "@/lib/api";
import { customers } from "@/lib/api";
import type { Booking } from "@/lib/types";
import { useDashboard } from "../DashboardContext";
import { IconClose, useDrawerTrap } from "../ui";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? "th");
}

function splitActivity(label: string): { title: string; sub: string } {
  const m = /^(.*?) ((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), .*)$/.exec(label);
  return m ? { title: m[1]!, sub: m[2]! } : { title: label, sub: "" };
}

export function BookingDrawer({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { advance, removeBooking } = useDashboard();
  const [confirming, setConfirming] = useState<"noshow" | "cancel" | null>(null);
  const ref = useDrawerTrap<HTMLElement>(onClose);

  const customer = customers.find((c) => c.name === booking.customer) ?? getCustomer(booking.customer);
  const action = actionForStatus(booking.status);
  const primaryLabel =
    booking.status === "In the chair"
      ? `Finish and take ${formatWholeDollars(booking.balanceCents)}`
      : action;
  const startShort = booking.start.replace(/ [AP]M$/, "");
  const activities = [
    booking.reminderLabel ? splitActivity(booking.reminderLabel) : null,
    booking.bookedAtLabel ? splitActivity(booking.bookedAtLabel) : null,
  ].filter((x): x is { title: string; sub: string } => x !== null);

  const historyLine = (() => {
    const visits = booking.visitNumber ?? customer?.visits;
    if (!visits) return null;
    const last = booking.lastVisitLabel ?? customer?.lastVisitLabel;
    return {
      main: `${ordinal(visits)} visit${last ? ` · ${last.startsWith("last") ? last : `last ${last}`}` : ""}`,
      sub: `${booking.noShows ?? customer?.noShows ?? 0} no-shows · ${booking.reschedules ?? customer?.reschedules ?? 0} reschedule${(booking.reschedules ?? customer?.reschedules ?? 0) === 1 ? "" : "s"}`,
    };
  })();

  return (
    <>
      <div className="sl-d-scrim" onClick={onClose} aria-hidden="true" />
      <aside ref={ref} className="sl-d-drawer" role="dialog" aria-modal="true" aria-labelledby="sl-d-drawer-name" tabIndex={-1}>
        <div className="sl-d-drawer__head">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="sl-d-drawer__code">{booking.code}</span>
            <button type="button" className="sl-d-drawer__close" aria-label="Close" onClick={onClose}>
              <IconClose />
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10 }}>
            <span className="sl-d-drawer__avatar" aria-hidden="true">{booking.customer.charAt(0)}</span>
            <h2 id="sl-d-drawer-name" className="sl-d-drawer__name">{booking.customer}</h2>
          </div>
          <p style={{ margin: "14px 0 0", fontSize: 15, color: "#e6d9d1" }}>
            Today, {startShort} – {booking.end} · {booking.service} with {booking.barber}
          </p>
          <div className="sl-d-drawer__acts">
            {primaryLabel ? (
              <Button variant="linen" onClick={() => advance(booking.id)}>{primaryLabel}</Button>
            ) : null}
            <Link href="/b/harbor-and-pine" className="sl-btn sl-d-drawer__dark-btn" style={{ height: 48, background: "transparent", color: "var(--linen)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.24)" }}>
              Reschedule
            </Link>
            <a href="#" className="sl-btn" style={{ height: 48, background: "transparent", color: "var(--linen)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.24)" }} onClick={(e) => e.preventDefault()}>
              Message
            </a>
          </div>
        </div>

        <div className="sl-d-drawer__body">
          <div className="sl-d-card" style={{ padding: "8px 20px 10px" }}>
            <dl className="sl-d-dl">
              <div>
                <dt>Status</dt>
                <dd><StatusPill status={booking.status} /></dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>
                  <b style={{ fontWeight: 600 }}>
                    {booking.depositCents > 0
                      ? `${formatWholeDollars(booking.depositCents)} deposit ${booking.depositStatus === "paid" ? "paid" : "due"} · ${formatWholeDollars(booking.balanceCents)} due at the shop`
                      : `No deposit · ${formatWholeDollars(booking.balanceCents)} due at the shop`}
                  </b>
                </dd>
              </div>
              <div>
                <dt>Contact</dt>
                <dd>
                  {booking.customerEmail}
                  {booking.customerPhone ? (
                    <span className="sl-d-sub">{booking.customerPhone}{booking.prefersText ? " · prefers text" : ""}</span>
                  ) : null}
                </dd>
              </div>
              {historyLine ? (
                <div>
                  <dt>History</dt>
                  <dd>{historyLine.main}<span className="sl-d-sub">{historyLine.sub}</span></dd>
                </div>
              ) : null}
              {booking.note ? (
                <div>
                  <dt>Note</dt>
                  <dd className="sl-d-note">“{booking.note}”</dd>
                </div>
              ) : null}
            </dl>
          </div>

          {activities.length > 0 ? (
            <div className="sl-d-card" style={{ marginTop: 12, padding: 20 }}>
              <h3 className="sl-d-cap" style={{ margin: "0 0 12px" }}>Activity</h3>
              <ol className="sl-d-activity">
                {activities.map((a) => (
                  <li key={a.title}>
                    <i aria-hidden="true" />
                    {a.title}
                    {a.sub ? <span className="sl-d-sub">{a.sub}</span> : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>

        <div className="sl-d-drawer__foot">
          {confirming === "noshow" ? (
            <>
              <span style={{ fontSize: 14, alignSelf: "center" }}>Mark as no-show? The deposit is kept.</span>
              <span style={{ display: "flex", gap: 8 }}>
                <Button size="dashboard" onClick={() => setConfirming(null)}>Back</Button>
                <Button size="dashboard" variant="destructive" onClick={() => { removeBooking(booking.id); onClose(); }}>Mark no-show</Button>
              </span>
            </>
          ) : confirming === "cancel" ? (
            <>
              <span style={{ fontSize: 14, alignSelf: "center" }}>Cancel this booking?</span>
              <span style={{ display: "flex", gap: 8 }}>
                <Button size="dashboard" onClick={() => setConfirming(null)}>Back</Button>
                <Button size="dashboard" variant="destructive" onClick={() => { removeBooking(booking.id); onClose(); }}>Cancel booking</Button>
              </span>
            </>
          ) : (
            <>
              <Button size="dashboard" onClick={() => setConfirming("noshow")}>Mark no-show</Button>
              <Button size="dashboard" variant="destructive" onClick={() => setConfirming("cancel")}>Cancel booking</Button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
