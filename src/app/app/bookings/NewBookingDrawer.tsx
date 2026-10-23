"use client";
/* Booking on someone's behalf: the drawn 5-step drawer, wired to the
   create_booking SECURITY DEFINER RPC via the createBookingOnBehalf
   server action (source 'dashboard'). The RPC validates the slot
   against real availability and find-or-creates the customer (the
   customers table has no direct INSERT policy by design).
   Changes from the fixture version (PROD-W4.md): the fake open-times
   grid is replaced by real date + time inputs (the RPC is the source
   of truth for availability), the "take deposit now" toggle is gone
   (no payment provider in production — the service's payment policy
   decides, and the review step says what will happen), and a new
   customer needs an email or phone because the RPC requires a contact. */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/sl/Button";
import { StatusPill } from "@/components/sl/StatusPill";
import { createBookingOnBehalf } from "../actions";
import { dateShort, wholeDollars } from "../_lib/model";
import { IconClose, IconSearch, useDrawerTrap } from "../ui";

export interface NewBookingService {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  depositCents: number;
  paymentPolicy: "none" | "deposit" | "full";
  staffIds: string[];
}

export interface NewBookingCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  visits: number;
}

const STEPS = ["Customer", "Service", "Staff", "Time", "Review"] as const;

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.charAt(0) ?? "") + (p.length > 1 ? p[p.length - 1]!.charAt(0) : "")).toUpperCase();
}

export function NewBookingDrawer({
  services,
  staffOptions,
  customers,
  today,
  onClose,
}: {
  services: NewBookingService[];
  staffOptions: { id: string; name: string }[];
  customers: NewBookingCustomer[];
  today: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useDrawerTrap<HTMLElement>(onClose);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("");
  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [staffId, setStaffId] = useState(staffOptions[0]?.id ?? "");
  const [dateKey, setDateKey] = useState(today);
  const [start24, setStart24] = useState("10:00");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q),
    );
  }, [query, customers]);

  const service = services.find((s) => s.id === serviceId) ?? services[0];
  const staffMember = staffOptions.find((s) => s.id === staffId);
  const canContinue =
    step === 0
      ? customerName.trim().length > 1 && (customerId !== undefined || customerEmail.trim() !== "" || customerPhone.trim() !== "")
      : step === 1
        ? Boolean(service)
        : step === 2
          ? Boolean(staffMember)
          : true;

  const confirm = () => {
    if (!service || !staffMember) return;
    setError(null);
    startTransition(async () => {
      const res = await createBookingOnBehalf({
        customerId,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        serviceId: service.id,
        staffId: staffMember.id,
        dateKey,
        start24,
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
            Book on a customer’s behalf. The booking is checked against real availability.
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
                    aria-pressed={customerId === c.id}
                    onClick={() => {
                      setCustomerId(c.id);
                      setCustomerName(c.name);
                      setCustomerEmail(c.email);
                      setCustomerPhone(c.phone);
                    }}
                  >
                    <span className="sl-d-mono" aria-hidden="true">{initials(c.name)}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ display: "block", fontSize: 15 }}>{c.name}</b>
                      <span className="sl-d-sub">{c.email || c.phone}</span>
                    </span>
                    {c.visits === 0 ? <StatusPill status="Arrived" label="New" /> : null}
                  </button>
                ))}
                {matches.length === 0 ? (
                  <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>No matching customers — add them below.</p>
                ) : null}
              </div>
              <div className="sl-d-field">
                <label htmlFor="nb-name">Or a new customer</label>
                <input
                  id="nb-name"
                  className="sl-d-inp"
                  placeholder="Full name"
                  value={customerId ? "" : customerName}
                  onChange={(e) => { setCustomerId(undefined); setCustomerName(e.target.value); }}
                />
              </div>
              {customerId === undefined && customerName.trim().length > 1 ? (
                <>
                  <div className="sl-d-field">
                    <label htmlFor="nb-email">Email</label>
                    <input id="nb-email" className="sl-d-inp" type="email" placeholder="name@example.com" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
                  </div>
                  <div className="sl-d-field">
                    <label htmlFor="nb-phone">Phone</label>
                    <input id="nb-phone" className="sl-d-inp" type="tel" placeholder="Phone number" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                  </div>
                  <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>A new customer needs an email or a phone number.</p>
                </>
              ) : null}
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
                  <b>{wholeDollars(s.priceCents)}</b>
                </button>
              ))}
              {services.length === 0 ? (
                <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>No active services yet — add one in Services first.</p>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="sl-d-opts">
              {staffOptions.map((s) => {
                const offered = !service || service.staffIds.length === 0 || service.staffIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    className="sl-d-opt"
                    aria-pressed={staffId === s.id}
                    disabled={!offered}
                    style={!offered ? { opacity: 0.55, cursor: "default" } : undefined}
                    onClick={() => setStaffId(s.id)}
                  >
                    <span className="sl-d-mono" aria-hidden="true">{initials(s.name)}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ display: "block", fontSize: 15 }}>{s.name}</b>
                      <span className="sl-d-sub">{offered ? "Offers this service" : "Does not offer this service"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {step === 3 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink-2)" }}>
                {service?.name} with {staffMember?.name}
              </p>
              <div className="sl-d-field">
                <label htmlFor="nb-date">Date</label>
                <input id="nb-date" className="sl-d-inp" type="date" value={dateKey} min={today} onChange={(e) => setDateKey(e.target.value)} />
              </div>
              <div className="sl-d-field">
                <label htmlFor="nb-time">Start time</label>
                <input id="nb-time" className="sl-d-inp" type="time" value={start24} onChange={(e) => setStart24(e.target.value)} />
              </div>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                Availability is checked when you add the booking — if the time is taken or outside hours, you’ll be told here.
              </p>
            </div>
          ) : null}

          {step === 4 && service && staffMember ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="sl-d-card" style={{ padding: "8px 20px 10px" }}>
                <dl className="sl-d-dl">
                  <div><dt>Customer</dt><dd><b style={{ fontWeight: 600 }}>{customerName}</b></dd></div>
                  <div><dt>Service</dt><dd>{service.name} · {service.durationMinutes} min</dd></div>
                  <div><dt>Staff</dt><dd>{staffMember.name}</dd></div>
                  <div><dt>Time</dt><dd>{dateKey === today ? "Today" : dateShort(dateKey)}, {start24}</dd></div>
                  <div>
                    <dt>Price</dt>
                    <dd>
                      <b style={{ fontWeight: 600 }}>{wholeDollars(service.priceCents)}</b>
                      <span className="sl-d-sub">
                        {service.paymentPolicy === "deposit"
                          ? `${wholeDollars(service.depositCents)} deposit — the booking is held as payment pending until it is paid`
                          : service.paymentPolicy === "full"
                            ? "Full payment up front — the booking is held as payment pending until it is paid"
                            : `No deposit · ${wholeDollars(service.priceCents)} due at the shop · confirmed right away`}
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>
              {error ? (
                <p style={{ fontSize: 14, color: "var(--danger, #b3261e)", margin: 0 }}>{error}</p>
              ) : null}
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
            <Button size="dashPrimary" variant="primary" disabled={pending} onClick={confirm}>
              Add booking
            </Button>
          )}
        </div>
      </aside>
    </>
  );
}
