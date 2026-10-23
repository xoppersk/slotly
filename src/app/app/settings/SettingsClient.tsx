"use client";
/* Settings form — one form over the real businesses columns, saved via
   the updateBusinessSettings server action (owner-gated; the update
   policy itself allows members, app layer restricts per migration
   00013). The booking-page address (slug) is shown read-only: renaming
   it would break every shared booking link. */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/sl/Button";
import { updateBusinessSettings } from "../actions";
import { wholeDollars } from "../_lib/model";
import { Toggle } from "../ui";

const SECTIONS = ["Business", "Booking page", "Deposits & refunds", "Reminders", "Payouts", "Permissions", "Plan"] as const;

export interface SettingsBusiness {
  name: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  timezone: string;
  slug: string;
  minLeadTimeMinutes: number;
  maxAdvanceDays: number;
  slotStepMinutes: number;
  freeCancelHours: number;
  reminder24hEnabled: boolean;
  reminder2hEnabled: boolean;
}

export function SettingsClient({
  business,
  plans,
  plansArePlaceholder,
  canEdit,
}: {
  business: SettingsBusiness;
  plans: { id: string; name: string; monthlyPriceCents: number; blurb: string }[];
  // Config-driven pricing (src/lib/config.ts PLANS) — placeholder-flagged
  // there via PLANS_ARE_PLACEHOLDER until Sheku rules real prices.
  plansArePlaceholder: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState(business.name);
  const [description, setDescription] = useState(business.description);
  const [phone, setPhone] = useState(business.phone);
  const [email, setEmail] = useState(business.email);
  const [address, setAddress] = useState(business.address);
  const [timezone, setTimezone] = useState(business.timezone);
  const [minLead, setMinLead] = useState(String(business.minLeadTimeMinutes));
  const [maxAdvance, setMaxAdvance] = useState(String(business.maxAdvanceDays));
  const [slotStep, setSlotStep] = useState(String(business.slotStepMinutes));
  const [freeCancel, setFreeCancel] = useState(String(business.freeCancelHours));
  const [reminder24, setReminder24] = useState(business.reminder24hEnabled);
  const [reminder2, setReminder2] = useState(business.reminder2hEnabled);

  const timezones = (() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [business.timezone];
    }
  })();

  const save = () => {
    setNotice(null);
    startTransition(async () => {
      const res = await updateBusinessSettings({
        name,
        description,
        phone,
        email,
        address,
        timezone,
        minLeadTimeMinutes: Number(minLead) || 0,
        maxAdvanceDays: Number(maxAdvance) || 60,
        slotStepMinutes: Number(slotStep) || 15,
        freeCancelHours: Number(freeCancel) || 0,
        reminder24hEnabled: reminder24,
        reminder2hEnabled: reminder2,
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
    <>
      <div className="sl-d-hd">
        <div>
          <h1 className="sl-d-h1">Settings</h1>
          <p className="sl-d-meta">{business.name}</p>
        </div>
        <div className="sl-d-acts">
          {canEdit ? (
            <Button variant="primary" size="dashPrimary" disabled={pending} onClick={save}>
              Save changes
            </Button>
          ) : null}
        </div>
      </div>
      {notice ? (
        <p style={{ fontSize: 14, margin: "0 0 14px", color: notice === "Saved." ? "var(--open-ink)" : "var(--danger, #b3261e)" }}>{notice}</p>
      ) : null}
      {!canEdit ? (
        <p style={{ fontSize: 14, margin: "0 0 14px", color: "var(--muted)" }}>Only the business owner can change settings.</p>
      ) : null}

      <div className="sl-d-settings-grid">
        <nav aria-label="Settings sections" className="sl-d-card sl-d-settings-nav">
          {SECTIONS.map((s) => (
            <a key={s} href="#" onClick={(e) => e.preventDefault()} aria-current={s === "Business" ? "page" : undefined}>
              {s}
            </a>
          ))}
        </nav>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section className="sl-d-card" style={{ padding: 28 }} aria-labelledby="set-business">
            <h2 id="set-business" style={{ margin: "0 0 20px", font: "600 28px/1.15 var(--font-display)", letterSpacing: "-.02em" }}>Business</h2>
            <div className="sl-d-form-grid">
              <div className="sl-d-field">
                <label htmlFor="bn">Name</label>
                <input id="bn" className="sl-d-inp" value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="sl-d-field">
                <label htmlFor="bp">Phone</label>
                <input id="bp" className="sl-d-inp" value={phone} disabled={!canEdit} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="sl-d-field">
                <label htmlFor="be">Email</label>
                <input id="be" className="sl-d-inp" type="email" value={email} disabled={!canEdit} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="sl-d-field">
                <label htmlFor="tz">Time zone</label>
                <select id="tz" className="sl-d-sel sl-d-sel--f" value={timezone} disabled={!canEdit} onChange={(e) => setTimezone(e.target.value)}>
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div className="sl-d-field" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="ba">Address</label>
                <input id="ba" className="sl-d-inp" value={address} disabled={!canEdit} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="sl-d-field" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="bd">Description</label>
                <textarea id="bd" className="sl-d-inp" style={{ minHeight: 72, resize: "vertical" }} value={description} disabled={!canEdit} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="sl-d-field">
                <label htmlFor="bu">Booking page address</label>
                <input id="bu" className="sl-d-inp" value={`/b/${business.slug}`} readOnly aria-readonly="true" />
              </div>
            </div>
          </section>

          <section className="sl-d-card" style={{ padding: 28 }} aria-labelledby="set-policies">
            <h2 id="set-policies" style={{ margin: "0 0 6px", font: "600 28px/1.15 var(--font-display)", letterSpacing: "-.02em" }}>Booking policies</h2>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--ink-2)" }}>
              The same rules edited in Availability — they are one set of numbers on your business.
            </p>
            <div className="sl-d-form-grid">
              <div className="sl-d-field">
                <label htmlFor="ml">Shortest notice (minutes)</label>
                <input id="ml" className="sl-d-inp" type="number" min={0} value={minLead} disabled={!canEdit} onChange={(e) => setMinLead(e.target.value)} />
              </div>
              <div className="sl-d-field">
                <label htmlFor="ma">Furthest ahead (days)</label>
                <input id="ma" className="sl-d-inp" type="number" min={1} max={365} value={maxAdvance} disabled={!canEdit} onChange={(e) => setMaxAdvance(e.target.value)} />
              </div>
              <div className="sl-d-field">
                <label htmlFor="ss">Start times every</label>
                <select id="ss" className="sl-d-sel sl-d-sel--f" value={slotStep} disabled={!canEdit} onChange={(e) => setSlotStep(e.target.value)}>
                  {[5, 10, 15, 20, 30, 60].map((n) => (
                    <option key={n} value={n}>{n} minutes</option>
                  ))}
                </select>
              </div>
              <div className="sl-d-field">
                <label htmlFor="fc">Free cancellation until (hours before)</label>
                <input id="fc" className="sl-d-inp" type="number" min={0} value={freeCancel} disabled={!canEdit} onChange={(e) => setFreeCancel(e.target.value)} />
              </div>
            </div>
            <p style={{ margin: "16px 0 0", fontSize: 13, color: "var(--muted)" }}>
              Deposits are set per service in Services; there is no shop-wide deposit amount.
            </p>
          </section>

          <section className="sl-d-card" style={{ padding: 28 }} aria-labelledby="set-reminders">
            <h2 id="set-reminders" style={{ margin: "0 0 14px", font: "600 28px/1.15 var(--font-display)", letterSpacing: "-.02em" }}>Reminders</h2>
            <ul className="sl-d-list">
              <li>
                <span style={{ fontSize: 15 }}>
                  Reminder 24 hours before
                  <span className="sl-d-sub">Sent on the channel set for this business</span>
                </span>
                <Toggle checked={reminder24} label="Reminder 24 hours before" onChange={canEdit ? setReminder24 : undefined} />
              </li>
              <li>
                <span style={{ fontSize: 15 }}>Reminder 2 hours before</span>
                <Toggle checked={reminder2} label="Reminder 2 hours before" onChange={canEdit ? setReminder2 : undefined} />
              </li>
            </ul>
          </section>

          <section className="sl-d-card" style={{ padding: 28 }} aria-labelledby="set-plan">
            <h2 id="set-plan" style={{ margin: "0 0 6px", font: "600 28px/1.15 var(--font-display)", letterSpacing: "-.02em" }}>Plan</h2>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--ink-2)" }}>
              {plansArePlaceholder
                ? "Prices are placeholders while plans are being finalised — billing is not switched on yet."
                : "Billing is handled outside Slotly for now."}
            </p>
            <ul className="sl-d-list">
              {plans.map((p) => (
                <li key={p.id}>
                  <span style={{ fontSize: 15 }}>
                    <b style={{ fontWeight: 600 }}>{p.name}</b>
                    <span className="sl-d-sub">{p.blurb}</span>
                  </span>
                  <b style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>
                    {p.monthlyPriceCents === 0 ? "$0" : `${wholeDollars(p.monthlyPriceCents)}/mo`}
                  </b>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
