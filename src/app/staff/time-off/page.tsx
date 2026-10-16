"use client";

import { useState } from "react";
import { PhoneShell } from "@/components/sl/shells/PhoneShell";
import { StatusPill } from "@/components/sl/StatusPill";
import { getTimeOff } from "@/lib/api";
import type { PillStatus } from "@/lib/types";

/* S-02 — Micah asks for time off. The draft Fri–Sat Oct 23–24 request is
   pre-filled exactly as drawn, and its warning names the affected
   bookings BEFORE anything is sent (HANDOVER §10). Past requests come
   from the time-off fixture. */
export default function StaffTimeOffPage() {
  const [kind, setKind] = useState<"all-day" | "part-day">("all-day");
  const timeoff = getTimeOff();
  const draft = timeoff.requests.find((r) => r.status === "Draft")!;
  const past = timeoff.requests.filter((r) => r.status !== "Draft");

  return (
    <PhoneShell
      current="time-off"
      header={<span className="sl-staff-hdtitle">Time off</span>}
      headerAction={
        <span className="sl-staff-approver">
          <span className="sl-mono" aria-hidden="true">
            SK
          </span>
          Sheku approves
        </span>
      }
    >
      <h1 className="sl-staff-h1">Ask for time off</h1>

      <form
        className="sl-staff-form"
        onSubmit={(e) => e.preventDefault()}
      >
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
            <input id="to-from" className="sl-staff-inp" defaultValue="Fri, Oct 23" />
          </div>
          <div className="sl-staff-field">
            <label htmlFor="to-to">To</label>
            <input id="to-to" className="sl-staff-inp" defaultValue="Sat, Oct 24" />
          </div>
        </div>
        <div className="sl-staff-field">
          <label htmlFor="to-note">
            Note for Sheku <span className="sl-staff-opt">(optional)</span>
          </label>
          <input id="to-note" className="sl-staff-inp" defaultValue="Family wedding in Baltimore" />
        </div>
      </form>

      <div className="sl-staff-warn">
        <span className="sl-staff-warn-n" aria-hidden="true">
          {draft.affectedBookings!.length}
        </span>
        <span>
          <b>{draft.affectedBookings!.length} bookings would need a new time</b>
          {draft.affectedLine}
        </span>
      </div>

      <button type="button" className="sl-staff-send">
        Send request
      </button>

      <p className="sl-staff-lbl">Your requests</p>
      <div className="sl-card" style={{ overflow: "hidden" }}>
        {past.map((r) => (
          <div key={r.id} className="sl-agenda-row">
            <span className="sl-staff-req">
              <b>{r.label}</b>
              <span>{r.approvedByLabel}</span>
            </span>
            <StatusPill status={r.status as PillStatus} />
          </div>
        ))}
      </div>
    </PhoneShell>
  );
}
