"use client";
/* Client shell for the dashboard: AppShell + the current-route key
   from the pathname. Identity props arrive from the server layout. */
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/sl/shells/AppShell";
import { BusinessSwitcher } from "./BusinessSwitcher";

const KEYS: [string, string][] = [
  ["/app/bookings", "bookings"],
  ["/app/calendar", "calendar"],
  ["/app/customers", "customers"],
  ["/app/services", "services"],
  ["/app/staff", "staff"],
  ["/app/availability", "availability"],
  ["/app/settings", "settings"],
];

export function DashboardShell({
  businessName,
  businessMark,
  bookingPageHref,
  bookingsCount,
  ownerName,
  ownerInitials,
  ownerRoleLabel,
  businesses,
  activeBusinessId,
  children,
}: {
  businessName: string;
  businessMark: string;
  bookingPageHref: string;
  bookingsCount: number;
  ownerName: string;
  ownerInitials: string;
  ownerRoleLabel: string;
  businesses: { id: string; name: string }[];
  activeBusinessId: string;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/app";
  const current = KEYS.find(([p]) => pathname.startsWith(p))?.[1] ?? "today";
  return (
    <AppShell
      current={current}
      businessName={businessName}
      businessMark={businessMark}
      bookingPageHref={bookingPageHref}
      bookingsCount={bookingsCount}
      ownerName={ownerName}
      ownerInitials={ownerInitials}
      ownerRoleLabel={ownerRoleLabel}
      switcher={<BusinessSwitcher businesses={businesses} activeId={activeBusinessId} />}
    >
      {children}
    </AppShell>
  );
}
