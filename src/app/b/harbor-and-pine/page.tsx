import Link from "next/link";
import { BookingShell } from "@/components/sl/shells/BookingShell";
import { ButtonLink } from "@/components/sl/Button";
import { StatusPill } from "@/components/sl/StatusPill";
import { business, formatCents, getBarbers, getServices } from "@/lib/api";

/** P-01 (BusinessHome.html) barber-card descriptor lines — these differ from
    the P-03 barber-step blurbs in people.json, which are not used here.
    Andre has no descriptor line on P-01. */
const P01_DESCRIPTORS: Record<string, string> = {
  micah: "All 5 services",
  nia: "4 services · no skin fades",
};

export default function BusinessHome() {
  const services = getServices(); const barbers = getBarbers();
  return (
    <BookingShell manageHref="/b/harbor-and-pine/manage/demo-token">
      <div className="sl-b-main">
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--oxblood)" }}>{business.area}</p>
        <h1 className="sl-b-hero" style={{ marginTop: 10 }}>{business.name}</h1>
        <p className="sl-b-hero-sub">{business.tagline}</p>
        <div className="sl-b-actions">
          <ButtonLink variant="primary" href="/b/harbor-and-pine/book/service">Book an appointment</ButtonLink>
          <ButtonLink href="/b/harbor-and-pine/manage/demo-token">Change a booking</ButtonLink>
        </div>
        <p style={{ marginTop: 16, fontSize: 14, color: "var(--muted)" }}>Next opening: today, 1:30 PM with Nia · Open 7 days</p>
        <div aria-label="Shop photo" style={{ marginTop: 28, height: 220, borderRadius: "var(--radius-xl)", background: "var(--sand)", display: "grid", placeItems: "center", color: "var(--muted)", boxShadow: "var(--shadow-ring)" }}>[Shop photo]</div>

        <h2 style={{ font: "600 28px/1.2 var(--font-display)", margin: "44px 0 6px" }}>Services</h2>
        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16 }}>$20 deposit holds any booking</p>
        <div className="sl-b-card" style={{ padding: "4px 24px" }}>
          {services.map((s) => (
            <div className="sl-b-rowline" key={s.id}>
              <div><div className="sl-b-svc-name">{s.name}</div><div className="sl-b-svc-meta">{s.description} {s.durationMinutes} min.</div></div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}><b style={{ font: "600 18px/1 var(--font-display)" }}>{formatCents(s.priceCents).replace(".00", "")}</b><ButtonLink variant="primary" size="dashboard" className="sl-b-bookbtn" href={`/b/harbor-and-pine/book/service?service=${s.id}`}>Book</ButtonLink></div>
            </div>
          ))}
        </div>

        <h2 style={{ font: "600 28px/1.2 var(--font-display)", margin: "44px 0 16px" }}>Barbers</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
          {barbers.map((b) => {
            const descriptor = P01_DESCRIPTORS[b.id];
            // people.json values are "Today, 3:45 PM" — P-01 draws
            // "Next: today, 3:45 PM": keep the time's original casing.
            const nextTime = b.nextOpeningToday?.replace(/^Today,?\s*/, "");
            return (
            <div className="sl-b-card" key={b.id}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}><span className="sl-b-opt__avatar">{b.initial}</span><div><b style={{ fontSize: 17 }}>{b.name}</b>{descriptor ? <div style={{ fontSize: 14, color: "var(--muted)" }}>{descriptor}</div> : null}</div></div>
              <p style={{ marginTop: 14, fontSize: 14 }}>{b.id === "andre" ? <StatusPill status="Away" label="Away" /> : <>Next: today, {nextTime}</>}</p>
              {b.id === "andre" ? <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 6 }}>Back Tuesday, October 20</p> : null}
            </div>
            );
          })}
        </div>

        <h2 style={{ font: "600 28px/1.2 var(--font-display)", margin: "44px 0 16px" }}>Visit</h2>
        <div className="sl-b-card">
          <div style={{ height: 160, borderRadius: "var(--radius-l)", background: "var(--sand)", display: "grid", placeItems: "center", color: "var(--muted)", marginBottom: 18 }}>[Map]</div>
          <p style={{ fontWeight: 600 }}>{business.address.street}<br />{business.address.city}, {business.address.state} {business.address.zip}</p>
          <p style={{ marginTop: 8 }}><Link href="#">Get directions</Link></p>
          <div style={{ marginTop: 16, fontSize: 15, lineHeight: 1.7 }}>
            <div>Monday – Friday&nbsp;&nbsp;9 AM – 6 PM</div><div>Saturday&nbsp;&nbsp;9 AM – 6 PM</div><div>Sunday&nbsp;&nbsp;10 AM – 3 PM</div>
          </div>
          <p style={{ marginTop: 16, color: "var(--ink-2)" }}>Free to cancel or move up to 24 hours before. Later than that, the $20 deposit is kept.</p>
          <p style={{ marginTop: 8, color: "var(--ink-2)" }}>Call {business.phone} if you&rsquo;re running late.</p>
        </div>
      </div>
    </BookingShell>
  );
}
