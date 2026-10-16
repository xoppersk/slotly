"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BookingShell, StepHeading } from "@/components/sl/shells/BookingShell";
import { DayTile } from "@/components/sl/DayTile";
import { TimeSlot, TimeSlotGroup } from "@/components/sl/TimeSlot";
import { Button, ButtonLink } from "@/components/sl/Button";
import { IconChevronLeft } from "@/components/sl/icons";
import { availability, formatWholeDollars, getBarber, getDayAvailability, getService, getSlotEndLabel, getWeekAvailability } from "@/lib/api";
import { subscribeSlotEvents } from "@/lib/events";
import { BASE, flowQuery, stepHrefs, useBookingFlow } from "../../_flow/BookingFlow";
import { FlowSummary, dateLabel, shortDate } from "../../_flow/Summary";

/* ---------- F-07 Fully booked ---------- */
function FullyBooked({ serviceId }: { barberId: string; serviceId: string }) {
  const fb = availability.fullyBooked; const router = useRouter(); const flow = useBookingFlow();
  return (
    <BookingShell manageHref="/b/harbor-and-pine/manage/demo-token">
      <div className="sl-b-main" style={{ maxWidth: 760 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--oxblood)" }}>Wednesday, October 7 · Signature haircut with Micah</p>
        <h1 className="sl-b-moment" style={{ marginTop: 10 }}>Wednesday is full. We can keep an eye out.</h1>
        <p className="sl-b-lead">Every time with Micah is booked that day. Join the waitlist and we&rsquo;ll email you if one opens, or take the next opening.</p>
        <div className="sl-b-card" style={{ marginTop: 28 }}>
          <dl className="sl-b-kv">
            <dt>Next with Micah</dt><dd>Thu, Oct 8 · 9:00 AM</dd>
            <dt>Same day, Nia</dt><dd>4 times open</dd>
            <dt>Waitlist</dt><dd>2 people ahead</dd>
          </dl>
          <div className="sl-b-actions">
            <Button variant="primary" onClick={() => { flow.setFlow({ date: "2026-10-08", barberId: "micah", barberTouched: true }); flow.startHold("9:00 AM"); router.push(`${BASE}/book/details${flowQuery({ serviceId, barberId: "micah", date: "2026-10-08", time: "9:00 AM" })}`); }}>Book Thursday at 9:00 AM</Button>
            <Button>Join Wednesday&rsquo;s waitlist</Button>
            <ButtonLink href={`${BASE}/book/time?service=${serviceId}&barber=nia&date=2026-10-07`}>See Nia&rsquo;s times</ButtonLink>
          </div>
          <p style={{ marginTop: 14, fontSize: 13, color: "var(--muted)" }}>{fb.waitlistLine}</p>
        </div>
      </div>
    </BookingShell>
  );
}

/* ---------- F-08 Booking conflict ---------- */
function Conflict({ serviceId, barberId }: { serviceId: string; barberId: string }) {
  const flow = useBookingFlow(); const router = useRouter();
  const { setFlow } = flow;
  // Clear the expired hold once on mount, so going back to the Time page
  // does not instantly re-trigger the expiry watcher; picking a time below
  // starts a fresh hold via startHold().
  const clearedRef = useRef(false);
  useEffect(() => {
    if (clearedRef.current) return;
    clearedRef.current = true;
    setFlow({ holdExpiresAt: null, holdTime: null });
  }, [setFlow]);
  const day = getDayAvailability(barberId === "any" ? "micah" : barberId, "2026-10-08");
  const still = (day?.slots ?? []).filter((t) => t !== "9:00 AM");
  const [pick, setPick] = useState("9:45 AM");
  return (
    <BookingShell manageHref="/b/harbor-and-pine/manage/demo-token">
      <div className="sl-b-main" style={{ maxWidth: 760 }}>
        <h1 className="sl-b-moment">Your hold ran out</h1>
        <p className="sl-b-lead">Someone booked 9:00 AM just ahead of you. Your details are saved and nothing was charged. Pick another time with Micah on Thursday and we&rsquo;ll hold it while you finish.</p>
        <div className="sl-b-card" style={{ marginTop: 28 }}>
          <dl className="sl-b-kv">
            <dt>You picked</dt><dd>9:00 AM</dd>
            <dt>Next opening</dt><dd>9:45 AM</dd>
            <dt>Your details</dt><dd>Saved</dd>
          </dl>
          <h2 style={{ font: "600 18px/1.3 var(--font-display)", margin: "24px 0 12px" }}>Still open Thursday, October 8</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }} role="group" aria-label="Still open times on Thursday, October 8">
            {still.slice(0, 5).map((t) => <TimeSlot key={t} time={t} selected={pick === t} onSelect={() => setPick(t)} />)}
          </div>
          <div className="sl-b-actions">
            <Button variant="primary" onClick={() => { flow.setFlow({ date: "2026-10-08" }); flow.startHold(pick); router.push(`${BASE}/book/review${flowQuery({ serviceId, barberId, date: "2026-10-08", time: pick })}`); }}>Hold {pick} and continue</Button>
            <ButtonLink href={`${BASE}/book/time${flowQuery({ serviceId, barberId })}`}>Pick another day</ButtonLink>
          </div>
        </div>
      </div>
    </BookingShell>
  );
}

/* The day's 45-minute grid, 9:00 AM – 5:15 PM starts (12 blocks, Main.html). */
const TIMELINE_GRID = ["9:00 AM", "9:45 AM", "10:30 AM", "11:15 AM", "12:00 PM", "12:45 PM", "1:30 PM", "2:15 PM", "3:00 PM", "3:45 PM", "4:30 PM", "5:15 PM"] as const;

/* ---------- P-04 Choose a time ---------- */
function TimeInner() {
  const sp = useSearchParams(); const router = useRouter(); const flow = useBookingFlow();
  const stateParam = sp.get("state");
  const serviceId = sp.get("service") ?? flow.serviceId;
  const barberId = sp.get("barber") ?? flow.barberId;
  const svc = getService(serviceId); const barber = getBarber(barberId);
  const weekBarber = barberId === "any" ? "any" : barberId;
  const week = getWeekAvailability(weekBarber);
  const [date, setDate] = useState(sp.get("date") ?? flow.date ?? "2026-10-08");
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [announce, setAnnounce] = useState("");
  const day = getDayAvailability(weekBarber, date);
  const slots = useMemo(() => (day?.slots ?? []).filter((t) => !taken.has(`${date}|${t}`)), [day, taken, date]);
  const morning = slots.filter((t) => t.includes("AM"));
  const afternoon = slots.filter((t) => t.includes("PM"));

  useEffect(() => subscribeSlotEvents((e) => {
    if (e.date === date && (e.barberId === barberId || barberId === "any")) {
      setTaken((s) => new Set(s).add(`${e.date}|${e.time}`)); setAnnounce(e.message);
    }
  }), [date, barberId]);

  // SL-05 narrative: on the main (non-state) view, once hydration completes
  // and no hold is on record, seed the drawn 9:00 AM / Thu Oct 8 hold.
  // ensureNarrativeHold is idempotent and a no-op when a hold exists
  // (active or expired), so this fires safely once per mount.
  const narrativeRef = useRef(false);
  const { hydrated, ensureNarrativeHold } = flow;
  useEffect(() => {
    if (!hydrated || stateParam || narrativeRef.current) return;
    narrativeRef.current = true;
    ensureNarrativeHold();
  }, [hydrated, stateParam, ensureNarrativeHold]);

  // Hold expiry -> F-08
  useEffect(() => { if (flow.secondsLeft === 0 && flow.holdTime) router.push(`${BASE}/book/time?state=conflict`); }, [flow.secondsLeft, flow.holdTime, router]);

  if (stateParam === "full") return <FullyBooked barberId={barberId} serviceId={serviceId} />;
  if (stateParam === "conflict") return <Conflict serviceId={serviceId} barberId={barberId} />;

  const onDay = (d: (typeof week)[number]) => {
    if (d.state === "full") { router.push(`${BASE}/book/time?state=full&service=${serviceId}&barber=${barberId}`); return; }
    setDate(d.date); flow.setFlow({ date: d.date, serviceId, barberId });
  };
  const onSlot = (t: string) => { flow.setFlow({ serviceId, barberId, date }); flow.startHold(t); };
  const q = flowQuery({ serviceId, barberId, date, time: flow.time });
  const mins = flow.secondsLeft !== null ? `${Math.floor(flow.secondsLeft / 60)}:${String(flow.secondsLeft % 60).padStart(2, "0")}` : null;
  const weekday = dateLabel(date).split(",")[0];
  const isPickDay = date === flow.date;
  const bookedPhrases = (day?.bookedBlocks ?? []).map((b) => b.replace(/ (AM|PM) – /g, " to ").replace(/ (AM|PM)$/, ""));
  const timelineLabel = `${weekday} 9 AM to 6 PM${bookedPhrases.length ? `: booked ${bookedPhrases.join(" and ")}` : ""}${isPickDay && flow.time ? `; your pick is ${flow.time}` : ""}`;
  const holdProgress = flow.secondsLeft !== null ? Math.min(1, Math.max(0, flow.secondsLeft / 600)) : 0;

  return (
    <BookingShell step={3} stepHrefs={stepHrefs(flow)} manageHref="/b/harbor-and-pine/manage/demo-token" className="sl-b-timepage">
      {/* Phone top bar (MainPhone): chevron + H&P mark + name + "3 of 6",
          with the drawn 6-segment progress row underneath (first 3 filled). */}
      <div className="sl-b-topphone">
        <div className="sl-b-topphone__row">
          <Link href={`${BASE}/book/barber${q}`} aria-label="Back"><IconChevronLeft /></Link>
          <span className="sl-b-topphone__brand" aria-hidden="true">H&amp;P</span>
          <b style={{ flex: 1 }}>{`Harbor & Pine`}</b>
          <span className="sl-b-topphone__step">3 of 6</span>
        </div>
        <div className="sl-b-topphone__segs" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <i key={i} className={i < 2 ? "sl-b-seg--done" : i === 2 ? "sl-b-seg--cur" : undefined} />
          ))}
        </div>
      </div>
      <div className="sl-b-main">
        <StepHeading step={3} title="Choose a time" />
        <p className="sl-b-lead"><span className="sl-b-opt__avatar" style={{ display: "inline-grid", width: 28, height: 28, fontSize: 13, verticalAlign: "middle", marginRight: 8 }}>{barber?.initial ?? "A"}</span>{barberId === "any" ? "Any barber" : barber?.name} · {svc?.name} · {svc?.durationMinutes} min · <Link href={`${BASE}/book/barber${q}`}>Change barber</Link></p>
        {/* Phone-only summary line + month row (MainPhone artboard); the
            desktop lead / week nav are hidden at <=700px instead. */}
        <p className="sl-b-phone-lead"><span className="sl-b-opt__avatar" style={{ display: "inline-grid", width: 28, height: 28, fontSize: 13, flex: "none" }}>{barber?.initial ?? "A"}</span><span>{svc?.name}, {svc?.durationMinutes} min, with {barberId === "any" ? "any barber" : barber?.name}</span></p>
        <div className="sl-b-weeknav"><b>&lsaquo;&nbsp; Oct 4 – 10, 2026 &nbsp;&rsaquo;</b><span style={{ fontSize: 13, color: "var(--muted)" }}>Times in Eastern (Philadelphia)</span></div>
        <div className="sl-b-phone-month"><h2>{new Date(`${date}T12:00:00`).toLocaleString("en-US", { month: "long" })} {date.slice(0, 4)}</h2><span>Eastern time</span></div>
        <div className="sl-b-days-scroll sl-days" style={{ display: undefined }}>
          {week.map((d) => (
            <DayTile key={d.date} weekday={d.weekday} dayNumber={d.dayNumber} openCount={d.openCount} totalSlots={12}
              state={d.state === "past" ? "past" : d.state === "full" ? "full" : d.state === "away" ? "closed" : "open"}
              selected={date === d.date} onSelect={() => onDay(d)} />
          ))}
        </div>

        <div className="sl-b-grid">
          <div>
            {/* SL-09 timeline as drawn (Main.html): header row with the
                "{Barber}'s {Weekday} · N of 12 times open" line + 3-swatch
                legend, then 12 discrete 45-minute blocks on a white track. */}
            <div className="sl-b-timeline-wrap">
              <div className="sl-b-timeline-head">
                <h2 className="sl-b-timeline-title"><b>{barberId === "any" ? "The shop" : `${barber?.name}’s`} {weekday}</b> · {slots.length} of 12 times open</h2>
                <div className="sl-b-legend">
                  <span><i className="sl-b-swatch sl-b-swatch--open" aria-hidden="true" />Open</span>
                  <span><i className="sl-b-swatch sl-b-swatch--booked" aria-hidden="true" />Booked</span>
                  <span><i className="sl-b-swatch sl-b-swatch--pick" aria-hidden="true" />Your pick</span>
                </div>
              </div>
              <div className="sl-b-timeline" role="img" aria-label={timelineLabel}>
                {TIMELINE_GRID.map((t, i) => {
                  const kind = isPickDay && flow.time === t ? "pick" : slots.includes(t) ? "open" : "booked";
                  return <i key={t} className={`sl-b-timeline__block sl-b-timeline__block--${kind}`} style={{ left: `${0.6 + i * 8.33}%` }} />;
                })}
              </div>
              <div className="sl-b-timeline__labels" aria-hidden="true">
                <span style={{ left: 0 }}>9 AM</span>
                <span style={{ left: "22.2%" }}>11</span>
                <span style={{ left: "44.4%" }}>1 PM</span>
                <span style={{ left: "66.7%" }}>3</span>
                <span style={{ right: 0 }}>6 PM</span>
              </div>
            </div>

            <div style={{ marginTop: 28, display: "grid", gap: 26 }}>
              {morning.length ? <TimeSlotGroup partLabel="Morning" countLabel={`${morning.length} times`} groupLabel={`Morning times on ${dateLabel(date)}`}>{morning.map((t) => <TimeSlot key={t} time={t} subLabel={flow.time === t ? "Held for you" : getSlotEndLabel(t, svc?.durationMinutes ?? 45)} selected={flow.time === t} onSelect={() => onSlot(t)} />)}</TimeSlotGroup> : null}
              {afternoon.length ? <TimeSlotGroup partLabel="Afternoon" countLabel={`${afternoon.length} times`} groupLabel={`Afternoon times on ${dateLabel(date)}`}>{afternoon.map((t) => <TimeSlot key={t} time={t} subLabel={t === "5:15 PM" ? "last chair" : getSlotEndLabel(t, svc?.durationMinutes ?? 45)} selected={flow.time === t} onSelect={() => onSlot(t)} />)}</TimeSlotGroup> : null}
            </div>
            <div className="sl-b-hint"><b>N</b>&nbsp; Wednesday is full with Micah. Nia has 4 times open that day. <Link href={`${BASE}/book/time?service=${serviceId}&barber=any&date=2026-10-07`}>See times with any barber</Link></div>
            <span className="sl-sr-only" aria-live="polite">{announce}</span>
          </div>
          <div className="sl-b-side"><FlowSummary ctaLabel="Continue to your details" ctaHref={flow.time ? `${BASE}/book/details${q}` : undefined} /></div>
        </div>
      </div>
      {/* Phone sticky bottom bar (MainPhone): dark bar with the hold ring +
          countdown, the held slot, whole-dollar total, linen Continue. */}
      <div className="sl-b-phonebar">
        <div className="sl-b-phonebar__in">
          <div className="sl-b-phonebar__row">
            {flow.time && mins ? (
              <div className="sl-b-phonebar__hold">
                <svg width="44" height="44" viewBox="0 0 56 56" aria-hidden="true" style={{ flex: "none" }}>
                  <circle cx="28" cy="28" r="24" fill="none" stroke="#5A3A34" strokeWidth="6" />
                  <circle cx="28" cy="28" r="24" fill="none" stroke="#F2C9C2" strokeWidth="6" strokeLinecap="round" strokeDasharray="150.8" strokeDashoffset={150.8 * (1 - holdProgress)} transform="rotate(-90 28 28)" />
                </svg>
                <div>
                  <div className="sl-b-phonebar__holdlabel">Held for you for</div>
                  <div className="sl-b-phonebar__count">{mins}</div>
                </div>
              </div>
            ) : null}
            <div className="sl-b-phonebar__slot">
              <div className="sl-b-phonebar__when">{flow.time ? `${shortDate(flow.date)} · ${flow.time}` : shortDate(date)}</div>
              <div className="sl-b-phonebar__money">$20 deposit{svc ? ` · ${formatWholeDollars(svc.priceCents)} total` : ""}</div>
            </div>
          </div>
          <Button variant="linen" style={{ width: "100%", marginTop: 14, height: 52 }} disabled={!flow.time} onClick={() => router.push(`${BASE}/book/details${q}`)}>Continue</Button>
          <p className="sl-b-phonebar__cancel">Free to cancel until Wed 9:00 AM</p>
        </div>
      </div>
    </BookingShell>
  );
}
export default function TimePage() { return <Suspense><TimeInner /></Suspense>; }
