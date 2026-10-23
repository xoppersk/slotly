"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { StepHeading } from "@/components/sl/shells/BookingShell";
import { DayTile } from "@/components/sl/DayTile";
import { TimeSlot, TimeSlotGroup } from "@/components/sl/TimeSlot";
import { Button, ButtonLink } from "@/components/sl/Button";
import { IconChevronLeft } from "@/components/sl/icons";
import { formatCents } from "@/lib/format";
import { flowQuery, useBookingFlow } from "../../_flow/BookingFlow";
import { FlowShell } from "../../_flow/Shell";
import { FlowSummary, dateLabel, shortDate } from "../../_flow/Summary";
import {
  addDaysYmd,
  todayInTz,
  type ApiDay,
  type ApiSlot,
  type AvailabilityResponseData,
} from "../../_lib/types";

/* ------------------------------------------------------------------ */
/* Shared grid helpers                                                 */
/* ------------------------------------------------------------------ */

/** Slots of one day for the chosen barber ("any" = one pill per instant). */
function daySlots(day: ApiDay, barberId: string): ApiSlot[] {
  const all =
    barberId === "any"
      ? day.slots
      : day.slots.filter((s) => s.staffId === barberId);
  if (barberId !== "any") return all;
  const byStart = new Map<string, ApiSlot>();
  for (const s of all) if (!byStart.has(s.startsAt)) byStart.set(s.startsAt, s);
  return [...byStart.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

function useGrid(serviceId: string) {
  const flow = useBookingFlow();
  const tz = flow.catalog.business.timezone;
  const maxAdvance = flow.catalog.policy?.maxAdvanceDays ?? 30;
  const [reloadKey, setReloadKey] = useState(0);
  // Response is keyed by the request that produced it, so a stale grid is
  // never shown for a different service (no synchronous reset in effect).
  const [resp, setResp] = useState<{
    key: string;
    grid: AvailabilityResponseData | null;
    error: string | null;
  } | null>(null);
  const key = `${serviceId}|${reloadKey}`;
  useEffect(() => {
    if (!serviceId) return;
    const today = todayInTz(tz);
    const to = addDaysYmd(today, Math.min(maxAdvance, 30));
    const url = `/api/public/availability?businessId=${flow.catalog.business.id}&serviceId=${serviceId}&staffId=any&from=${today}&to=${to}`;
    let cancelled = false;
    fetch(url)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.message ?? "Could not load availability.");
        return j as AvailabilityResponseData;
      })
      .then((j) => {
        if (!cancelled) setResp({ key, grid: j, error: null });
      })
      .catch((e: Error) => {
        if (!cancelled) setResp({ key, grid: null, error: e.message });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, reloadKey]);
  const current = resp && resp.key === key ? resp : null;
  return {
    grid: current?.grid ?? null,
    error: current?.error ?? null,
    reload: () => setReloadKey((k) => k + 1),
  };
}

function endShort(slot: ApiSlot): string {
  return `to ${slot.endLabel.replace(/ (AM|PM)$/, "")}`;
}

/* ------------------------------------------------------------------ */
/* F-07 Fully booked — rendered when the REAL grid says the day is full */
/* ------------------------------------------------------------------ */

function FullyBooked({
  grid,
  date,
  barberId,
  onBack,
}: {
  grid: AvailabilityResponseData;
  date: string;
  barberId: string;
  onBack: () => void;
}) {
  const flow = useBookingFlow();
  const router = useRouter();
  const svc = flow.service;
  const barberName =
    barberId === "any"
      ? "the shop"
      : (flow.catalog.staff.find((s) => s.id === barberId)?.name ?? "your barber");
  const day = grid.days.find((d) => d.date === date);
  const otherStaffSlots = day
    ? day.slots.filter((s) => s.staffId !== barberId).length
    : 0;
  // Next opening for the chosen barber after this date.
  let next: { day: ApiDay; slot: ApiSlot } | null = null;
  for (const d of grid.days) {
    if (d.date <= date) continue;
    const slots = daySlots(d, barberId);
    if (slots.length > 0) {
      next = { day: d, slot: slots[0]! };
      break;
    }
  }
  const otherStaff = grid.staff.find((s) => s.id !== barberId);
  return (
    <FlowShell>
      <div className="sl-b-main" style={{ maxWidth: 760 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--oxblood)" }}>
          {dateLabel(date)} · {svc?.name} with {barberName}
        </p>
        <h1 className="sl-b-moment" style={{ marginTop: 10 }}>
          {dateLabel(date).split(",")[0]} is full. We can keep an eye out.
        </h1>
        <p className="sl-b-lead">
          Every time with {barberName} is booked that day. Take the next
          opening, or see who else is free.
        </p>
        <div className="sl-b-card" style={{ marginTop: 28 }}>
          <dl className="sl-b-kv">
            {next ? (
              <>
                <dt>Next with {barberName}</dt>
                <dd>
                  {shortDate(next.day.date)} · {next.slot.label}
                </dd>
              </>
            ) : null}
            {barberId !== "any" && otherStaffSlots > 0 ? (
              <>
                <dt>Same day, other barbers</dt>
                <dd>{otherStaffSlots} times open</dd>
              </>
            ) : null}
          </dl>
          <div className="sl-b-actions">
            {next ? (
              <Button
                variant="primary"
                onClick={() => {
                  flow.pickSlot({ ...next!.slot, date: next!.day.date });
                  router.push(
                    `${flow.base}/book/details${flowQuery({ serviceId: flow.serviceId, barberId, date: next!.day.date, startsAt: next!.slot.startsAt })}`,
                  );
                }}
              >
                Book {shortDate(next.day.date)} at {next.slot.label}
              </Button>
            ) : null}
            {barberId !== "any" && otherStaff ? (
              <ButtonLink
                href={`${flow.base}/book/time?service=${flow.serviceId}&barber=${otherStaff.id}&date=${date}`}
              >
                See {otherStaff.name}&rsquo;s times
              </ButtonLink>
            ) : null}
            <Button onClick={onBack}>Pick another day</Button>
          </div>
        </div>
      </div>
    </FlowShell>
  );
}

/* ------------------------------------------------------------------ */
/* F-08 Booking conflict — a lost slot race or an expired soft hold.   */
/* Alternatives come from the REAL grid, never fabricated.             */
/* ------------------------------------------------------------------ */

function Conflict({ grid }: { grid: AvailabilityResponseData }) {
  const flow = useBookingFlow();
  const router = useRouter();
  const sp = useSearchParams();
  const missed = sp.get("missed");
  const missedLabel =
    missed && grid
      ? (() => {
          for (const d of grid.days) {
            const s = d.slots.find((x) => x.startsAt === missed);
            if (s) return s.label;
          }
          return flow.holdTime;
        })()
      : flow.holdTime;
  const barberId = sp.get("barber") ?? flow.barberId;
  const barberName =
    barberId === "any"
      ? "the shop"
      : (flow.catalog.staff.find((s) => s.id === barberId)?.name ?? "your barber");

  const alternatives = useMemo(() => {
    const out: { day: ApiDay; slot: ApiSlot }[] = [];
    const afterMs = missed ? Date.parse(missed) : 0;
    for (const d of grid.days) {
      for (const s of daySlots(d, barberId)) {
        if (Date.parse(s.startsAt) > afterMs) out.push({ day: d, slot: s });
        if (out.length >= 5) return out;
      }
    }
    return out;
  }, [grid, barberId, missed]);

  const [pick, setPick] = useState(0);
  const chosen = alternatives[pick] ?? alternatives[0];
  const nextStep = flow.details.firstName ? "review" : "details";

  return (
    <FlowShell>
      <div className="sl-b-main" style={{ maxWidth: 760 }}>
        <h1 className="sl-b-moment">That time just went</h1>
        <p className="sl-b-lead">
          {missedLabel
            ? `Someone booked ${missedLabel} just ahead of you. `
            : "That time is no longer open. "}
          Your details are saved and nothing was charged. Pick another time
          with {barberName} and we&rsquo;ll hold it while you finish.
        </p>
        <div className="sl-b-card" style={{ marginTop: 28 }}>
          <dl className="sl-b-kv">
            {missedLabel ? (
              <>
                <dt>You picked</dt>
                <dd>{missedLabel}</dd>
              </>
            ) : null}
            {chosen ? (
              <>
                <dt>Next opening</dt>
                <dd>
                  {shortDate(chosen.day.date)} · {chosen.slot.label}
                </dd>
              </>
            ) : null}
            <dt>Your details</dt>
            <dd>Saved</dd>
          </dl>
          {alternatives.length > 0 ? (
            <>
              <h2 style={{ font: "600 18px/1.3 var(--font-display)", margin: "24px 0 12px" }}>
                Still open
              </h2>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }} role="group" aria-label="Still open times">
                {alternatives.map((a, i) => (
                  <TimeSlot
                    key={a.slot.startsAt}
                    time={`${shortDate(a.day.date)} ${a.slot.label}`}
                    selected={pick === i}
                    onSelect={() => setPick(i)}
                  />
                ))}
              </div>
              <div className="sl-b-actions">
                <Button
                  variant="primary"
                  onClick={() => {
                    if (!chosen) return;
                    flow.pickSlot({ ...chosen.slot, date: chosen.day.date });
                    router.push(
                      `${flow.base}/book/${nextStep}${flowQuery({ serviceId: flow.serviceId, barberId, date: chosen.day.date, startsAt: chosen.slot.startsAt })}`,
                    );
                  }}
                >
                  Hold {chosen?.slot.label} and continue
                </Button>
                <ButtonLink href={`${flow.base}/book/time${flowQuery(flow)}`}>
                  Pick another day
                </ButtonLink>
              </div>
            </>
          ) : (
            <div className="sl-b-actions">
              <ButtonLink variant="primary" href={`${flow.base}/book/time${flowQuery(flow)}`}>
                See all times
              </ButtonLink>
            </div>
          )}
        </div>
      </div>
    </FlowShell>
  );
}

/* ------------------------------------------------------------------ */
/* P-04 Choose a time                                                  */
/* ------------------------------------------------------------------ */

function TimeInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const flow = useBookingFlow();
  const conflictMode = sp.get("conflict") === "1";
  const serviceId = sp.get("service") ?? flow.serviceId;
  const barberId = sp.get("barber") ?? flow.barberId;
  const svc = flow.catalog.services.find((s) => s.id === serviceId);
  const barber = flow.catalog.staff.find((s) => s.id === barberId);
  const tz = flow.catalog.business.timezone;
  const today = todayInTz(tz);
  const { grid, error, reload } = useGrid(serviceId);

  const [date, setDate] = useState(sp.get("date") ?? flow.date ?? today);
  const [weekOffset, setWeekOffset] = useState(0);
  const [fullDate, setFullDate] = useState<string | null>(null);

  // Soft-hold expiry → F-08 (real state, real alternatives).
  useEffect(() => {
    if (flow.secondsLeft === 0 && flow.holdTime && !conflictMode) {
      router.push(
        `${flow.base}/book/time?conflict=1&service=${serviceId}&barber=${barberId}`,
      );
    }
  }, [flow.secondsLeft, flow.holdTime, conflictMode, flow.base, serviceId, barberId, router]);

  const day = grid?.days.find((d) => d.date === date);
  const slots = useMemo(
    () => (day ? daySlots(day, barberId) : []),
    [day, barberId],
  );
  const morning = slots.filter((s) => s.label.includes("AM"));
  const afternoon = slots.filter((s) => s.label.includes("PM"));

  const visibleDays = useMemo(() => {
    if (!grid) return [];
    return grid.days.slice(weekOffset * 7, weekOffset * 7 + 7);
  }, [grid, weekOffset]);

  const onDay = (d: ApiDay) => {
    const dSlots = daySlots(d, barberId);
    if (d.status === "fully_booked" || (d.status === "open" && dSlots.length === 0)) {
      setFullDate(d.date);
      return;
    }
    setDate(d.date);
    flow.setFlow({ date: d.date, serviceId, barberId });
  };

  const onSlot = (slot: ApiSlot) => {
    flow.setFlow({ serviceId, barberId });
    flow.pickSlot({ ...slot, date });
  };

  if (conflictMode) {
    return grid ? (
      <Conflict grid={grid} />
    ) : (
      <FlowShell step={3}>
        <div className="sl-b-main">
          <p className="sl-b-lead">{error ?? "Loading times…"}</p>
        </div>
      </FlowShell>
    );
  }
  if (fullDate && grid) {
    return (
      <FullyBooked
        grid={grid}
        date={fullDate}
        barberId={barberId}
        onBack={() => setFullDate(null)}
      />
    );
  }

  const q = flowQuery({ serviceId, barberId, date, startsAt: flow.startsAt });
  const mins =
    flow.secondsLeft !== null
      ? `${Math.floor(flow.secondsLeft / 60)}:${String(flow.secondsLeft % 60).padStart(2, "0")}`
      : null;
  const weekday = dateLabel(date).split(",")[0];
  const isPickDay = date === flow.date && Boolean(flow.startsAt);
  const holdProgress =
    flow.secondsLeft !== null
      ? Math.min(1, Math.max(0, flow.secondsLeft / 600))
      : 0;
  const weekFirst = visibleDays[0];
  const weekLast = visibleDays[visibleDays.length - 1];
  const weekLabel =
    weekFirst && weekLast
      ? `${shortDate(weekFirst.date)} – ${shortDate(weekLast.date)}, ${weekLast.date.slice(0, 4)}`
      : "";
  const zoneAbbr = (() => {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: "short",
      }).formatToParts(new Date());
      return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
    } catch {
      return tz;
    }
  })();

  // Timeline blocks: step-sized segments across the day's real open window.
  const step = flow.catalog.policy?.slotStepMinutes ?? 30;
  const toMins = (label: string | null) => {
    if (!label) return null;
    const m = /^(\d+):(\d+) (AM|PM)$/.exec(label);
    if (!m) return null;
    let h = Number(m[1]) % 12;
    if (m[3] === "PM") h += 12;
    return h * 60 + Number(m[2]);
  };
  const openM = toMins(day?.openTime ?? null);
  const closeM = toMins(day?.closeTime ?? null);
  const timelineBlocks: { label: string; kind: "open" | "booked" | "pick" }[] = [];
  if (openM !== null && closeM !== null && closeM > openM) {
    for (let t = openM; t < closeM; t += step) {
      const h24 = Math.floor(t / 60);
      const ap = h24 >= 12 ? "PM" : "AM";
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      const label = `${h12}:${String(t % 60).padStart(2, "0")} ${ap}`;
      const kind =
        isPickDay && flow.timeLabel === label
          ? "pick"
          : slots.some((s) => s.label === label)
            ? "open"
            : "booked";
      timelineBlocks.push({ label, kind });
      if (timelineBlocks.length >= 32) break;
    }
  }
  const bookedPhrases = (day?.bookedLabels ?? []).map((b) =>
    b.replace(/ (AM|PM) – /g, " to ").replace(/ (AM|PM)$/, ""),
  );
  const timelineLabel = `${weekday} ${day?.openTime ?? ""} to ${day?.closeTime ?? ""}${bookedPhrases.length ? `: booked ${bookedPhrases.join(" and ")}` : ""}${isPickDay && flow.timeLabel ? `; your pick is ${flow.timeLabel}` : ""}`;

  // Hint: a fully-booked day for this barber inside the visible week.
  const fullDay = grid?.days.find((d) => {
    if (d.date < today) return false;
    return d.status === "fully_booked" && daySlots(d, barberId).length === 0 && barberId !== "any";
  });

  return (
    <FlowShell step={3} className="sl-b-timepage">
      <div className="sl-b-topphone">
        <div className="sl-b-topphone__row">
          <Link href={`${flow.base}/book/barber${q}`} aria-label="Back">
            <IconChevronLeft />
          </Link>
          <span className="sl-b-topphone__brand" aria-hidden="true">
            {flow.catalog.business.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("")}
          </span>
          <b style={{ flex: 1 }}>{flow.catalog.business.name}</b>
          <span className="sl-b-topphone__step">3 of 6</span>
        </div>
        <div className="sl-b-topphone__segs" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <i
              key={i}
              className={i < 2 ? "sl-b-seg--done" : i === 2 ? "sl-b-seg--cur" : undefined}
            />
          ))}
        </div>
      </div>
      <div className="sl-b-main">
        <StepHeading step={3} title="Choose a time" />
        <p className="sl-b-lead">
          <span
            className="sl-b-opt__avatar"
            style={{ display: "inline-grid", width: 28, height: 28, fontSize: 13, verticalAlign: "middle", marginRight: 8 }}
          >
            {barber?.initial ?? "A"}
          </span>
          {barberId === "any" ? "Any barber" : barber?.name} · {svc?.name} ·{" "}
          {svc?.durationMinutes} min ·{" "}
          <Link href={`${flow.base}/book/barber${q}`}>Change barber</Link>
        </p>
        <p className="sl-b-phone-lead">
          <span
            className="sl-b-opt__avatar"
            style={{ display: "inline-grid", width: 28, height: 28, fontSize: 13, flex: "none" }}
          >
            {barber?.initial ?? "A"}
          </span>
          <span>
            {svc?.name}, {svc?.durationMinutes} min, with{" "}
            {barberId === "any" ? "any barber" : barber?.name}
          </span>
        </p>
        <div className="sl-b-weeknav">
          <span>
            <button
              type="button"
              aria-label="Previous week"
              disabled={weekOffset === 0}
              onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
              style={{ background: "none", border: 0, font: "inherit", cursor: "pointer" }}
            >
              &lsaquo;
            </button>
            <b> {weekLabel} </b>
            <button
              type="button"
              aria-label="Next week"
              disabled={!grid || (weekOffset + 1) * 7 >= grid.days.length}
              onClick={() => setWeekOffset((w) => w + 1)}
              style={{ background: "none", border: 0, font: "inherit", cursor: "pointer" }}
            >
              &rsaquo;
            </button>
          </span>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            Times in {zoneAbbr}
          </span>
        </div>
        <div className="sl-b-phone-month">
          <h2>
            {new Date(`${date}T12:00:00`).toLocaleString("en-US", { month: "long" })}{" "}
            {date.slice(0, 4)}
          </h2>
          <span>{zoneAbbr} time</span>
        </div>

        {error ? (
          <div className="sl-b-card" style={{ marginTop: 20 }}>
            <p style={{ fontSize: 15 }}>{error}</p>
            <div className="sl-b-actions">
              <Button variant="primary" onClick={reload}>
                Try again
              </Button>
            </div>
          </div>
        ) : !grid ? (
          <p className="sl-b-lead" style={{ marginTop: 20 }}>
            Loading times…
          </p>
        ) : (
          <>
            <div className="sl-b-days-scroll sl-days" style={{ display: undefined }}>
              {visibleDays.map((d) => {
                const dSlots = daySlots(d, barberId);
                const state =
                  d.date < today
                    ? "past"
                    : d.status === "closed"
                      ? "closed"
                      : d.status === "fully_booked" || dSlots.length === 0
                        ? "full"
                        : "open";
                return (
                  <DayTile
                    key={d.date}
                    weekday={
                      d.date === today
                        ? "Today"
                        : new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en-US", {
                            weekday: "short",
                            timeZone: "UTC",
                          })
                    }
                    dayNumber={Number(d.date.slice(8, 10))}
                    openCount={dSlots.length}
                    totalSlots={12}
                    state={state}
                    selected={date === d.date}
                    onSelect={() => onDay(d)}
                  />
                );
              })}
            </div>

            <div className="sl-b-grid">
              <div>
                {timelineBlocks.length > 0 ? (
                  <div className="sl-b-timeline-wrap">
                    <div className="sl-b-timeline-head">
                      <h2 className="sl-b-timeline-title">
                        <b>
                          {barberId === "any"
                            ? "The shop"
                            : `${barber?.name}’s`}{" "}
                          {weekday}
                        </b>{" "}
                        · {slots.length} times open
                      </h2>
                      <div className="sl-b-legend">
                        <span>
                          <i className="sl-b-swatch sl-b-swatch--open" aria-hidden="true" />
                          Open
                        </span>
                        <span>
                          <i className="sl-b-swatch sl-b-swatch--booked" aria-hidden="true" />
                          Booked
                        </span>
                        <span>
                          <i className="sl-b-swatch sl-b-swatch--pick" aria-hidden="true" />
                          Your pick
                        </span>
                      </div>
                    </div>
                    <div className="sl-b-timeline" role="img" aria-label={timelineLabel}>
                      {timelineBlocks.map((blk, i) => (
                        <i
                          key={`${blk.label}-${i}`}
                          className={`sl-b-timeline__block sl-b-timeline__block--${blk.kind}`}
                          style={{
                            left: `${timelineBlocks.length > 1 ? (i / timelineBlocks.length) * 100 : 0}%`,
                          }}
                        />
                      ))}
                    </div>
                    <div className="sl-b-timeline__labels" aria-hidden="true">
                      <span style={{ left: 0 }}>{day?.openTime?.replace(":00 ", " ")}</span>
                      <span style={{ right: 0 }}>{day?.closeTime?.replace(":00 ", " ")}</span>
                    </div>
                  </div>
                ) : null}

                <div style={{ marginTop: 28, display: "grid", gap: 26 }}>
                  {day?.status === "closed" ? (
                    <p style={{ fontSize: 15, color: "var(--muted)" }}>
                      Closed on {dateLabel(date)}.{day.reason ? ` ${day.reason}` : ""}
                    </p>
                  ) : slots.length === 0 ? (
                    <p style={{ fontSize: 15, color: "var(--muted)" }}>
                      No times left on {dateLabel(date)} — pick another day
                      above.
                    </p>
                  ) : (
                    <>
                      {morning.length ? (
                        <TimeSlotGroup
                          partLabel="Morning"
                          countLabel={`${morning.length} times`}
                          groupLabel={`Morning times on ${dateLabel(date)}`}
                        >
                          {morning.map((s) => (
                            <TimeSlot
                              key={s.startsAt + s.staffId}
                              time={s.label}
                              subLabel={
                                flow.startsAt === s.startsAt
                                  ? "Held for you"
                                  : endShort(s)
                              }
                              selected={flow.startsAt === s.startsAt}
                              onSelect={() => onSlot(s)}
                            />
                          ))}
                        </TimeSlotGroup>
                      ) : null}
                      {afternoon.length ? (
                        <TimeSlotGroup
                          partLabel="Afternoon"
                          countLabel={`${afternoon.length} times`}
                          groupLabel={`Afternoon times on ${dateLabel(date)}`}
                        >
                          {afternoon.map((s) => (
                            <TimeSlot
                              key={s.startsAt + s.staffId}
                              time={s.label}
                              subLabel={
                                flow.startsAt === s.startsAt
                                  ? "Held for you"
                                  : endShort(s)
                              }
                              selected={flow.startsAt === s.startsAt}
                              onSelect={() => onSlot(s)}
                            />
                          ))}
                        </TimeSlotGroup>
                      ) : null}
                    </>
                  )}
                </div>
                {fullDay ? (
                  <div className="sl-b-hint">
                    <b>N</b>&nbsp; {dateLabel(fullDay.date)} is full with{" "}
                    {barber?.name}.{" "}
                    <Link
                      href={`${flow.base}/book/time?service=${serviceId}&barber=any&date=${fullDay.date}`}
                    >
                      See times with any barber
                    </Link>
                  </div>
                ) : null}
              </div>
              <div className="sl-b-side">
                <FlowSummary
                  ctaLabel="Continue to your details"
                  ctaHref={
                    flow.startsAt
                      ? `${flow.base}/book/details${q}`
                      : undefined
                  }
                />
              </div>
            </div>
          </>
        )}
      </div>
      <div className="sl-b-phonebar">
        <div className="sl-b-phonebar__in">
          <div className="sl-b-phonebar__row">
            {flow.startsAt && mins ? (
              <div className="sl-b-phonebar__hold">
                <svg width="44" height="44" viewBox="0 0 56 56" aria-hidden="true" style={{ flex: "none" }}>
                  <circle cx="28" cy="28" r="24" fill="none" stroke="#5A3A34" strokeWidth="6" />
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    fill="none"
                    stroke="#F2C9C2"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray="150.8"
                    strokeDashoffset={150.8 * (1 - holdProgress)}
                    transform="rotate(-90 28 28)"
                  />
                </svg>
                <div>
                  <div className="sl-b-phonebar__holdlabel">Held for you for</div>
                  <div className="sl-b-phonebar__count">{mins}</div>
                </div>
              </div>
            ) : null}
            <div className="sl-b-phonebar__slot">
              <div className="sl-b-phonebar__when">
                {flow.startsAt && flow.timeLabel
                  ? `${shortDate(flow.date)} · ${flow.timeLabel}`
                  : shortDate(date)}
              </div>
              <div className="sl-b-phonebar__money">
                {svc && svc.depositCents > 0
                  ? `${formatCents(svc.depositCents)} deposit due at the shop · `
                  : ""}
                {svc ? `${formatCents(svc.priceCents)} total` : ""}
              </div>
            </div>
          </div>
          <Button
            variant="linen"
            style={{ width: "100%", marginTop: 14, height: 52 }}
            disabled={!flow.startsAt}
            onClick={() => router.push(`${flow.base}/book/details${q}`)}
          >
            Continue
          </Button>
          <p className="sl-b-phonebar__cancel">
            {flow.catalog.policy
              ? `Free to cancel up to ${flow.catalog.policy.freeCancelHours} hours before`
              : "Free to cancel before your visit"}
          </p>
        </div>
      </div>
    </FlowShell>
  );
}

export default function TimePage() {
  return (
    <Suspense>
      <TimeInner />
    </Suspense>
  );
}
