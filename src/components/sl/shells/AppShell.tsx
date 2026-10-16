import type { ReactNode } from "react";
import Link from "next/link";
import { business, getDashboardTotals, people } from "@/lib/api";
import {
  IconAvailability, IconCalendar, IconClock, IconCustomers, IconExternal,
  IconList, IconPerson, IconScissors, IconSettings,
} from "../icons";

export interface AppShellProps {
  /** Route key: today | bookings | calendar | customers | services | staff | availability | settings */
  current: string;
  children: ReactNode;
}

const NAV = [
  { key: "today", label: "Today", href: "/app", icon: IconClock },
  { key: "bookings", label: "Bookings", href: "/app/bookings", icon: IconList, count: true },
  { key: "calendar", label: "Calendar", href: "/app/calendar", icon: IconCalendar },
  { key: "customers", label: "Customers", href: "/app/customers", icon: IconCustomers },
  { key: "services", label: "Services", href: "/app/services", icon: IconScissors },
  { key: "staff", label: "Staff", href: "/app/staff", icon: IconPerson },
  { key: "availability", label: "Availability", href: "/app/availability", icon: IconAvailability },
  { key: "settings", label: "Settings", href: "/app/settings", icon: IconSettings },
] as const;

/** AppShell — 248px white sidebar as drawn on the dashboard screens
    (brief says 232px — screens win, logged): brand, 8 items (Bookings
    carries the live count), "View booking page", owner at the bottom. */
export function AppShell({ current, children }: AppShellProps) {
  const count = getDashboardTotals().count;
  const owner = people.owner;
  return (
    <div className="sl-app">
      <nav className="sl-side" aria-label="Main">
        <div className="sl-side__brand">
          <span className="sl-brand__mark" aria-hidden="true">{business.mark}</span>
          <span style={{ minWidth: 0 }}>
            <b>{business.shortName}</b>
            <small>Slotly</small>
          </span>
        </div>
        {NAV.map((item) => {
          const Icon = item.icon;
          const isCurrent = item.key === current;
          return (
            <Link key={item.key} href={item.href} className="sl-nav" aria-current={isCurrent ? "page" : undefined}>
              <Icon />
              {item.label}
              {"count" in item && item.count ? <span className="sl-nav__ct">{count}</span> : null}
            </Link>
          );
        })}
        <Link href="/b/harbor-and-pine" className="sl-nav">
          <IconExternal />
          View booking page
        </Link>
        <div className="sl-side__owner">
          <span className="sl-avatar" aria-hidden="true">{owner.initials}</span>
          <span style={{ minWidth: 0 }}>
            <b>{owner.name}</b>
            <small>{owner.roleLabel}</small>
          </span>
        </div>
      </nav>
      <div className="sl-app__main">{children}</div>
    </div>
  );
}
