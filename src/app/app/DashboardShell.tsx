import { ReactNode } from "react";

import { AppShell } from "@/components/sl/shells/AppShell";

export function DashboardShell({
  children,
  businessName,
  role,
  staffName,
  nav,
}: {
  children: ReactNode;
  businessName: string;
  role: "owner" | "staff";
  staffName?: string;
  nav: Array<{ href: string; label: string; active?: boolean }>;
}) {
  return (
    <AppShell businessName={businessName} role={role} staffName={staffName} nav={nav}>
      {children}
    </AppShell>
  );
}
