"use client";
/* D-07 Availability — tabs per staff member + Shop hours (tab in the
   URL, staff id or "shop"), the weekly-hours editor writing real
   availability_rules, the booking-rules panel writing the businesses
   policy columns, "Date changes" = real availability_overrides +
   blackout_dates, and pending time-off requests with owner review.
   Breaks from the fixture are gone: availability_rules are a single
   open–close window per day, there is no break column (PROD-W4.md). */
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/sl/Button";
import { StatusPill } from "@/components/sl/StatusPill";
import type {
  AvailabilityOverrideRow,
  AvailabilityRuleRow,
  BlackoutDateRow,
} from "@/lib/supabase/types";
import {
  deleteBlackout,
  deleteOverride,
  reviewTimeOff,
  saveBlackout,
  saveOverride,
  saveWeeklyRules,
  updateBookingPolicies,
} from "../actions";
import { dateShort, firstName, WEEKDAY_NAMES } from "../_lib/model";
import { IconPlus as PlusIcon } from "@/components/sl/icons";
import { Toggle } from "../ui";

/* Monday-first display order → DB weekday (0 = Sunday). */
const DISPLAY_DAYS = [1, 2, 3, 4, 5, 6, 0] as const;

interface DayState {
  weekday: number;
  isClosed: boolean;
  openTime: string; // "09:00"
  closeTime: string;
}

function initialDays(rules: AvailabilityRuleRow[], staffId: string | null): DayState[] {
  return DISPLAY_DAYS.map((weekday) => {
    const rule = rules.find((r) => r.weekday === weekday && r.staff_id === staffId);
    return {
      weekday,
      isClosed: rule ? rule.is_closed : true,
      openTime: rule ? rule.open_time.slice(0, 5) : "09:00",
      closeTime: rule ? rule.close_time.slice(0, 5) : "17:00",
    };
  });
}

export interface TimeOffView {
  id: string;
  staffId: string;
  staffName: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  status: "pending" | "approved" | "declined";
}

export function AvailabilityClient({
  tab,
  business,
  staff,
  rules,
  overrides,
  blackouts,
  timeOff,
  today,
  canEdit,
}: {
  tab: string;
  business: { id: string; timezone: string; minLeadTimeMinutes: number; maxAdvanceDays: number; slotStepMinutes: number };
  staff: { id: string; name: string; isActive: boolean }[];
  rules: AvailabilityRuleRow[];
  overrides: AvailabilityOverrideRow[];
  blackouts: BlackoutDateRow[];
  timeOff: TimeOffView[];
  today: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const isShop = tab === "shop" || !staff.some((s) => s.id === tab);
  const activeStaff = isShop ? null : (staff.find((s) => s.id === tab) ?? null);
  const scopeStaffId = activeStaff?.id ?? null;

  const [days, setDays] = useState<DayState[]>(() => initialDays(rules, scopeStaffId));
  const [scopeKey, setScopeKey] = useState(scopeStaffId ?? "shop");
  if (scopeKey !== (scopeStaffId ?? "shop")) {
    setScopeKey(scopeStaffId ?? "shop");
    setDays(initialDays(rules, scopeStaffId));
  }

  const [minLead, setMinLead] = useState(String(business.minLeadTimeMinutes));
  const [maxAdvance, setMaxAdvance] = useState(String(business.maxAdvanceDays));
  const [slotStep, setSlotStep] = useState(String(business.slotStepMinutes));

  // Date-change add form
  const [dcDate, setDcDate] = useState(today);
  const [dcScope, setDcScope] = useState<string>("shop");
  const [dcClosed, setDcClosed] = useState(true);
  const [dcOpen, setDcOpen] = useState("09:00");
  const [dcClose, setDcClose] = useState("15:00");
  const [dcReason, setDcReason] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setNotice(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setNotice(res.error ?? "Something went wrong.");
      else {
        setNotice("Saved.");
        router.refresh();
      }
    });
  };

  const saveHours = () =>
    run(() =>
      saveWeeklyRules(
        scopeStaffId,
        days.map((d) => ({ weekday: d.weekday, isClosed: d.isClosed, openTime: d.openTime, closeTime: d.closeTime })),
      ),
    );

  const savePolicies = () =>
    run(() =>
      updateBookingPolicies({
        minLeadTimeMinutes: Number(minLead) || 0,
        maxAdvanceDays: Number(maxAdvance) || 60,
        slotStepMinutes: Number(slotStep) || 15,
      }),
    );

  const addDateChange = () => {
    if (dcClosed && dcScope === "shop") {
      run(() => saveBlackout(dcDate, dcReason));
    } else {
      run(() =>
        saveOverride({
          date: dcDate,
          staffId: dcScope === "shop" ? null : dcScope,
          isClosed: dcClosed,
          openTime: dcClosed ? null : dcOpen,
          closeTime: dcClosed ? null : dcClose,
          reason: dcReason || null,
        }),
      );
    }
    setShowAdd(false);
  };

  const dateChanges = useMemo(() => {
    const items: { key: string; date: string; title: string; sub: string; onRemove?: () => void }[] = [];
    for (const b of blackouts) {
      items.push({
        key: `b-${b.id}`,
        date: b.date,
        title: dateShort(b.date),
        sub: `Shop closed${b.reason ? ` · ${b.reason}` : ""}`,
        onRemove: canEdit ? () => run(() => deleteBlackout(b.id)) : undefined,
      });
    }
    for (const o of overrides) {
      const who = o.staff_id ? (staff.find((s) => s.id === o.staff_id)?.name ?? "Staff") : "Shop";
      items.push({
        key: `o-${o.id}`,
        date: o.date,
        title: dateShort(o.date),
        sub: o.is_closed
          ? `${who} closed${o.reason ? ` · ${o.reason}` : ""}`
          : `${who} hours ${o.open_time?.slice(0, 5)} – ${o.close_time?.slice(0, 5)}${o.reason ? ` · ${o.reason}` : ""}`,
        onRemove: canEdit ? () => run(() => deleteOverride(o.id)) : undefined,
      });
    }
    return items.sort((a, b) => a.date.localeCompare(b.date));
  }, [blackouts, overrides, staff, canEdit]);

  const pendingRequests = timeOff.filter((t) => t.status === "pending");
  const activeStaffId = activeStaff?.id;
  const awayNow = activeStaffId
    ? timeOff.find(
        (t) =>
          t.staffId === activeStaffId &&
          t.status === "approved" &&
          new Date(t.startsAt) <= new Date() &&
          new Date(t.endsAt) >= new Date(),
      )
    : undefined;

  const tabs = [
    ...staff.map((s) => ({
      key: s.id,
      label: firstName(s.name),
      badge: timeOff.some((t) => t.staffId === s.id && t.status === "approved" && new Date(t.startsAt) <= new Date() && new Date(t.endsAt) >= new Date())
        ? "away"
        : undefined,
      href: `/app/availability?tab=${s.id}`,
    })),
    { key: "shop", label: "Shop hours", badge: undefined, href: "/app/availability?tab=shop" },
  ];

  return (
    <>
      <div className="sl-d-hd">
        <div>
          <h1 className="sl-d-h1">Availability</h1>
          <p className="sl-d-meta">When customers can book each person</p>
        </div>
        <div className="sl-d-acts">
          {canEdit ? (
            <Button variant="primary" size="dashPrimary" disabled={pending} onClick={saveHours}>
              Save changes
            </Button>
          ) : null}
        </div>
      </div>
      {notice ? <p style={{ fontSize: 14, margin: "0 0 14px", color: notice === "Saved." ? "var(--open-ink)" : "var(--danger, #b3261e)" }}>{notice}</p> : null}

      <div className="sl-d-tools">
        <div className="sl-d-seg" role="navigation" aria-label="Staff member">
          {tabs.map((t) => (
            <Link key={t.key} href={t.href} aria-current={(isShop ? "shop" : activeStaff?.id) === t.key ? "page" : undefined}>
              {t.label}
              {t.badge ? <span>{t.badge}</span> : null}
            </Link>
          ))}
        </div>
      </div>

      <div className="sl-d-avail-grid">
        <section className="sl-d-card" aria-labelledby="wh" style={{ overflow: "hidden" }}>
          <div style={{ padding: "22px 22px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h2 id="wh" style={{ margin: 0, font: "600 28px/1.15 var(--font-display)", letterSpacing: "-.02em" }}>Weekly hours</h2>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>
                Times are in the shop’s time zone ({business.timezone.replace(/_/g, " ")}).
                {isShop ? " Shop hours are the default every person inherits." : " A person’s own hours override the shop hours."}
              </p>
            </div>
            <span className="sl-d-legend" aria-hidden="true">
              <span><i style={{ background: "#e3eddc", boxShadow: "inset 0 0 0 1px #a9c59a" }} />Open</span>
            </span>
          </div>

          {awayNow && activeStaff ? (
            <div style={{ margin: "0 22px 16px", padding: "14px 16px", borderRadius: "var(--radius-l)", background: "var(--away-tint)", color: "var(--away-ink)", fontSize: 14, fontWeight: 600 }}>
              {activeStaff.name} is away until {new Date(awayNow.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              {awayNow.reason ? ` — ${awayNow.reason}` : ""}.
            </div>
          ) : null}

          {days.map((d) => {
            const working = !d.isClosed;
            return (
              <div key={`${scopeKey}-${d.weekday}`} className="sl-d-hours-row" style={!working ? { background: "#fbf7f4" } : undefined}>
                <Toggle
                  checked={working}
                  label={`Works ${WEEKDAY_NAMES[d.weekday]}`}
                  onChange={
                    canEdit
                      ? (next) => setDays((list) => list.map((x) => (x.weekday === d.weekday ? { ...x, isClosed: !next } : x)))
                      : undefined
                  }
                />
                <b style={!working ? { color: "var(--muted)" } : undefined}>{WEEKDAY_NAMES[d.weekday]}</b>
                {working ? (
                  <>
                    <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        className="sl-d-inp sl-d-time-inp"
                        type="time"
                        value={d.openTime}
                        disabled={!canEdit}
                        aria-label={`${WEEKDAY_NAMES[d.weekday]} start`}
                        onChange={(e) => setDays((list) => list.map((x) => (x.weekday === d.weekday ? { ...x, openTime: e.target.value } : x)))}
                      />
                      <span style={{ color: "var(--muted)", fontSize: 14 }}>to</span>
                      <input
                        className="sl-d-inp sl-d-time-inp"
                        type="time"
                        value={d.closeTime}
                        disabled={!canEdit}
                        aria-label={`${WEEKDAY_NAMES[d.weekday]} end`}
                        onChange={(e) => setDays((list) => list.map((x) => (x.weekday === d.weekday ? { ...x, closeTime: e.target.value } : x)))}
                      />
                    </span>
                    <span style={{ fontSize: 13, color: "var(--ink-2)" }}>No break</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 14, color: "var(--muted)" }}>Not working</span>
                    <span aria-hidden="true" className="sl-d-hatch" style={{ display: "block", height: 8, borderRadius: 8 }} />
                  </>
                )}
              </div>
            );
          })}
          <div style={{ padding: "16px 22px", fontSize: 13, color: "var(--muted)", borderTop: "1px solid #f3eae4" }}>
            {isShop ? "Shop hours limit every person’s week." : "Days left off use the shop hours instead."}
          </div>
        </section>

        <div className="sl-d-side-stack">
          <section className="sl-d-ink" style={{ padding: 26 }} aria-labelledby="rules">
            <h2 id="rules" style={{ margin: "0 0 18px", font: "600 28px/1.15 var(--font-display)", letterSpacing: "-.02em" }}>Booking rules</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="sl-d-field">
                <label htmlFor="mn" style={{ color: "#e6d9d1" }}>Shortest notice (minutes)</label>
                <input id="mn" className="sl-d-inp" type="number" min={0} value={minLead} disabled={!canEdit} onChange={(e) => setMinLead(e.target.value)} style={{ boxShadow: "none", background: "var(--linen)" }} />
              </div>
              <div className="sl-d-field">
                <label htmlFor="mx" style={{ color: "#e6d9d1" }}>Furthest ahead (days)</label>
                <input id="mx" className="sl-d-inp" type="number" min={1} max={365} value={maxAdvance} disabled={!canEdit} onChange={(e) => setMaxAdvance(e.target.value)} style={{ boxShadow: "none", background: "var(--linen)" }} />
              </div>
              <div className="sl-d-field">
                <label htmlFor="iv" style={{ color: "#e6d9d1" }}>Start times every</label>
                <select id="iv" className="sl-d-sel sl-d-sel--f" style={{ boxShadow: "none", backgroundColor: "var(--linen)" }} value={slotStep} disabled={!canEdit} onChange={(e) => setSlotStep(e.target.value)}>
                  {[5, 10, 15, 20, 30, 60].map((n) => (
                    <option key={n} value={n}>{n} minutes</option>
                  ))}
                </select>
                <span className="hint" style={{ color: "#bca69c" }}>Applies to the whole shop</span>
              </div>
              {canEdit ? (
                <Button variant="linen" disabled={pending} onClick={savePolicies}>Save rules</Button>
              ) : null}
            </div>
          </section>

          <section className="sl-d-card" style={{ padding: 22 }} aria-labelledby="dc">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <h2 id="dc" style={{ margin: 0, font: "600 24px/1.15 var(--font-display)", letterSpacing: "-.02em" }}>Date changes</h2>
              {canEdit ? (
                <Button size="sm" onClick={() => setShowAdd((v) => !v)}><PlusIcon width={14} height={14} />Add</Button>
              ) : null}
            </div>
            {showAdd && canEdit ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                <div className="sl-d-field">
                  <label htmlFor="dc-date">Date</label>
                  <input id="dc-date" className="sl-d-inp" type="date" value={dcDate} min={today} onChange={(e) => setDcDate(e.target.value)} />
                </div>
                <div className="sl-d-field">
                  <label htmlFor="dc-scope">Applies to</label>
                  <select id="dc-scope" className="sl-d-sel sl-d-sel--f" value={dcScope} onChange={(e) => setDcScope(e.target.value)}>
                    <option value="shop">Whole shop</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Toggle checked={dcClosed} label="Closed that day" onChange={setDcClosed} />
                  <span style={{ fontSize: 14 }}>Closed that day</span>
                </div>
                {!dcClosed ? (
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input className="sl-d-inp sl-d-time-inp" type="time" value={dcOpen} aria-label="Opens" onChange={(e) => setDcOpen(e.target.value)} />
                    <span style={{ color: "var(--muted)", fontSize: 14 }}>to</span>
                    <input className="sl-d-inp sl-d-time-inp" type="time" value={dcClose} aria-label="Closes" onChange={(e) => setDcClose(e.target.value)} />
                  </span>
                ) : null}
                <div className="sl-d-field">
                  <label htmlFor="dc-reason">Reason (optional)</label>
                  <input id="dc-reason" className="sl-d-inp" value={dcReason} onChange={(e) => setDcReason(e.target.value)} placeholder="Thanksgiving" />
                </div>
                <Button size="dashboard" variant="primary" disabled={pending} onClick={addDateChange}>Add date change</Button>
              </div>
            ) : null}
            <ul className="sl-d-list">
              {dateChanges.map((item) => {
                const d = new Date(`${item.date}T12:00:00Z`);
                const onRemove = item.onRemove;
                return (
                  <li key={item.key} style={{ justifyContent: "flex-start", gap: 14 }}>
                    <span className="sl-d-date-chip" aria-hidden="true">
                      <small>{d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}</small>
                      <b>{d.getUTCDate()}</b>
                    </span>
                    <span style={{ flex: 1 }}>
                      <b style={{ fontWeight: 600 }}>{item.title}</b>
                      <span className="sl-d-sub">{item.sub}</span>
                    </span>
                    {onRemove ? (
                      <button type="button" onClick={onRemove} style={{ fontWeight: 600, fontSize: 14, background: "none", border: "none", cursor: "pointer", color: "var(--ink)" }}>
                        Remove
                      </button>
                    ) : null}
                  </li>
                );
              })}
              {dateChanges.length === 0 ? (
                <li style={{ fontSize: 14, color: "var(--muted)" }}>No date changes yet.</li>
              ) : null}
            </ul>
          </section>

          {pendingRequests.length > 0 || timeOff.length > 0 ? (
            <section className="sl-d-card" style={{ padding: 22 }} aria-labelledby="tor">
              <h2 id="tor" style={{ margin: "0 0 8px", font: "600 24px/1.15 var(--font-display)", letterSpacing: "-.02em" }}>Time off</h2>
              <ul className="sl-d-list">
                {timeOff.map((t) => (
                  <li key={t.id} style={{ justifyContent: "flex-start", gap: 14 }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontWeight: 600 }}>{t.staffName}</b>
                      <span className="sl-d-sub">
                        {dateShort(t.startsAt.slice(0, 10))} – {dateShort(t.endsAt.slice(0, 10))}
                        {t.reason ? ` · ${t.reason}` : ""}
                      </span>
                    </span>
                    {t.status === "pending" && canEdit ? (
                      <span style={{ display: "flex", gap: 8 }}>
                        <Button size="sm" disabled={pending} onClick={() => run(() => reviewTimeOff(t.id, "approved"))}>Approve</Button>
                        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => reviewTimeOff(t.id, "declined"))}>Decline</Button>
                      </span>
                    ) : (
                      <StatusPill status={t.status === "approved" ? "Approved" : t.status === "declined" ? "Cancelled" : "Pending"} label={t.status === "declined" ? "Declined" : undefined} />
                    )}
                  </li>
                ))}
              </ul>
              {pendingRequests.length > 0 && !canEdit ? (
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "10px 0 0" }}>Only the owner can review requests.</p>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
