"use client";

import { useState } from "react";
import { PhoneShell } from "@/components/sl/shells/PhoneShell";
import { Button } from "@/components/sl/Button";
import { getBarber, getServices } from "@/lib/api";

/* S-03 — Micah's profile: photo placeholder, the bio customers see, the
   services he offers (all 5 on) and his notification switches. Switches
   are role="switch" with the labels drawn on the screen (HANDOVER §11). */

function Switch({ label, initial = true }: { label: string; initial?: boolean }) {
  const [on, setOn] = useState(initial);
  return (
    <button
      type="button"
      className="sl-tog"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => setOn((v) => !v)}
    />
  );
}

export default function StaffProfilePage() {
  const micah = getBarber("micah")!;
  const offered = getServices().filter((s) => micah.serviceIds.includes(s.id));

  return (
    <PhoneShell
      current="profile"
      header={<span className="sl-staff-hdtitle">Profile</span>}
      headerAction={
        <Button size="sm" type="button">
          Preview
        </Button>
      }
    >
      <div className="sl-staff-idrow">
        <span className="sl-staff-photo">[Photo]</span>
        <div>
          <h1 className="sl-staff-name">{micah.name}</h1>
          <p className="sl-staff-sub">
            {micah.roleLabel} · {micah.email}
          </p>
        </div>
      </div>

      <div className="sl-staff-field sl-staff-bio">
        <label htmlFor="bio">What customers see</label>
        <textarea id="bio" className="sl-staff-inp" defaultValue={micah.bio} />
      </div>

      <p className="sl-staff-lbl">
        Services I offer · {offered.length} of {getServices().length}
      </p>
      <div className="sl-card" style={{ overflow: "hidden" }}>
        {offered.map((s) => (
          <div key={s.id} className="sl-agenda-row">
            <span className="sl-staff-rowlabel sl-staff-rowlabel--svc">{s.name}</span>
            <Switch label={`I offer ${s.name}`} />
          </div>
        ))}
      </div>

      <p className="sl-staff-lbl">Tell me when</p>
      <div className="sl-card" style={{ overflow: "hidden" }}>
        <div className="sl-agenda-row">
          <span className="sl-staff-rowlabel">Someone books or cancels</span>
          <Switch label="Booking changes" />
        </div>
        <div className="sl-agenda-row">
          <span className="sl-staff-rowlabel">A customer checks in</span>
          <Switch label="Check-ins" />
        </div>
      </div>
    </PhoneShell>
  );
}
