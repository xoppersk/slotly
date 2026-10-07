"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CalendarRange,
  Users,
  Scissors,
  Clock,
  UserRound,
  Settings,
  LayoutDashboard,
  CalendarClock,
  CircleUserRound,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, getInitials } from "@/components/ui/avatar";
import type { BusinessMembership } from "@/lib/business";

import { BusinessSwitcher } from "./business-switcher";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

const OWNER_NAV = [
  { href: "/dashboard", label: "Today", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarRange },
  { href: "/dashboard/services", label: "Services", icon: Scissors },
  { href: "/dashboard/staff", label: "Staff", icon: Users },
  { href: "/dashboard/availability", label: "Availability", icon: Clock },
  { href: "/dashboard/customers", label: "Customers", icon: UserRound },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

/** Staff role: simplified portal — only their own day, time off, profile. */
const STAFF_NAV = [
  { href: "/dashboard", label: "My day", icon: LayoutDashboard, exact: true },
  {
    href: "/dashboard/staff/time-off",
    label: "Time off",
    icon: CalendarClock,
  },
  { href: "/dashboard/staff/profile", label: "Profile", icon: CircleUserRound },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

function SlotlyMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export interface DashboardShellProps {
  businessId: string;
  businessName: string;
  role: "owner" | "staff";
  memberships: BusinessMembership[];
  userEmail: string | null;
  userName: string | null;
  children: React.ReactNode;
}

export function DashboardShell({
  businessId,
  businessName,
  role,
  memberships,
  userEmail,
  userName,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const nav = role === "owner" ? OWNER_NAV : STAFF_NAV;
  const displayName = userName ?? userEmail ?? "Account";

  const navList = (
    <nav aria-label="Dashboard" className="flex flex-col gap-1 p-3">
      {nav.map((item) => {
        const Icon = item.icon;
        const active = isActive(
          pathname,
          item.href,
          "exact" in item && item.exact
        );
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-[0.5rem] px-3 py-2.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border md:flex md:flex-col">
        <div className="flex items-center gap-2 px-5 py-5">
          <span
            aria-hidden
            className="flex size-8 items-center justify-center rounded-[0.5rem] bg-primary text-primary-foreground"
          >
            <SlotlyMark className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Slotly</span>
        </div>
        <div className="px-3 pb-2">
          <BusinessSwitcher
            businessId={businessId}
            businessName={businessName}
            memberships={memberships}
          />
        </div>
        <Separator />
        <div className="flex-1 overflow-y-auto">{navList}</div>
        <Separator />
        <div className="flex items-center gap-3 p-4">
          <Avatar>
            <AvatarFallback initials={getInitials(displayName)} />
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {role === "owner" ? "Business admin" : "Staff"}
            </p>
          </div>
          <ThemeToggle />
          <UserMenu userEmail={userEmail} />
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex size-7 items-center justify-center rounded-[0.5rem] bg-primary text-primary-foreground"
            >
              <SlotlyMark className="size-4" />
            </span>
            <span className="max-w-40 truncate text-sm font-semibold">
              {businessName}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <ThemeToggle />
            <UserMenu userEmail={userEmail} />
          </span>
        </header>

        <main className="flex-1 p-4 pb-24 sm:p-6 md:pb-6">{children}</main>

        {/* Mobile bottom nav */}
        <nav
          aria-label="Dashboard"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur md:hidden"
        >
          <ul className="flex items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
            {nav.slice(0, 5).map((item) => {
              const Icon = item.icon;
              const active = isActive(
                pathname,
                item.href,
                "exact" in item && item.exact
              );
              return (
                <li key={item.href} className="flex-1">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-16 flex-col items-center justify-center gap-1 rounded-[0.5rem] text-[11px] font-medium",
                      active
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
