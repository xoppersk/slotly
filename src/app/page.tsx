"use client";

import { useEffect, useMemo, useState } from "react";
import "../styles/site.css";
import { SiteChrome } from "./pricing/_chrome";
import { HoldRing, IconArrowRight } from "@/components/sl/icons";
import { getDayAvailability, getService, getWeekAvailability } from "@/lib/api";
import type { AvailabilityDay } from "@/lib/types";

/* F-01 — Marketing. Hero at the screen's drawn 80px Bricolage (screens win
   over the brief's type table — BUILD-LOG), with the LIVE mini time picker:
   days and slots come from the Harbor & Pine fixture for Micah, slots are
   selectable, and picking one starts the drawn 9:58 hold countdown. */

const TOTAL_SEGMENTS = 12;
const HOLD_SECONDS = 9 * 60 + 58;

function weekdayShort(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

function MiniPicker() {
  const days = useMemo(
    () => getWeekAvailability("micah").filter((d) => d.date >= "2026-10-06" && d.date <= "2026-10-10"),
    [],
  );
  const [day, setDay] = useState<AvailabilityDay>(() => getDayAvailability("micah", "2026-10-08")!);
  const [slot, setSlot] = useState<string | null>("9:00 AM");
  const [secondsLeft, setSecondsLeft] = useState(HOLD_SECONDS);

  useEffect(() => {
    if (!slot) return;
    setSecondsLeft(HOLD_SECONDS);
    const id = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [slot, day]);

  const pickDay = (d: AvailabilityDay) => {
    setDay(d);
    setSlot(d.slots[0] ?? null);
  };

  const shownSlots = day.slots.slice(0, 6);
  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="sl-card sl-pick">
      <div className="sl-pick__head">
        <b>Choose a time</b>
        <span>{getService("signature-haircut")!.name} · Micah</span>
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
                <i key={i} className={i < d.openCount ? "o" : undefined} />
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
            onClick={() => setSlot(s)}
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

const PRINCIPLES = [
  {
    n: "01",
    title: "One decision per step",
    body: "Service, then person, then time. Customers never see a time that can’t be booked, and the slot they pick is held while they finish.",
  },
  {
    n: "02",
    title: "Deposits that explain themselves",
    body: "Set one deposit and one cancellation window. Customers see both on every step, so nobody is surprised by what they lose.",
  },
  {
    n: "03",
    title: "A day sheet, not a calendar puzzle",
    body: "Who’s in the chair, who’s next, where the gaps are. Check in, finish and take payment from one list.",
  },
];

const STEPS = [
  { title: "Name your business", sub: "Address, phone, time zone" },
  { title: "Add your services", sub: "Length and price for each" },
  { title: "Set your hours", sub: "Weekly hours, breaks and days off" },
  { title: "Share your link", sub: "Put it in your bio, your texts and your window" },
];

const UP_NEXT = [
  { time: "9:45 AM", initial: "S", name: "Sam Ortiz", sub: "Skin fade · Micah", chip: "In the chair", kind: "chair" },
  { time: "10:30 AM", initial: "M", name: "Morgan Reed", sub: "Cut + beard · Nia", chip: "Arrived", kind: "arr" },
  { time: "10:45 AM", initial: "L", name: "Leo Park", sub: "Signature haircut · Micah", chip: "Upcoming", kind: "up" },
] as const;

export default function MarketingPage() {
  return (
    <SiteChrome>
      <section className="sl-wrap sl-mk-hero">
        <div>
          <p className="sl-mk-eyebrow">For barbershops, salons and studios</p>
          <h1 className="sl-mk-h1">
            Fill the chair.
            <br />
            Skip the phone tag.
          </h1>
          <p className="sl-mk-lead">
            A booking page where customers pick a service, a person and a time in about a minute, a deposit that stops
            no-shows, and a day sheet your team can run from their phones.
          </p>
          <div className="sl-mk-hero-ctas">
            <a href="/sign-up" className="sl-mk-cta">
              Start free <IconArrowRight />
            </a>
            <a href="/b/harbor-and-pine" className="sl-mk-line">
              See a live booking page
            </a>
          </div>
          <p className="sl-mk-hero-note">Free for one person. No card needed to start.</p>
        </div>
        <MiniPicker />
      </section>

      <section className="sl-wrap sl-mk-principles">
        {PRINCIPLES.map((p) => (
          <div key={p.n} className="sl-card sl-mk-principle">
            <span className="sl-mk-num">{p.n}</span>
            <h2>{p.title}</h2>
            <p>{p.body}</p>
          </div>
        ))}
      </section>

      <section className="sl-mk-band">
        <div className="sl-wrap sl-mk-setup">
          <div className="sl-mk-stage sl-mk-stage--linen" style={{ padding: 44 }}>
            <div className="sl-card sl-upnext">
              <div className="sl-upnext__head">
                <b>Up next</b>
                <span>Thu, Oct 8 · 10:40 AM</span>
              </div>
              {UP_NEXT.map((r) => (
                <div key={r.time} className="sl-upnext__row">
                  <span className="tm">{r.time}</span>
                  <span className="sl-mono" aria-hidden="true">
                    {r.initial}
                  </span>
                  <span className="who">
                    <b>{r.name}</b>
                    <span>{r.sub}</span>
                  </span>
                  <span className={`sl-chip sl-chip--${r.kind}`}>
                    {r.kind === "arr" ? <i aria-hidden="true" /> : null}
                    {r.chip}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2>Set up before your next appointment</h2>
            <ol className="sl-mk-steps">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="sl-mk-num n">{i + 1}</span>
                  <span>
                    <b>{s.title}</b>
                    <small>{s.sub}</small>
                  </span>
                </li>
              ))}
            </ol>
            <a href="/sign-up" className="sl-mk-cta" style={{ marginTop: 32 }}>
              Start free <IconArrowRight />
            </a>
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
