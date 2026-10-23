"use client";
import type { ReactNode } from "react";
import { BookingShell } from "@/components/sl/shells/BookingShell";
import { stepHrefs, useBookingFlow } from "./BookingFlow";

/** BookingShell pre-filled with the REAL business (from the public views)
    and slug-correct step hrefs — every flow page renders through this. */
export function FlowShell({
  step,
  manageHref = "#",
  className,
  children,
}: {
  step?: number;
  manageHref?: string;
  className?: string;
  children: ReactNode;
}) {
  const flow = useBookingFlow();
  const b = flow.catalog.business;
  const mark =
    b.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "S";
  return (
    <BookingShell
      step={step}
      stepHrefs={stepHrefs(flow.base, flow)}
      manageHref={manageHref}
      className={className}
      businessName={b.name}
      businessAddressLine={b.address ?? ""}
      businessMark={mark}
      homeHref={flow.base}
      footerLine={`${b.name}${b.phone ? ` · ${b.phone}` : ""}${b.address ? ` · ${b.address}` : ""}`}
    >
      {children}
    </BookingShell>
  );
}
