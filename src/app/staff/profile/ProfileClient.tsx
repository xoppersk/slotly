"use client";
/* S-03 profile form: name / title / bio / phone + notification flags
   save to the member's own staff row. The services switches are drawn
   but READ-ONLY — service_staff writes are owner-only in PostgreSQL
   Row Level Security, so a staff member cannot change their own
   assignments; the owner does it in Services. The fixture's
   "A customer checks in" switch is gone: there is no check-in state
   and no column for it (PROD-W4.md). */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PhoneShell } from "@/components/sl/shells/PhoneShell";
import { Button, ButtonLink } from "@/components/sl/Button";
import { updateOwnProfile } from "../actions";

function Switch({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="sl-tog"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
    />
  );
}

export function ProfileClient({
  slug,
  email,
  staff,
  services,
}: {
  slug: string;
  email: string;
  staff: {
    name: string;
    title: string;
    bio: string;
    phone: string;
    notifyNewBooking: boolean;
    notifyCancellation: boolean;
  };
  services: { id: string; name: string; offered: boolean }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState(staff.name);
  const [title, setTitle] = useState(staff.title);
  const [bio, setBio] = useState(staff.bio);
  const [phone, setPhone] = useState(staff.phone);
  const [notifyNew, setNotifyNew] = useState(staff.notifyNewBooking);
  const [notifyCancel, setNotifyCancel] = useState(staff.notifyCancellation);
  const offeredCount = services.filter((s) => s.offered).length;

  const save = () => {
    setNotice(null);
    startTransition(async () => {
      const res = await updateOwnProfile({
        name,
        title,
        bio,
        phone,
        notifyNewBooking: notifyNew,
        notifyCancellation: notifyCancel,
      });
      if (!res.ok) {
        setNotice(res.error);
        return;
      }
      setNotice("Saved.");
      router.refresh();
    });
  };

  return (
    <PhoneShell
      current="profile"
      header={<span className="sl-staff-hdtitle">Profile</span>}
      headerAction={
        <ButtonLink href={`/b/${slug}`} size="sm">
          Preview
        </ButtonLink>
      }
    >
      <div className="sl-staff-idrow">
        <span className="sl-staff-photo" aria-hidden="true">{name.charAt(0) || "?"}</span>
        <div>
          <h1 className="sl-staff-name">{name}</h1>
          <p className="sl-staff-sub">
            {title || "Staff"} · {email}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="sl-staff-field">
          <label htmlFor="pf-name">Name customers see</label>
          <input id="pf-name" className="sl-staff-inp" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="sl-staff-field">
          <label htmlFor="pf-title">Title</label>
          <input id="pf-title" className="sl-staff-inp" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Barber" />
        </div>
        <div className="sl-staff-field">
          <label htmlFor="pf-phone">Phone</label>
          <input id="pf-phone" className="sl-staff-inp" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="sl-staff-field sl-staff-bio">
          <label htmlFor="bio">What customers see</label>
          <textarea id="bio" className="sl-staff-inp" value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
      </div>

      <p className="sl-staff-lbl">
        Services I offer · {offeredCount} of {services.length}
      </p>
      <div className="sl-card" style={{ overflow: "hidden" }}>
        {services.map((s) => (
          <div key={s.id} className="sl-agenda-row">
            <span className="sl-staff-rowlabel sl-staff-rowlabel--svc">{s.name}</span>
            <Switch label={`I offer ${s.name}`} checked={s.offered} disabled />
          </div>
        ))}
        {services.length === 0 ? (
          <div className="sl-agenda-row">
            <span style={{ fontSize: 14, color: "var(--muted)" }}>No services yet.</span>
          </div>
        ) : null}
      </div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
        Your owner manages service assignments in Services.
      </p>

      <p className="sl-staff-lbl">Tell me when</p>
      <div className="sl-card" style={{ overflow: "hidden" }}>
        <div className="sl-agenda-row">
          <span className="sl-staff-rowlabel">Someone books me</span>
          <Switch label="New bookings" checked={notifyNew} onChange={setNotifyNew} />
        </div>
        <div className="sl-agenda-row">
          <span className="sl-staff-rowlabel">A booking is cancelled</span>
          <Switch label="Cancellations" checked={notifyCancel} onChange={setNotifyCancel} />
        </div>
      </div>

      <Button
        type="button"
        variant="primary"
        disabled={pending}
        onClick={save}
        style={{ marginTop: 18, width: "100%" }}
      >
        Save profile
      </Button>
      {notice ? (
        <p style={{ fontSize: 14, marginTop: 10, color: notice === "Saved." ? "var(--open-ink)" : "var(--danger, #b3261e)" }}>{notice}</p>
      ) : null}
    </PhoneShell>
  );
}
