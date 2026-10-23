"use client";

import { useEffect, useState } from "react";
import { HoldRing } from "@/components/sl/icons";

/* F-01 hero mini time picker — LIVE: days and slots come from the real
   public availability API (PostgreSQL `get_availability` RPC via
   /api/public/availability) for the featured business's first service.
   Picking a slot starts the drawn 9:58 hold countdown (UI demo of the
   hold; the real hold is created in the booking flow). No fixture data. */

const TOTAL_SEGMENTS = 12;
const HOLD_SECONDS = 9 * 60 + 58;

export interface MiniPickerDemo {
  businessId: string;
  serviceId: string;
  serviceName: string;
  businessName: string;
  staffName: string | null;
  bookingHref: string;
}

interface ApiSlot {
  label: string;
}
interface ApiDay {
  date: string;
  slots: ApiSlot[];
}
interface PickerDay {
  date: string;
  dayNumber: number;
  openCount: number;
  slots: string[];
}

function weekdayShort(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

export function MiniPicker({ demo }: { demo: MiniPickerDemo | null }) {
  const [days, setDays] = useState<PickerDay[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [day, setDay] = useState<PickerDay | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(HOLD_SECONDS);

  useEffect(() => {
    if (!demo) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/public/availability?businessId=${demo.businessId}&serviceId=${demo.serviceId}&staffId=any`,
        );
        if (!res.ok) throw new Error(`availability ${res.status}`);
        const json = (await res.json()) as { days?: ApiDay[] };
        const mapped: PickerDay[] = (json.days ?? [])
          .map((d) => ({
            date: d.date,
            dayNumber: Number(d.date.slice(8, 10)),
            openCount: d.slots.length,
            slots: d.slots.map((s) => s.label),
          }))
          .filter((d) => d.slots.length > 0)
          .slice(0, 5);
        if (cancelled) return;
        setDays(mapped);
        setDay(mapped[0] ?? null);
        setSlot(mapped[0]?.slots[0] ?? null);
        setSecondsLeft(HOLD_SECONDS);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demo]);

  useEffect(() => {
    if (!slot) return;
    const id = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [slot, day]);

  const headLine = demo ? `${demo.serviceName} · ${demo.staffName ?? demo.businessName}` : null;

  if (!demo || failed || (days !== null && (days.length === 0 || day === null))) {
    return (
      <div className="sl-card sl-pick">
        <div className="sl-pick__head">
          <b>Choose a time</b>
          {headLine ? <span>{headLine}</span> : null}
        </div>
        <p style={{ margin: 0 }}>
          {failed || !demo
            ? "Live times are on the booking page."
            : "No open times in the next few days — the booking page has the latest."}{" "}
          <a href={demo?.bookingHref ?? "/b/harbor-and-pine"} className="sl-mk-line">
            See the live booking page
          </a>
        </p>
      </div>
    );
  }

  if (days === null || day === null) {
    return (
      <div className="sl-card sl-pick">
        <div className="sl-pick__head">
          <b>Choose a time</b>
          {headLine ? <span>{headLine}</span> : null}
        </div>
        <p style={{ margin: 0 }}>Loading live times…</p>
      </div>
    );
  }

  const pickDay = (d: PickerDay) => {
    setDay(d);
    setSlot(d.slots[0] ?? null);
    setSecondsLeft(HOLD_SECONDS);
  };

  const pickSlot = (s: string) => {
    setSlot(s);
    setSecondsLeft(HOLD_SECONDS);
  };

  const shownSlots = day.slots.slice(0, 6);
  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="sl-card sl-pick">
      <div className="sl-pick__head">
        <b>Choose a time</b>
        <span>{headLine}</span>
      </div>
      <div className="sl-pick-days" role="group" aria-label="Choose a day">
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            className="sl-pick-day"
            aria-pressed={d.date === day.date}
            aria-label={`${weekdayShort(d.date)} ${d.dayNumber}, ${d.openCount} open`}
            onClick={() => pickDay(d)}
          >
            <span className="dw">{weekdayShort(d.date)}</span>
            <span className="dn">{d.dayNumber}</span>
            <span className="bar" aria-hidden="true">
              {Array.from({ length: TOTAL_SEGMENTS }, (_, i) => (
                <i key={i} className={i < Math.min(d.openCount, TOTAL_SEGMENTS) ? "o" : undefined} />
              ))}
            </span>
          </button>
        ))}
      </div>
      <div className="sl-pick-slots" role="group" aria-label="Choose a time">
        {shownSlots.map((s) => (
          <button
            key={s}
            type="button"
            className="sl-pick-slot"
            aria-pressed={s === slot}
            onClick={() => pickSlot(s)}
          >
            {s}
          </button>
        ))}
      </div>
      {slot ? (
        <div className="sl-pick-hold">
          <HoldRing size={46} fraction={secondsLeft / HOLD_SECONDS} />
          <span>Holding {slot} for you</span>
          <b>
            {mm}:{ss}
          </b>
        </div>
      ) : null}
    </div>
  );
}
