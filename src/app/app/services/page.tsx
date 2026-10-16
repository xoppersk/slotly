"use client";
/* D-05 Services — the 5-service table with online switches
   (role="switch" with labels), the dark deposit card, and the
   booking-page order card. */
import { useState } from "react";
import Link from "next/link";
import { ButtonLink } from "@/components/sl/Button";
import { IconPlus } from "@/components/sl/icons";
import { formatWholeDollars, getBarbers, getServices } from "@/lib/api";
import { IconArrowRight14, IconGrip, Toggle } from "../ui";

export default function ServicesPage() {
  const services = getServices();
  const barbers = getBarbers();
  const [online, setOnline] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(services.map((s) => [s.id, s.online])),
  );
  const offeredBy = (ids: string[]) =>
    ids.map((id) => barbers.find((b) => b.id === id)?.name ?? id).join(", ");

  return (
    <>
      <div className="sl-d-hd">
        <div>
          <h1 className="sl-d-h1">Services</h1>
          <p className="sl-d-meta">5 services · all bookable online</p>
        </div>
        <div className="sl-d-acts">
          <ButtonLink href="#" variant="primary" size="dashPrimary"><IconPlus />Add service</ButtonLink>
        </div>
      </div>

      <div className="sl-d-card sl-d-scroll">
        <table className="sl-d-tbl" style={{ minWidth: 760 }}>
          <thead>
            <tr><th>Service</th><th>Length</th><th className="r">Price</th><th className="r">Deposit</th><th>Who offers it</th><th>Buffer after</th><th>Online</th></tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td>
                  <span className="sl-d-who">
                    <span className="sl-d-grip" aria-hidden="true"><IconGrip /></span>
                    <a href="#" onClick={(e) => e.preventDefault()} style={{ fontFamily: "var(--font-display)", fontSize: 18, letterSpacing: "-.02em" }}>
                      {s.name}
                    </a>
                  </span>
                </td>
                <td>{s.durationMinutes} min</td>
                <td className="r" style={{ fontWeight: 600, fontSize: 15 }}>{formatWholeDollars(s.priceCents)}</td>
                <td className="r">{formatWholeDollars(s.depositCents)}</td>
                <td>{offeredBy(s.offeredBy)}</td>
                <td>{s.bufferAfterMinutes > 0 ? `${s.bufferAfterMinutes} min` : "None"}</td>
                <td>
                  <Toggle
                    checked={online[s.id] ?? s.online}
                    label={`Bookable online: ${s.name}`}
                    onChange={(next) => setOnline((m) => ({ ...m, [s.id]: next }))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 20, marginTop: 24 }} className="sl-d-two-col">
        <section className="sl-d-ink" style={{ padding: 28 }}>
          <h2 style={{ margin: 0, font: "600 28px/1.15 var(--font-display)", letterSpacing: "-.02em" }}>Deposit</h2>
          <p style={{ margin: "6px 0 20px", fontSize: 14, color: "#cdb8ae" }}>Same for every service. Comes off the bill at the shop.</p>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
            <div className="sl-d-field" style={{ width: 160 }}>
              <label htmlFor="dep" style={{ color: "#e6d9d1" }}>Amount</label>
              <input
                id="dep"
                className="sl-d-inp"
                defaultValue="$20.00"
                style={{ font: "600 18px/1 var(--font-sans)", boxShadow: "none", background: "var(--linen)" }}
              />
            </div>
            <Link href="/app/settings" style={{ fontSize: 14, fontWeight: 600, paddingBottom: 14, color: "#f2c9c2" }}>
              Refund rules in Settings
            </Link>
          </div>
        </section>
        <section className="sl-d-card" style={{ padding: 28 }}>
          <h2 style={{ margin: 0, font: "600 28px/1.15 var(--font-display)", letterSpacing: "-.02em" }}>Order on the booking page</h2>
          <p style={{ margin: "6px 0 20px", fontSize: 14, color: "var(--ink-2)" }}>
            Customers see services in this order. Drag rows in the table to change it.
          </p>
          <ButtonLink href="/b/harbor-and-pine/book/service" size="dashboard">
            Preview booking page<IconArrowRight14 />
          </ButtonLink>
        </section>
      </div>
    </>
  );
}
