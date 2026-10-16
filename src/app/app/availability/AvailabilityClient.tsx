"use client";
/* D-07 Availability — tabs per barber + Shop hours (tab in the URL),
   weekly hours with breaks, booking rules (dark panel), date changes.
   Only Micah's tab is drawn on the screens; Nia/Andre/Shop hours use
   the same geometry from the fixtures (logged in BUILD-LOG). */
import { useState } from "react";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/sl/Button";
import { business, getBarbers } from "@/lib/api";
import { IconPlus as PlusIcon } from "@/components/sl/icons";
import { Toggle } from "../ui";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

function HoursRow({
  day, working, start, end, breakLabel, onToggle,
}: {
  day: string;
  working: boolean;
  start?: string;
  end?: string;
  breakLabel?: string | null;
  onToggle: (next: boolean) => void;
}) {
  return (
    <div className="sl-d-hours-row" style={!working ? { background: "#fbf7f4" } : undefined}>
      <Toggle checked={working} label={`Works ${day}`} onChange={onToggle} />
      <b style={!working ? { color: "var(--muted)" } : undefined}>{day}</b>
      {working ? (
        <>
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input className="sl-d-inp sl-d-time-inp" defaultValue={start} aria-label={`${day} start`} />
            <span style={{ color: "var(--muted)", fontSize: 14 }}>to</span>
            <input className="sl-d-inp sl-d-time-inp" defaultValue={end} aria-label={`${day} end`} />
          </span>
          <span style={{ minWidth: 0 }}>
            {breakLabel ? (
              <>
                <span style={{ display: "block", fontSize: 13, color: "var(--ink-2)" }}>
                  {breakLabel} · <a href="#" onClick={(e) => e.preventDefault()} style={{ fontWeight: 600 }}>Edit</a>
                </span>
                <span className="sl-d-daybar" aria-hidden="true"><i style={{ left: "52.8%", width: "5.6%" }} /></span>
              </>
            ) : (
              <>
                <span style={{ display: "block", fontSize: 13, color: "var(--ink-2)" }}>No break</span>
                <span className="sl-d-daybar" aria-hidden="true" />
              </>
            )}
          </span>
        </>
      ) : (
        <>
          <span style={{ fontSize: 14, color: "var(--muted)" }}>Not working</span>
          <span aria-hidden="true" className="sl-d-hatch" style={{ display: "block", height: 8, borderRadius: 8 }} />
        </>
      )}
    </div>
  );
}

export function AvailabilityClient({ tab }: { tab: string }) {
  const barbers = getBarbers();
  const active = barbers.find((b) => b.id === tab) ?? (tab === "shop" ? null : barbers[0]!);
  const isShop = tab === "shop";

  const [works, setWorks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DAYS.map((d, i) => [d, i < 6])),
  );

  const tabs = [
    ...barbers.map((b) => ({
      key: b.id,
      label: b.name,
      badge: b.status === "Away" ? "away" : undefined,
      href: `/app/availability?tab=${b.id}`,
    })),
    { key: "shop", label: "Shop hours", badge: undefined, href: "/app/availability?tab=shop" },
  ];

  return (
    <>
      <div className="sl-d-hd">
        <div>
          <h1 className="sl-d-h1">Availability</h1>
          <p className="sl-d-meta">When customers can book each barber</p>
        </div>
        <div className="sl-d-acts">
          <Button variant="primary" size="dashPrimary">Save changes</Button>
        </div>
      </div>

      <div className="sl-d-tools">
        <div className="sl-d-seg" role="navigation" aria-label="Barber">
          {tabs.map((t) => (
            <Link key={t.key} href={t.href} aria-current={(isShop ? "shop" : active?.id) === t.key ? "page" : undefined}>
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
                Times are Eastern. Shop hours limit these: Sunday is 10 AM – 3 PM.
              </p>
            </div>
            <span className="sl-d-legend" aria-hidden="true">
              <span><i style={{ background: "#e3eddc", boxShadow: "inset 0 0 0 1px #a9c59a" }} />Open</span>
              <span><i style={{ background: "repeating-linear-gradient(135deg, var(--oxblood) 0 2px, #f2eae5 2px 4px)" }} />Break</span>
            </span>
          </div>

          {isShop ? (
            <>
              {business.hours.map((h) => (
                <div key={h.days} className="sl-d-hours-row">
                  <span aria-hidden="true" />
                  <b>{h.days}</b>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input className="sl-d-inp sl-d-time-inp" defaultValue={h.open} aria-label={`${h.days} start`} />
                    <span style={{ color: "var(--muted)", fontSize: 14 }}>to</span>
                    <input className="sl-d-inp sl-d-time-inp" defaultValue={h.close} aria-label={`${h.days} end`} />
                  </span>
                  <span style={{ fontSize: 13, color: "var(--ink-2)" }}>{business.hoursSummary}</span>
                </div>
              ))}
              <div style={{ padding: "16px 22px", fontSize: 13, color: "var(--muted)", borderTop: "1px solid #f3eae4" }}>
                Shop hours limit every barber’s week.
              </div>
            </>
          ) : active ? (
            <>
              {active.status === "Away" && active.away ? (
                <div style={{ margin: "0 22px 16px", padding: "14px 16px", borderRadius: "var(--radius-l)", background: "var(--away-tint)", color: "var(--away-ink)", fontSize: 14, fontWeight: 600 }}>
                  {active.name} is away {active.away.label.replace("Away · ", "Oct 6–19 · ")} — {active.away.backLabel.toLowerCase()}.
                </div>
              ) : null}
              {DAYS.map((day, i) => {
                const workingDay = (active.workDays ?? [1, 2, 3, 4, 5, 6]).includes(i === 6 ? 0 : i + 1);
                const working = workingDay && (works[day] ?? false);
                return (
                  <HoursRow
                    key={`${active.id}-${day}`}
                    day={day}
                    working={working}
                    start="9:00 AM"
                    end="6:00 PM"
                    breakLabel={active.break ? `Break ${active.break.start.replace(" PM", "")} – ${active.break.end}` : null}
                    onToggle={(next) => setWorks((m) => ({ ...m, [day]: next }))}
                  />
                );
              })}
            </>
          ) : null}
        </section>

        <div className="sl-d-side-stack">
          <section className="sl-d-ink" style={{ padding: 26 }} aria-labelledby="rules">
            <h2 id="rules" style={{ margin: "0 0 18px", font: "600 28px/1.15 var(--font-display)", letterSpacing: "-.02em" }}>Booking rules</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="sl-d-field">
                <label htmlFor="mn" style={{ color: "#e6d9d1" }}>Shortest notice</label>
                <select id="mn" className="sl-d-sel sl-d-sel--f" style={{ boxShadow: "none", backgroundColor: "var(--linen)" }} defaultValue="2 hours before">
                  <option>2 hours before</option>
                </select>
              </div>
              <div className="sl-d-field">
                <label htmlFor="mx" style={{ color: "#e6d9d1" }}>Furthest ahead</label>
                <select id="mx" className="sl-d-sel sl-d-sel--f" style={{ boxShadow: "none", backgroundColor: "var(--linen)" }} defaultValue="60 days">
                  <option>60 days</option>
                </select>
              </div>
              <div className="sl-d-field">
                <label htmlFor="iv" style={{ color: "#e6d9d1" }}>Start times every</label>
                <select id="iv" className="sl-d-sel sl-d-sel--f" style={{ boxShadow: "none", backgroundColor: "var(--linen)" }} defaultValue="15 minutes">
                  <option>15 minutes</option>
                </select>
                <span className="hint" style={{ color: "#bca69c" }}>Applies to the whole shop</span>
              </div>
            </div>
          </section>

          <section className="sl-d-card" style={{ padding: 22 }} aria-labelledby="dc">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <h2 id="dc" style={{ margin: 0, font: "600 24px/1.15 var(--font-display)", letterSpacing: "-.02em" }}>Date changes</h2>
              <ButtonLink href="#" size="sm"><PlusIcon width={14} height={14} />Add</ButtonLink>
            </div>
            <ul className="sl-d-list">
              <li style={{ justifyContent: "flex-start", gap: 14 }}>
                <span className="sl-d-date-chip" aria-hidden="true"><small>Nov</small><b>26</b></span>
                <span style={{ flex: 1 }}>
                  <b style={{ fontWeight: 600 }}>Thursday, Nov 26</b>
                  <span className="sl-d-sub">Shop closed · Thanksgiving</span>
                </span>
                <a href="#" onClick={(e) => e.preventDefault()} style={{ fontWeight: 600 }}>Edit</a>
              </li>
              <li style={{ justifyContent: "flex-start", gap: 14 }}>
                <span className="sl-d-date-chip" aria-hidden="true"><small>Oct</small><b>17</b></span>
                <span style={{ flex: 1 }}>
                  <b style={{ fontWeight: 600 }}>Saturday, Oct 17</b>
                  <span className="sl-d-sub">Micah finishes at 3 PM</span>
                </span>
                <a href="#" onClick={(e) => e.preventDefault()} style={{ fontWeight: 600 }}>Edit</a>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
