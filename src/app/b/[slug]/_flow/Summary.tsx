"use client";
import type { ReactNode } from "react";
import { VisitSummary, type VisitRow } from "@/components/sl/VisitSummary";
import { HoldTimer } from "@/components/sl/HoldTimer";
import { ButtonLink } from "@/components/sl/Button";
import {
  dateLabel,
  endTimeLabel,
  freeCancelLabel,
} from "../_lib/types";
import { flowQuery, useBookingFlow } from "./BookingFlow";

export { dateLabel, shortDate, endTimeLabel as endTime } from "../_lib/types";

/**
 * The dark sticky "Your visit" panel, fed entirely by the live catalog +
 * the customer's real selection. Policy line: free changes until
 * (slot start − business.free_cancel_hours) once a slot is chosen; before
 * that, the business's free-cancel window stated generically.
 */
export function FlowSummary({
  ctaLabel,
  ctaHref,
  ctaNode,
  showFor = false,
  barberNextStep = false,
}: {
  ctaLabel?: string;
  ctaHref?: string;
  ctaNode?: ReactNode;
  showFor?: boolean;
  barberNextStep?: boolean;
}) {
  const flow = useBookingFlow();
  const svc = flow.service;
  const barber = flow.barber;
  const tz = flow.catalog.business.timezone;
  const policy = flow.catalog.policy;
  const q = flowQuery(flow);
  const base = flow.base;

  const slotStaffName =
    flow.barberId === "any"
      ? flow.slotStaffId
        ? flow.catalog.staff.find((s) => s.id === flow.slotStaffId)?.name
        : undefined
      : barber?.name;

  const rows: VisitRow[] = [
    {
      label: "Service",
      value: svc?.name,
      sub: svc ? `${svc.durationMinutes} minutes` : undefined,
      changeHref: `${base}/book/service${q}`,
    },
    barberNextStep
      ? { label: "Barber", placeholder: "Next step", changeHref: `${base}/book/barber${q}` }
      : {
          label: "Barber",
          value:
            flow.barberId === "any"
              ? slotStaffName
                ? `${slotStaffName} (first available)`
                : "Any barber"
              : barber?.name,
          changeHref: `${base}/book/barber${q}`,
        },
    {
      label: "When",
      value: flow.startsAt ? dateLabel(flow.date) : undefined,
      sub:
        flow.timeLabel && svc
          ? `${flow.timeLabel} – ${endTimeLabel(flow.timeLabel, svc.durationMinutes)}`
          : undefined,
      placeholder: "Not chosen yet",
      changeHref: `${base}/book/time${q}`,
    },
  ];
  if (showFor) {
    rows.push({
      label: "For",
      value:
        `${flow.details.firstName} ${flow.details.lastName}`.trim() || undefined,
      sub: flow.details.email || flow.details.mobile || undefined,
      placeholder: "Not added yet",
      changeHref: `${base}/book/details${q}`,
    });
  }

  const policyLine =
    flow.startsAt && policy
      ? `Free to cancel or move until ${freeCancelLabel(flow.startsAt, policy.freeCancelHours, tz)}. No account needed.`
      : policy
        ? `Free to cancel or move up to ${policy.freeCancelHours} hours before your visit. No account needed.`
        : "Free to cancel or move before your visit. No account needed.";

  const secs = flow.secondsLeft;
  return (
    <VisitSummary
      rows={rows}
      serviceName={svc?.name}
      priceCents={svc?.priceCents}
      depositCents={svc?.depositCents ?? 0}
      depositLabel="Deposit due at the shop"
      hold={
        flow.holdTime && secs !== null && secs > 0 ? (
          <HoldTimer
            key={`${flow.holdTime}|${flow.holdExpiresAt}`}
            time={flow.holdTime}
            initialSeconds={Math.max(1, secs)}
            onDark
          />
        ) : undefined
      }
      cta={
        ctaNode ??
        (ctaLabel && ctaHref ? (
          <ButtonLink variant="linen" href={ctaHref}>
            {ctaLabel}
          </ButtonLink>
        ) : undefined)
      }
      policyLine={policyLine}
    />
  );
}
