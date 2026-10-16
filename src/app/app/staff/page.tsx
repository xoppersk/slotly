/* D-06 Staff — three barber cards, the owner row, the pending invite,
   and the dark permissions summary. */
import Link from "next/link";
import { ButtonLink } from "@/components/sl/Button";
import { StatusPill } from "@/components/sl/StatusPill";
import { IconPlus } from "@/components/sl/icons";
import { getBarbers, getOwner, people } from "@/lib/api";
import { IconArrowRight14 } from "../ui";

function servicesLabel(ids: string[]): string {
  if (ids.length >= 5) return "All 5";
  return `${ids.length} · no skin fades`;
}

export default function StaffPage() {
  const barbers = getBarbers();
  const owner = getOwner();
  const invite = people.pendingInvites[0];

  return (
    <>
      <div className="sl-d-hd">
        <div>
          <h1 className="sl-d-h1">Staff</h1>
          <p className="sl-d-meta">3 barbers · 1 invite pending</p>
        </div>
        <div className="sl-d-acts">
          <ButtonLink href="#" variant="primary" size="dashPrimary"><IconPlus />Invite a barber</ButtonLink>
        </div>
      </div>

      <div className="sl-d-staff-grid">
        {barbers.map((b) => {
          const away = b.status === "Away";
          return (
            <article key={b.id} className="sl-d-card sl-d-staff-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span className={`sl-d-mono${away ? " sl-d-mono--off" : ""}`} aria-hidden="true">{b.initial}</span>
                {away ? (
                  <StatusPill status="Away" label={b.away?.label} />
                ) : (
                  <StatusPill status="Working" />
                )}
              </div>
              <div>
                <a href="#" className="sl-d-staff-name">{b.name}</a>
                <span className="sl-d-sub" style={{ marginTop: 6 }}>{b.roleLabel}</span>
              </div>
              <dl className="sl-d-dl2">
                <div><dt>Services</dt><dd>{servicesLabel(b.serviceIds)}</dd></div>
                <div><dt>Today</dt><dd>{b.todayBookings ? `${b.todayBookings} bookings` : "—"}</dd></div>
                <div>
                  <dt>Next opening</dt>
                  <dd style={{ color: away ? "var(--muted)" : "var(--open)" }}>{b.nextOpening ?? "—"}</dd>
                </div>
              </dl>
              <ButtonLink href={`/app/availability?tab=${b.id}`} size="sm" style={{ alignSelf: "flex-start", marginTop: "auto" }}>
                Hours<IconArrowRight14 />
              </ButtonLink>
            </article>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, marginTop: 16 }} className="sl-d-two-col">
        <div className="sl-d-card sl-d-staff-row">
          <span className="sl-d-mono" aria-hidden="true">{owner.initials}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <a href="#" style={{ fontWeight: 600, fontSize: 16, color: "var(--ink)", textDecoration: "none" }}>{owner.name}</a>
            <span className="sl-d-sub">{owner.roleLabel}</span>
            <span className="sl-d-sub" style={{ marginTop: 2, fontSize: 12 }}>Services — · Today — · Next opening —</span>
          </span>
          <StatusPill status="Not booked yet" label="Not bookable" />
        </div>
        {invite ? (
          <div
            className="sl-d-card sl-d-staff-row"
            style={{ background: "#fbf7f4", boxShadow: "inset 0 0 0 1px #e0d0c6" }}
          >
            <span className="sl-d-invite-avatar" aria-hidden="true">{invite.initial}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{invite.email}</span>
              <span className="sl-d-sub">{invite.roleLabel} · {invite.sentLabel}</span>
              <span className="sl-d-sub" style={{ marginTop: 2, fontSize: 12 }}>Services — · Today — · Next opening —</span>
            </span>
            <StatusPill status="Invite sent" />
            <a href="#" style={{ fontWeight: 600, fontSize: 14 }}>Resend</a>
          </div>
        ) : null}
      </div>

      <section className="sl-d-ink" style={{ padding: "28px 32px", marginTop: 24, display: "flex", justifyContent: "space-between", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, font: "600 28px/1.15 var(--font-display)", letterSpacing: "-.02em" }}>What barbers can do</h2>
          <p style={{ margin: "8px 0 0", fontSize: 15, color: "#cdb8ae", maxWidth: 640 }}>
            {people.permissionsSummary}
          </p>
        </div>
        <Link href="/app/settings" className="sl-btn sl-btn--linen" style={{ height: 52, padding: "0 24px", fontSize: 15, width: "auto" }}>
          Change permissions
        </Link>
      </section>
    </>
  );
}
