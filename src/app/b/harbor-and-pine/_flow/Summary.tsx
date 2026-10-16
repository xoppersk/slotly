"use client";
import type { ReactNode } from "react";
import { VisitSummary, type VisitRow } from "@/components/sl/VisitSummary";
import { HoldTimer } from "@/components/sl/HoldTimer";
import { ButtonLink } from "@/components/sl/Button";
import { getBarber, getService } from "@/lib/api";
import { BASE, POLICY_LINE, flowQuery, useBookingFlow } from "./BookingFlow";

export function dateLabel(iso: string): string {
  const map: Record<string, string> = { "2026-10-06": "Tuesday, October 6", "2026-10-07": "Wednesday, October 7", "2026-10-08": "Thursday, October 8", "2026-10-09": "Friday, October 9", "2026-10-10": "Saturday, October 10" };
  return map[iso] ?? iso;
}
export function shortDate(iso: string): string {
  const map: Record<string, string> = { "2026-10-06": "Tue, Oct 6", "2026-10-07": "Wed, Oct 7", "2026-10-08": "Thu, Oct 8", "2026-10-09": "Fri, Oct 9", "2026-10-10": "Sat, Oct 10" };
  return map[iso] ?? iso;
}
export function endTime(start: string, dur: number): string {
  const m = /^(\d+):(\d+) (AM|PM)$/.exec(start); if (!m) return "";
  let h = Number(m[1]) % 12; if (m[3] === "PM") h += 12;
  const t = h * 60 + Number(m[2]) + dur; const eh = Math.floor(t / 60) % 24; const em = t % 60;
  const ap = eh >= 12 ? "PM" : "AM"; const h12 = eh % 12 === 0 ? 12 : eh % 12;
  return `${h12}:${String(em).padStart(2, "0")} ${ap}`;
}

export function FlowSummary({ ctaLabel, ctaHref, ctaNode, showFor = false, barberNextStep = false }: { ctaLabel?: string; ctaHref?: string; ctaNode?: ReactNode; showFor?: boolean; barberNextStep?: boolean }) {
  const flow = useBookingFlow();
  const svc = getService(flow.serviceId); const barber = getBarber(flow.barberId);
  const q = flowQuery(flow);
  const rows: VisitRow[] = [
    { label: "Service", value: svc?.name, sub: svc ? `${svc.durationMinutes} minutes` : undefined, changeHref: `${BASE}/book/service${q}` },
    barberNextStep
      ? { label: "Barber", placeholder: "Next step", changeHref: `${BASE}/book/barber${q}` }
      : { label: "Barber", value: flow.barberId === "any" ? "Any barber" : barber?.name, changeHref: `${BASE}/book/barber${q}` },
    { label: "When", value: flow.time ? dateLabel(flow.date) : undefined, sub: flow.time && svc ? `${flow.time} – ${endTime(flow.time, svc.durationMinutes)}` : undefined, placeholder: "Not chosen yet", changeHref: `${BASE}/book/time${q}` },
  ];
  if (showFor) rows.push({ label: "For", value: `${flow.details.firstName} ${flow.details.lastName}`, sub: flow.details.email, changeHref: `${BASE}/book/details${q}` });
  const secs = flow.secondsLeft;
  return (
    <VisitSummary rows={rows} serviceName={svc?.name} priceCents={svc?.priceCents} depositCents={2000}
      hold={flow.holdTime && secs !== null && secs > 0 ? <HoldTimer key={`${flow.holdTime}|${flow.holdExpiresAt}`} time={flow.holdTime} initialSeconds={Math.max(1, secs)} onDark /> : undefined}
      cta={ctaNode ?? (ctaLabel && ctaHref ? <ButtonLink variant="linen" href={ctaHref}>{ctaLabel}</ButtonLink> : undefined)}
      policyLine={POLICY_LINE} />
  );
}
