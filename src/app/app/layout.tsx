"use client";
/* Dashboard layout: AppShell (248px sidebar) + the dashboard stylesheet
   + the session-level booking state provider. `current` follows the path. */
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/sl/shells/AppShell";
import { DashboardProvider } from "./DashboardContext";
import "../../styles/dashboard.css";

const KEYS: [string, string][] = [
  ["/app/bookings", "bookings"],
  ["/app/calendar", "calendar"],
  ["/app/customers", "customers"],
  ["/app/services", "services"],
  ["/app/staff", "staff"],
  ["/app/availability", "availability"],
  ["/app/settings", "settings"],
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/app";
  const current = KEYS.find(([p]) => pathname.startsWith(p))?.[1] ?? "today";
  return (
    <DashboardProvider>
      <AppShell current={current}>{children}</AppShell>
    </DashboardProvider>
  );
}
