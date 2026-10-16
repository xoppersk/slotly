"use client";
import { useEffect, useRef, useState } from "react";
import { HoldRing } from "./icons";

export interface HoldTimerProps {
  /** Slot being held: "9:00 AM". */
  time: string;
  /** Seconds remaining at mount; counts down from 600 (10:00) by default. */
  initialSeconds?: number;
  /** Style on a dark ink panel (ring variant from Main.html). */
  onDark?: boolean;
  onExpire?: () => void;
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(Math.max(0, totalSeconds) / 60);
  const s = Math.max(0, totalSeconds) % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** HoldTimer — "We're holding 9:00 AM for you · 9:58 left" on --hold.
    aria-live="polite" summary announces at 5:00, 1:00 and on expiry only
    (HANDOVER §11) — never every second. */
export function HoldTimer({ time, initialSeconds = 600, onDark = false, onExpire }: HoldTimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [announcement, setAnnouncement] = useState("");
  const announced = useRef<Set<string>>(new Set());
  const expired = useRef(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setSeconds((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(id);
  }, [seconds > 0]);

  useEffect(() => {
    const marks: [number, string][] = [
      [300, `Five minutes left on your hold for ${time}.`],
      [60, `One minute left on your hold for ${time}.`],
    ];
    for (const [mark, text] of marks) {
      if (seconds === mark && !announced.current.has(text)) {
        announced.current.add(text);
        setAnnouncement(text);
      }
    }
    if (seconds === 0 && !expired.current) {
      expired.current = true;
      setAnnouncement(`Your hold for ${time} has ended.`);
      onExpire?.();
    }
  }, [seconds, time, onExpire]);

  if (seconds <= 0) {
    return (
      <div className="sl-hold sl-hold--expired" role="status">
        <span>Your hold for {time} ended</span>
        <span className="sl-sr-only" aria-live="polite">{announcement}</span>
      </div>
    );
  }

  if (onDark) {
    /* Drawn dark form (Main/Details/Payment/Review.html): the real 56px
       progress ring inside the #3A2420 sub-panel — 13px line over a 30px
       display numeral with a small "left". Presentation only; the
       countdown and expiry behaviour above are unchanged. */
    return (
      <div className="sl-hold sl-hold--panel">
        <HoldRing size={56} fraction={seconds / Math.max(1, initialSeconds)} />
        <div className="sl-hold__text">
          <div className="sl-hold__line">We&rsquo;re holding {time} for you</div>
          <div className="sl-hold__clock">{formatClock(seconds)} <span>left</span></div>
        </div>
        <span className="sl-sr-only" aria-live="polite">{announcement}</span>
      </div>
    );
  }

  return (
    <div className="sl-hold">
      <span>We&rsquo;re holding {time} for you</span>
      <b>{formatClock(seconds)} left</b>
      <span className="sl-sr-only" aria-live="polite">{announcement}</span>
    </div>
  );
}
