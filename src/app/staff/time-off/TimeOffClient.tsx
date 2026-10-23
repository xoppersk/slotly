"use client";
/* S-02 Time off form: real date inputs (the fixture's pre-filled text
   dates were canon), a real affected-bookings warning computed from
   the staff member's own live bookings BEFORE sending (countAffected
   Bookings), and submit → staff_time_off insert with status 'pending'
   (the own-insert RLS policy requires exactly that). */
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fromZonedTime } from "date-fns-tz";
import { PhoneShell } from "@/components/sl/shells/PhoneShell";
import { StatusPill } from "@/components/sl/StatusPill";
import type { PillStatus } from "@/lib/types";
import { countAffectedBookings, requestTimeOff } from "../actions";

export interface TimeOffRequestView {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  status: "pending" | "approved" | "declined";
}

function rangeLabel(r: TimeOffRequestView, timezone: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: timezone });
  const a = fmt(r.startsAt);
  const b = fmt(r.endsAt);
  return a === b ? a : `${a} – ${b}`;
}

export function TimeOffClient({
  businessName,
  timezone,
  today,
  requests,
}: {
  businessName: string;
  timezone: string;
  today: string;
  requests: TimeOffRequestView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<"all-day" | "part-day">("all-day");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [fromTime, setFromTime] = useState("09:00");
  const [toTime, setToTime] = useState("13:00");
  const [reason, setReason] = useState("");
  const [affected, setAffected] = useState<{ count: number; labels: string[] } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Recompute the affected-bookings warning whenever the range changes.
  useEffect(() => {
    let live = true;
    const startLocal = kind === "all-day" ? `${fromDate}T00:00:00` : `${fromDate}T${fromTime}:00`;
    const endLocal = kind === "all-day" ? `${toDate}T23:59:59` : `${toDate}T${toTime}:00`;
    const fromIso = fromZonedTime(startLocal, timezone).toISOString();
    const toIso = fromZonedTime(endLocal, timezone).toISOString();
    countAffectedBookings(fromIso, toIso).then((res) => {
      if (live) setAffected(res);
    });
    return () => {
      live = false;
    };
  }, [kind, fromDate, toDate, fromTime, toTime, timezone]);

  const send = () => {
    setNotice(null);
    startTransition(async () => {
      const res = await requestTimeOff({
        kind,
        fromDate,
        toDate,
        fromTime: kind === "part-day" ? fromTime : undefined,
        toTime: kind === "part-day" ? toTime : undefined,
        reason: reason || undefined,
      });
      if (!res.ok) {
        setNotice(res.error);
        return;
      }
      setNotice("Request sent.");
      setReason("");
      router.refresh();
    });
  };

  return (
    <PhoneShell
      current="time-off"
      header={<span className="sl-staff-hdtitle">Time off</span>}
      headerAction={<span className="sl-staff-approver">Owner of {businessName} approves</span>}
    >
      <h1 className="sl-staff-h1">Ask for time off</h1>

      <form className="sl-staff-form" onSubmit={(e) => e.preventDefault()}>
        <div className="sl-staff-seg" role="group" aria-label="How long">
          <button type="button" aria-pressed={kind === "all-day"} onClick={() => setKind("all-day")}>
            All day
          </button>
          <button type="button" aria-pressed={kind === "part-day"} onClick={() => setKind("part-day")}>
            Part of a day
          </button>
        </div>
        <div className="sl-staff-dates">
          <div className="sl-staff-field">
            <label htmlFor="to-from">From</label>
            <input id="to-from" className="sl-staff-inp" type="date" value={fromDate} min={today} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="sl-staff-field">
            <label htmlFor="to-to">To</label>
            <input id="to-to" className="sl-staff-inp" type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>
        {kind === "part-day" ? (
          <div className="sl-staff-dates">
            <div className="sl-staff-field">
              <label htmlFor="to-from-t">From time</label>
              <input id="to-from-t" className="sl-staff-inp" type="time" value={fromTime} onChange={(e) => setFromTime(e.target.value)} />
            </div>
            <div className="sl-staff-field">
              <label htmlFor="to-to-t">To time</label>
              <input id="to-to-t" className="sl-staff-inp" type="time" value={toTime} onChange={(e) => setToTime(e.target.value)} />
            </div>
          </div>
        ) : null}
        <div className="sl-staff-field">
          <label htmlFor="to-note">
            Note for the owner <span className="sl-staff-opt">(optional)</span>
          </label>
          <input id="to-note" className="sl-staff-inp" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why you need the time" />
        </div>
      </form>

      {affected && affected.count > 0 ? (
        <div className="sl-staff-warn">
          <span className="sl-staff-warn-n" aria-hidden="true">
            {affected.count}
          </span>
          <span>
            <b>{affected.count} booking{affected.count === 1 ? "" : "s"} would need a new time</b>
            {affected.labels.length > 0 ? ` — ${affected.labels.join(", ")}` : ""}
          </span>
        </div>
      ) : null}

      <button type="button" className="sl-staff-send" disabled={pending} onClick={send}>
        Send request
      </button>
      {notice ? (
        <p style={{ fontSize: 14, marginTop: 12, color: notice === "Request sent." ? "var(--open-ink)" : "var(--danger, #b3261e)" }}>{notice}</p>
      ) : null}

      <p className="sl-staff-lbl">Your requests</p>
      <div className="sl-card" style={{ overflow: "hidden" }}>
        {requests.map((r) => (
          <div key={r.id} className="sl-agenda-row">
            <span className="sl-staff-req">
              <b>{rangeLabel(r, timezone)}</b>
              <span>{r.reason || "—"}</span>
            </span>
            <StatusPill
              status={(r.status === "approved" ? "Approved" : r.status === "declined" ? "Cancelled" : "Pending") as PillStatus}
              label={r.status === "declined" ? "Declined" : undefined}
            />
          </div>
        ))}
        {requests.length === 0 ? (
          <div className="sl-agenda-row">
            <span style={{ fontSize: 14, color: "var(--muted)" }}>No requests yet.</span>
          </div>
        ) : null}
      </div>
    </PhoneShell>
  );
}
