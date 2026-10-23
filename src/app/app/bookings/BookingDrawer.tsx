"use client";
/* D-03 Booking drawer — 480px, scrim, role="dialog" aria-modal, focus
   trap, Esc closes. Shows the REAL booking: status actions are the real
   transitions (Confirm / Complete / Cancel / No-show via server
   actions), internal notes save to bookings.internal_notes. The drawn
   Reschedule / Message buttons are gone — rescheduling runs through
   the customer's manage link (public surface) and there is no
   messaging backend (PROD-W4.md). */
import { useState, useTransition } from "react";
import { Button } from "@/components/sl/Button";
import { StatusPill } from "@/components/sl/StatusPill";
import { saveInternalNotes } from "../actions";
import { BookingStatusButton, BookingTerminalButtons } from "../BookingActions";
import { dateShort, wholeDollars, type DashBooking } from "../_lib/model";
import { IconClose, useDrawerTrap } from "../ui";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? "th");
}

const SOURCE_LABEL: Record<string, string> = {
  online: "Booked online",
  phone: "Booked by phone",
  walk_in: "Walk-in",
  dashboard: "Booked at the shop",
};

export function BookingDrawer({
  booking,
  lastVisitLabel,
  today,
  onClose,
}: {
  booking: DashBooking;
  lastVisitLabel?: string;
  today?: string;
  onClose: () => void;
}) {
  const ref = useDrawerTrap<HTMLElement>(onClose);
  const [notes, setNotes] = useState(booking.internalNotes);
  const [notesState, setNotesState] = useState<"idle" | "saved" | "error">("idle");
  const [saving, startSaving] = useTransition();

  const isToday = today !== undefined && booking.dateKey === today;
  const whenLine = `${isToday ? "Today" : dateShort(booking.dateKey)}, ${booking.startLabel.replace(/ [AP]M$/, "")} – ${booking.endLabel} · ${booking.serviceName} with ${booking.staffName}`;
  const primaryLabel =
    booking.dbStatus === "confirmed" && booking.balanceCents > 0
      ? `Complete · ${wholeDollars(booking.balanceCents)} due at the shop`
      : undefined;
  const bookedAt = new Date(booking.createdAt).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const visits = booking.customerVisits;

  const saveNotes = () =>
    startSaving(async () => {
      const res = await saveInternalNotes(booking.id, notes);
      setNotesState(res.ok ? "saved" : "error");
    });

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
            <span className="sl-d-drawer__avatar" aria-hidden="true">{booking.customerName.charAt(0)}</span>
            <h2 id="sl-d-drawer-name" className="sl-d-drawer__name">{booking.customerName}</h2>
          </div>
          <p style={{ margin: "14px 0 0", fontSize: 15, color: "#e6d9d1" }}>
            {whenLine}
          </p>
          <div className="sl-d-drawer__acts">
            <BookingStatusButton
              bookingId={booking.id}
              status={booking.dbStatus}
              size="dashboard"
              variant="linen"
              label={primaryLabel}
            />
          </div>
        </div>

        <div className="sl-d-drawer__body">
          <div className="sl-d-card" style={{ padding: "8px 20px 10px" }}>
            <dl className="sl-d-dl">
              <div>
                <dt>Status</dt>
                <dd><StatusPill status={booking.pill} label={booking.pillLabel} /></dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>
                  <b style={{ fontWeight: 600 }}>
                    {booking.depositCents > 0
                      ? booking.depositPaidCents > 0
                        ? `${wholeDollars(booking.depositPaidCents)} deposit paid · ${wholeDollars(booking.balanceCents)} due at the shop`
                        : `${wholeDollars(booking.depositCents)} deposit due at the shop · ${wholeDollars(booking.balanceCents)} in total`
                      : `No deposit · ${wholeDollars(booking.balanceCents)} due at the shop`}
                  </b>
                </dd>
              </div>
              <div>
                <dt>Contact</dt>
                <dd>
                  {booking.customerEmail || "—"}
                  {booking.customerPhone ? (
                    <span className="sl-d-sub">{booking.customerPhone}</span>
                  ) : null}
                </dd>
              </div>
              {visits > 0 || booking.customerNoShows > 0 ? (
                <div>
                  <dt>History</dt>
                  <dd>
                    {visits > 0 ? `${ordinal(visits)} visit${lastVisitLabel ? ` · last ${lastVisitLabel}` : ""}` : "No visits yet"}
                    <span className="sl-d-sub">{booking.customerNoShows} no-show{booking.customerNoShows === 1 ? "" : "s"}</span>
                  </dd>
                </div>
              ) : null}
              {booking.customerNotes ? (
                <div>
                  <dt>Note</dt>
                  <dd className="sl-d-note">“{booking.customerNotes}”</dd>
                </div>
              ) : null}
              <div>
                <dt>Internal notes</dt>
                <dd>
                  <textarea
                    className="sl-d-inp"
                    style={{ width: "100%", minHeight: 64, resize: "vertical" }}
                    value={notes}
                    onChange={(e) => { setNotes(e.target.value); setNotesState("idle"); }}
                    placeholder="Only your team sees these"
                    aria-label="Internal notes"
                  />
                  <span style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                    <Button size="sm" disabled={saving || notes === booking.internalNotes} onClick={saveNotes}>
                      Save note
                    </Button>
                    {notesState === "saved" ? <span style={{ fontSize: 13, color: "var(--open-ink)" }}>Saved</span> : null}
                    {notesState === "error" ? <span style={{ fontSize: 13, color: "var(--danger, #b3261e)" }}>Could not save</span> : null}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          <div className="sl-d-card" style={{ marginTop: 12, padding: 20 }}>
            <h3 className="sl-d-cap" style={{ margin: "0 0 12px" }}>Activity</h3>
            <ol className="sl-d-activity">
              <li>
                <i aria-hidden="true" />
                {SOURCE_LABEL[booking.source] ?? "Booked"}
                <span className="sl-d-sub">{bookedAt}</span>
              </li>
            </ol>
          </div>
        </div>

        <div className="sl-d-drawer__foot">
          <BookingTerminalButtons bookingId={booking.id} status={booking.dbStatus} onDone={onClose} />
        </div>
      </aside>
    </>
  );
}
