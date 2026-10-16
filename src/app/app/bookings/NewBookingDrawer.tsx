"use client";
/* Booking on someone's behalf (§10): the booking steps inside the
   drawer, starting with customer search. The deposit is skipped unless
   the owner turns it on. Confirming appends the booking to the shared
   dashboard state, so it appears on Today, Bookings and Calendar. */
import { useMemo, useState } from "react";
import { Button } from "@/components/sl/Button";
import { StatusPill } from "@/components/sl/StatusPill";
import { customers, formatWholeDollars, getBarbers, getServices } from "@/lib/api";
import type { Booking } from "@/lib/types";
import { useDashboard } from "../DashboardContext";
import { IconClose, IconSearch, Toggle, useDrawerTrap } from "../ui";

const TIMES = ["11:30 AM", "12:45 PM", "2:15 PM", "3:45 PM", "4:30 PM", "5:15 PM"];

function to24(label: string): string {
  const m = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(label);
  if (!m) return "12:00";
  let h = Number(m[1]) % 12;
  if (m[3] === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}
function endLabel(startLabel: string, minutes: number): { label: string; t24: string } {
  const t24 = to24(startLabel);
  const [h, m] = t24.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + minutes;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  const mer = eh >= 12 ? "PM" : "AM";
  const h12 = eh % 12 === 0 ? 12 : eh % 12;
  return { label: `${h12}:${String(em).padStart(2, "0")} ${mer}`, t24: `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}` };
}

const STEPS = ["Customer", "Service", "Barber", "Time", "Review"] as const;

export function NewBookingDrawer({ onClose }: { onClose: () => void }) {
  const { addBooking } = useDashboard();
  const ref = useDrawerTrap<HTMLElement>(onClose);
  const services = getServices();
  const barbers = getBarbers();

  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [serviceId, setServiceId] = useState(services[0]!.id);
  const [barberId, setBarberId] = useState("micah");
  const [time, setTime] = useState(TIMES[2]!);
  const [takeDeposit, setTakeDeposit] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }, [query]);

  const service = services.find((s) => s.id === serviceId) ?? services[0]!;
  const barber = barbers.find((b) => b.id === barberId) ?? barbers[0]!;
  const end = endLabel(time, service.durationMinutes);
  const canContinue =
    step === 0 ? customerName.trim().length > 1 : true;

  const confirm = () => {
    const booking: Booking = {
      id: `bk-new-${customerName.toLowerCase().replace(/[^a-z]+/g, "-")}`,
      code: "SLY-2026-1008-NEW",
      date: "2026-10-08",
      start: time,
      end: end.label,
      start24: to24(time),
      end24: end.t24,
      customer: customerName.trim(),
      customerEmail: customerEmail || `${customerName.trim().toLowerCase().replace(/[^a-z]+/g, ".")}@sevynlabs.io`,
      serviceId: service.id,
      service: service.name,
      priceCents: service.priceCents,
      barberId: barber.id,
      barber: barber.name,
      status: "Upcoming",
      depositCents: takeDeposit ? service.depositCents : 0,
      depositStatus: takeDeposit ? "paid" : "due",
      balanceCents: service.priceCents - (takeDeposit ? service.depositCents : 0),
      bookedAtLabel: "Booked at the shop by Sheku Thu, Oct 8 · 10:40 AM",
    };
    addBooking(booking);
    onClose();
  };

  return (
    <>
      <div className="sl-d-scrim" onClick={onClose} aria-hidden="true" />
      <aside ref={ref} className="sl-d-drawer" role="dialog" aria-modal="true" aria-labelledby="sl-d-new-name" tabIndex={-1}>
        <div className="sl-d-drawer__head">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="sl-d-drawer__code">Step {step + 1} of {STEPS.length} · {STEPS[step]}</span>
            <button type="button" className="sl-d-drawer__close" aria-label="Close" onClick={onClose}>
              <IconClose />
            </button>
          </div>
          <h2 id="sl-d-new-name" className="sl-d-drawer__name" style={{ marginTop: 10 }}>New booking</h2>
          <p style={{ margin: "14px 0 0", fontSize: 15, color: "#e6d9d1" }}>
            Book on a customer’s behalf. No deposit is taken unless you turn it on.
          </p>
        </div>

        <div className="sl-d-step">
          {step === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label className="sl-d-srch" style={{ maxWidth: "none", flex: "none" }}>
                <span className="sl-d-sr">Search customers</span>
                <IconSearch />
                <input
                  className="sl-d-inp"
                  placeholder="Search customers"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <div className="sl-d-opts">
                {matches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="sl-d-opt"
                    aria-pressed={customerName === c.name}
                    onClick={() => { setCustomerName(c.name); setCustomerEmail(c.email); }}
                  >
                    <span className="sl-d-mono" aria-hidden="true">{c.initials}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ display: "block", fontSize: 15 }}>{c.name}</b>
                      <span className="sl-d-sub">{c.email}</span>
                    </span>
                    {c.isNew ? <StatusPill status="Arrived" label="New" /> : null}
                  </button>
                ))}
              </div>
              <div className="sl-d-field">
                <label htmlFor="nb-name">Or a new customer</label>
                <input
                  id="nb-name"
                  className="sl-d-inp"
                  placeholder="Full name"
                  value={matches.some((c) => c.name === customerName) ? "" : customerName}
                  onChange={(e) => { setCustomerName(e.target.value); setCustomerEmail(""); }}
                />
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="sl-d-opts">
              {services.map((s) => (
                <button key={s.id} type="button" className="sl-d-opt" aria-pressed={serviceId === s.id} onClick={() => setServiceId(s.id)}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ display: "block", fontSize: 15 }}>{s.name}</b>
                    <span className="sl-d-sub">{s.durationMinutes} min</span>
                  </span>
                  <b>{formatWholeDollars(s.priceCents)}</b>
                </button>
              ))}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="sl-d-opts">
              {barbers.map((b) => {
                const away = b.status === "Away";
                return (
                  <button
                    key={b.id}
                    type="button"
                    className="sl-d-opt"
                    aria-pressed={barberId === b.id}
                    disabled={away || !b.serviceIds.includes(serviceId)}
                    style={away || !b.serviceIds.includes(serviceId) ? { opacity: 0.55, cursor: "default" } : undefined}
                    onClick={() => setBarberId(b.id)}
                  >
                    <span className={`sl-d-mono${away ? " sl-d-mono--off" : ""}`} aria-hidden="true">{b.initial}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ display: "block", fontSize: 15 }}>{b.name}</b>
                      <span className="sl-d-sub">{away ? b.away?.backLabel : `${b.serviceIds.length} services`}</span>
                    </span>
                    {away ? <StatusPill status="Away" label={b.away?.label} /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {step === 3 ? (
            <div>
              <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ink-2)" }}>
                Today with {barber.name} · {service.name}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {TIMES.map((t) => (
                  <button key={t} type="button" className="sl-d-opt" style={{ justifyContent: "center" }} aria-pressed={time === t} onClick={() => setTime(t)}>
                    <b style={{ fontSize: 15 }}>{t}</b>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="sl-d-card" style={{ padding: "8px 20px 10px" }}>
                <dl className="sl-d-dl">
                  <div><dt>Customer</dt><dd><b style={{ fontWeight: 600 }}>{customerName}</b></dd></div>
                  <div><dt>Service</dt><dd>{service.name} · {service.durationMinutes} min</dd></div>
                  <div><dt>Barber</dt><dd>{barber.name}</dd></div>
                  <div><dt>Time</dt><dd>Today, {time} – {end.label}</dd></div>
                  <div>
                    <dt>Price</dt>
                    <dd>
                      <b style={{ fontWeight: 600 }}>{formatWholeDollars(service.priceCents)}</b>
                      <span className="sl-d-sub">
                        {takeDeposit
                          ? `${formatWholeDollars(service.depositCents)} deposit taken now · ${formatWholeDollars(service.priceCents - service.depositCents)} at the shop`
                          : `No deposit · ${formatWholeDollars(service.priceCents)} at the shop`}
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="sl-d-card" style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                <span style={{ fontSize: 15 }}>
                  Take the {formatWholeDollars(service.depositCents)} deposit now
                  <span className="sl-d-sub">Off for bookings made on a customer’s behalf</span>
                </span>
                <Toggle checked={takeDeposit} label="Take the deposit now" onChange={setTakeDeposit} />
              </div>
            </div>
          ) : null}
        </div>

        <div className="sl-d-drawer__foot">
          <Button size="dashboard" onClick={() => (step === 0 ? onClose() : setStep(step - 1))}>
            {step === 0 ? "Cancel" : "Back"}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button size="dashPrimary" variant="primary" disabled={!canContinue} onClick={() => setStep(step + 1)}>
              Continue
            </Button>
          ) : (
            <Button size="dashPrimary" variant="primary" onClick={confirm}>
              Add booking
            </Button>
          )}
        </div>
      </aside>
    </>
  );
}
