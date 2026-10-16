"use client";
/* D-09 Settings — sub-menu (Business current) with the Business,
   Deposits & refunds, and Reminders sections exactly as drawn. */
import { useState } from "react";
import { Button } from "@/components/sl/Button";
import { business } from "@/lib/api";
import { Toggle } from "../ui";

const SECTIONS = ["Business", "Booking page", "Deposits & refunds", "Reminders", "Payouts", "Permissions", "Plan"] as const;

export default function SettingsPage() {
  const [refundOnTime, setRefundOnTime] = useState(true);
  const [keepNoShow, setKeepNoShow] = useState(true);
  const [lateMove, setLateMove] = useState(false);
  const [textReminder, setTextReminder] = useState(true);
  const [emailConfirm, setEmailConfirm] = useState(true);

  return (
    <>
      <div className="sl-d-hd">
        <div>
          <h1 className="sl-d-h1">Settings</h1>
          <p className="sl-d-meta">{business.name}</p>
        </div>
        <div className="sl-d-acts">
          <Button variant="primary" size="dashPrimary">Save changes</Button>
        </div>
      </div>

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
                <input id="bn" className="sl-d-inp" defaultValue={business.name} />
              </div>
              <div className="sl-d-field">
                <label htmlFor="bp">Phone</label>
                <input id="bp" className="sl-d-inp" defaultValue={business.phone} />
              </div>
              <div className="sl-d-field" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="ba">Address</label>
                <input id="ba" className="sl-d-inp" defaultValue={business.address.full} />
              </div>
              <div className="sl-d-field">
                <label htmlFor="tz">Time zone</label>
                <select id="tz" className="sl-d-sel sl-d-sel--f" defaultValue={business.timezoneLabel}>
                  <option>{business.timezoneLabel}</option>
                </select>
              </div>
              <div className="sl-d-field">
                <label htmlFor="bu">Booking page address</label>
                <input id="bu" className="sl-d-inp" defaultValue={business.bookingUrl} />
              </div>
            </div>
          </section>

          <section className="sl-d-card" style={{ padding: 28 }} aria-labelledby="set-deposits">
            <h2 id="set-deposits" style={{ margin: "0 0 6px", font: "600 28px/1.15 var(--font-display)", letterSpacing: "-.02em" }}>Deposits &amp; refunds</h2>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--ink-2)" }}>
              Customers see this on every booking step and in their confirmation.
            </p>
            <div className="sl-d-form-grid">
              <div className="sl-d-field">
                <label htmlFor="da">Deposit per booking</label>
                <input id="da" className="sl-d-inp" defaultValue="$20.00" />
              </div>
              <div className="sl-d-field">
                <label htmlFor="cw">Free cancellation until</label>
                <select id="cw" className="sl-d-sel sl-d-sel--f" defaultValue="24 hours before">
                  <option>24 hours before</option>
                </select>
              </div>
            </div>
            <ul className="sl-d-list" style={{ marginTop: 20 }}>
              <li>
                <span style={{ fontSize: 15 }}>
                  Refund the deposit when a customer cancels in time
                  <span className="sl-d-sub">Back to their card automatically</span>
                </span>
                <Toggle checked={refundOnTime} label="Refund on time cancellations" onChange={setRefundOnTime} />
              </li>
              <li>
                <span style={{ fontSize: 15 }}>Keep the deposit on a no-show</span>
                <Toggle checked={keepNoShow} label="Keep deposit on no-show" onChange={setKeepNoShow} />
              </li>
              <li>
                <span style={{ fontSize: 15 }}>Let customers move a booking once without losing the deposit, even late</span>
                <Toggle checked={lateMove} label="Allow one late move" onChange={setLateMove} />
              </li>
            </ul>
          </section>

          <section className="sl-d-card" style={{ padding: 28 }} aria-labelledby="set-reminders">
            <h2 id="set-reminders" style={{ margin: "0 0 14px", font: "600 28px/1.15 var(--font-display)", letterSpacing: "-.02em" }}>Reminders</h2>
            <ul className="sl-d-list">
              <li>
                <span style={{ fontSize: 15 }}>
                  Text reminder
                  <span className="sl-d-sub">24 hours before · customers can turn it off</span>
                </span>
                <Toggle checked={textReminder} label="Text reminder" onChange={setTextReminder} />
              </li>
              <li>
                <span style={{ fontSize: 15 }}>Email confirmation with change link</span>
                <Toggle checked={emailConfirm} label="Email confirmation" onChange={setEmailConfirm} />
              </li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
