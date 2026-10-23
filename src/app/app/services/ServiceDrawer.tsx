"use client";
/* Service editor drawer (480px, same chrome as the booking drawer):
   create / edit a service with zod-validated server action, incl.
   price, duration, deposit, payment policy, buffers, sort order,
   active switch and staff assignment (service_staff). */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/sl/Button";
import { saveService } from "../actions";
import { wholeDollars } from "../_lib/model";
import { IconClose, Toggle, useDrawerTrap } from "../ui";
import type { ServiceView } from "./ServicesClient";

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}
function toCents(value: string): number {
  const n = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function ServiceDrawer({
  service,
  staff,
  defaultSortOrder,
  onClose,
}: {
  service: ServiceView | null; // null = create
  staff: { id: string; name: string; isActive: boolean }[];
  defaultSortOrder: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useDrawerTrap<HTMLElement>(onClose);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [duration, setDuration] = useState(String(service?.durationMinutes ?? 30));
  const [price, setPrice] = useState(dollars(service?.priceCents ?? 0));
  const [deposit, setDeposit] = useState(dollars(service?.depositCents ?? 0));
  const [policy, setPolicy] = useState<"none" | "deposit" | "full">(service?.paymentPolicy ?? "none");
  const [bufferBefore, setBufferBefore] = useState(String(service?.bufferBeforeMinutes ?? 0));
  const [bufferAfter, setBufferAfter] = useState(String(service?.bufferAfterMinutes ?? 0));
  const [sortOrder, setSortOrder] = useState(String(service?.sortOrder ?? defaultSortOrder));
  const [isActive, setIsActive] = useState(service?.isActive ?? true);
  const [staffIds, setStaffIds] = useState<string[]>(service?.staffIds ?? []);

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await saveService({
        ...(service ? { id: service.id } : {}),
        name,
        description,
        durationMinutes: Number(duration),
        priceCents: toCents(price),
        depositCents: policy === "none" ? 0 : toCents(deposit),
        paymentPolicy: policy,
        bufferBeforeMinutes: Number(bufferBefore) || 0,
        bufferAfterMinutes: Number(bufferAfter) || 0,
        sortOrder: Number(sortOrder) || 0,
        isActive,
        staffIds,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <>
      <div className="sl-d-scrim" onClick={onClose} aria-hidden="true" />
      <aside ref={ref} className="sl-d-drawer" role="dialog" aria-modal="true" aria-labelledby="sl-svc-name" tabIndex={-1}>
        <div className="sl-d-drawer__head">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="sl-d-drawer__code">{service ? "Edit service" : "New service"}</span>
            <button type="button" className="sl-d-drawer__close" aria-label="Close" onClick={onClose}>
              <IconClose />
            </button>
          </div>
          <h2 id="sl-svc-name" className="sl-d-drawer__name" style={{ marginTop: 10 }}>
            {service ? service.name : "Add a service"}
          </h2>
          <p style={{ margin: "14px 0 0", fontSize: 15, color: "#e6d9d1" }}>
            {service ? `Currently ${wholeDollars(service.priceCents)} · ${service.durationMinutes} min` : "It appears on your booking page as soon as it is active."}
          </p>
        </div>

        <div className="sl-d-drawer__body">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="sl-d-field">
              <label htmlFor="svc-name">Name</label>
              <input id="svc-name" className="sl-d-inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="Haircut" />
            </div>
            <div className="sl-d-field">
              <label htmlFor="svc-desc">Description</label>
              <textarea id="svc-desc" className="sl-d-inp" style={{ minHeight: 64, resize: "vertical" }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What the customer gets" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="sl-d-field">
                <label htmlFor="svc-dur">Length (minutes)</label>
                <input id="svc-dur" className="sl-d-inp" type="number" min={5} max={480} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} />
              </div>
              <div className="sl-d-field">
                <label htmlFor="svc-price">Price ($)</label>
                <input id="svc-price" className="sl-d-inp" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div className="sl-d-field">
                <label htmlFor="svc-policy">Payment</label>
                <select id="svc-policy" className="sl-d-sel sl-d-sel--f" value={policy} onChange={(e) => setPolicy(e.target.value as typeof policy)}>
                  <option value="none">Pay at the visit</option>
                  <option value="deposit">Deposit up front</option>
                  <option value="full">Full price up front</option>
                </select>
              </div>
              <div className="sl-d-field">
                <label htmlFor="svc-dep">Deposit ($)</label>
                <input id="svc-dep" className="sl-d-inp" inputMode="decimal" value={deposit} disabled={policy === "none"} onChange={(e) => setDeposit(e.target.value)} />
              </div>
              <div className="sl-d-field">
                <label htmlFor="svc-bb">Buffer before (min)</label>
                <input id="svc-bb" className="sl-d-inp" type="number" min={0} max={240} value={bufferBefore} onChange={(e) => setBufferBefore(e.target.value)} />
              </div>
              <div className="sl-d-field">
                <label htmlFor="svc-ba">Buffer after (min)</label>
                <input id="svc-ba" className="sl-d-inp" type="number" min={0} max={240} value={bufferAfter} onChange={(e) => setBufferAfter(e.target.value)} />
              </div>
              <div className="sl-d-field">
                <label htmlFor="svc-sort">Order on booking page</label>
                <input id="svc-sort" className="sl-d-inp" type="number" min={0} max={999} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
              </div>
              <div className="sl-d-field">
                <label>Bookable online</label>
                <span style={{ display: "flex", alignItems: "center", height: 44 }}>
                  <Toggle checked={isActive} label="Bookable online" onChange={setIsActive} />
                </span>
              </div>
            </div>

            <div className="sl-d-field">
              <label>Who offers it</label>
              <div className="sl-d-opts">
                {staff.map((s) => {
                  const on = staffIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className="sl-d-opt"
                      aria-pressed={on}
                      onClick={() => setStaffIds((list) => (on ? list.filter((x) => x !== s.id) : [...list, s.id]))}
                    >
                      <span className={`sl-d-mono${s.isActive ? "" : " sl-d-mono--off"}`} aria-hidden="true">{s.name.charAt(0)}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ display: "block", fontSize: 15 }}>{s.name}</b>
                        <span className="sl-d-sub">{s.isActive ? (on ? "Offers this service" : "Not assigned") : "Inactive"}</span>
                      </span>
                    </button>
                  );
                })}
                {staff.length === 0 ? (
                  <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>No staff yet — invite staff first, then assign them here.</p>
                ) : null}
              </div>
            </div>
            {error ? <p style={{ fontSize: 14, color: "var(--danger, #b3261e)", margin: 0 }}>{error}</p> : null}
          </div>
        </div>

        <div className="sl-d-drawer__foot">
          <Button size="dashboard" onClick={onClose}>Cancel</Button>
          <Button size="dashPrimary" variant="primary" disabled={pending || name.trim() === ""} onClick={save}>
            {service ? "Save service" : "Add service"}
          </Button>
        </div>
      </aside>
    </>
  );
}
