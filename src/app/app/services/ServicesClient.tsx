"use client";
/* D-05 Services — the drawn table with real rows; the Online switch is
   the service's is_active flag (the public page reads services_public,
   which only exposes active services); name opens the editor drawer.
   The drawn shop-wide deposit card is now honest: deposits are set per
   service in the database, so the card summarises the real range and
   points at the editor. Drag-to-reorder was never functional in the
   fixture (grip only) — order is the numeric field in the editor. */
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/sl/Button";
import { IconPlus } from "@/components/sl/icons";
import { setServiceActive } from "../actions";
import { wholeDollars } from "../_lib/model";
import { IconArrowRight14, IconGrip, Toggle } from "../ui";
import { ServiceDrawer } from "./ServiceDrawer";

export interface ServiceView {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
  depositCents: number;
  paymentPolicy: "none" | "deposit" | "full";
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  sortOrder: number;
  isActive: boolean;
  staffIds: string[];
}

export function ServicesClient({
  services,
  staff,
  slug,
  bookingPageEnabled,
  canEdit,
}: {
  services: ServiceView[];
  staff: { id: string; name: string; isActive: boolean }[];
  slug: string;
  bookingPageEnabled: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<ServiceView | "new" | null>(null);
  const staffName = (id: string) => staff.find((s) => s.id === id)?.name ?? "";
  const offeredBy = (ids: string[]) => ids.map(staffName).filter(Boolean).join(", ") || "Nobody yet";
  const active = services.filter((s) => s.isActive);
  const deposits = services.filter((s) => s.depositCents > 0).map((s) => s.depositCents);
  const depositLine =
    deposits.length === 0
      ? "No service takes a deposit right now."
      : deposits.length === 1
        ? `One service takes a ${wholeDollars(deposits[0]!)} deposit.`
        : `Deposits run from ${wholeDollars(Math.min(...deposits))} to ${wholeDollars(Math.max(...deposits))} depending on the service.`;

  const toggle = (s: ServiceView, next: boolean) => {
    startTransition(async () => {
      await setServiceActive(s.id, next);
      router.refresh();
    });
  };

  return (
    <>
      <div className="sl-d-hd">
        <div>
          <h1 className="sl-d-h1">Services</h1>
          <p className="sl-d-meta">
            {services.length} service{services.length === 1 ? "" : "s"} · {active.length} bookable online
            {bookingPageEnabled ? "" : " · booking page is off"}
          </p>
        </div>
        <div className="sl-d-acts">
          {canEdit ? (
            <Button variant="primary" size="dashPrimary" onClick={() => setEditing("new")}>
              <IconPlus />Add service
            </Button>
          ) : null}
        </div>
      </div>

      <div className="sl-d-card sl-d-scroll">
        <table className="sl-d-tbl" style={{ minWidth: 760 }}>
          <thead>
            <tr><th>Service</th><th>Length</th><th className="r">Price</th><th className="r">Deposit</th><th>Who offers it</th><th>Buffer after</th><th>Online</th></tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} className={s.isActive ? undefined : "sl-d-past"}>
                <td>
                  <span className="sl-d-who">
                    <span className="sl-d-grip" aria-hidden="true"><IconGrip /></span>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => setEditing(s)}
                        style={{ fontFamily: "var(--font-display)", fontSize: 18, letterSpacing: "-.02em", background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--ink)", textAlign: "left" }}
                      >
                        {s.name}
                      </button>
                    ) : (
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 18, letterSpacing: "-.02em" }}>{s.name}</span>
                    )}
                  </span>
                </td>
                <td>{s.durationMinutes} min</td>
                <td className="r" style={{ fontWeight: 600, fontSize: 15 }}>{wholeDollars(s.priceCents)}</td>
                <td className="r">{s.depositCents > 0 ? wholeDollars(s.depositCents) : "—"}</td>
                <td>{offeredBy(s.staffIds)}</td>
                <td>{s.bufferAfterMinutes > 0 ? `${s.bufferAfterMinutes} min` : "None"}</td>
                <td>
                  <Toggle
                    checked={s.isActive}
                    label={`Bookable online: ${s.name}`}
                    onChange={canEdit ? (next) => toggle(s, next) : undefined}
                  />
                </td>
              </tr>
            ))}
            {services.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: "28px 20px", color: "var(--muted)" }}>No services yet. Add your first service to start taking bookings.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 20, marginTop: 24 }} className="sl-d-two-col">
        <section className="sl-d-ink" style={{ padding: 28 }}>
          <h2 style={{ margin: 0, font: "600 28px/1.15 var(--font-display)", letterSpacing: "-.02em" }}>Deposits</h2>
          <p style={{ margin: "6px 0 20px", fontSize: 14, color: "#cdb8ae" }}>
            Set per service, not shop-wide — open a service to change its deposit. {depositLine}
          </p>
          <p style={{ margin: 0, fontSize: 14 }}>
            <Link href="/app/settings" style={{ fontWeight: 600, color: "#f2c9c2" }}>
              Cancellation rules in Settings
            </Link>
          </p>
        </section>
        <section className="sl-d-card" style={{ padding: 28 }}>
          <h2 style={{ margin: 0, font: "600 28px/1.15 var(--font-display)", letterSpacing: "-.02em" }}>Order on the booking page</h2>
          <p style={{ margin: "6px 0 20px", fontSize: 14, color: "var(--ink-2)" }}>
            Customers see services in the order set in each service’s editor.
          </p>
          <ButtonLink href={`/b/${slug}`} size="dashboard">
            Preview booking page<IconArrowRight14 />
          </ButtonLink>
        </section>
      </div>

      {editing !== null && canEdit ? (
        <ServiceDrawer
          service={editing === "new" ? null : editing}
          staff={staff}
          defaultSortOrder={services.length}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
