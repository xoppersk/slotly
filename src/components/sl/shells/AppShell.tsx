import type { ReactNode } from "react";
import Link from "next/link";
import { signOut } from "@/lib/auth-actions";
import {
  IconAvailability, IconCalendar, IconClock, IconCustomers, IconExternal,
  IconList, IconPerson, IconScissors, IconSettings,
} from "../icons";

export interface AppShellProps {
  /** Route key: today | bookings | calendar | customers | services | staff | availability | settings */
  current: string;
  children: ReactNode;
  /** Real business identity (server-resolved). Defaults keep the shell
      renderable in isolation (e.g. /dev/components). */
  businessName?: string;
  businessMark?: string;
  bookingPageHref?: string;
  /** Live count badge on the Bookings nav item. */
  bookingsCount?: number;
  ownerName?: string;
  ownerInitials?: string;
  ownerRoleLabel?: string;
  /** Business switcher control, rendered under the brand when present. */
  switcher?: ReactNode;
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
    carries the live count), "View booking page", owner at the bottom.
    Identity comes from props — the dashboard layout resolves the real
    business + signed-in user server-side (PROD-W4). */
export function AppShell({
  current,
  children,
  businessName = "Slotly",
  businessMark = "S",
  bookingPageHref,
  bookingsCount,
  ownerName = "",
  ownerInitials = "",
  ownerRoleLabel = "",
  switcher,
}: AppShellProps) {
  return (
    <div className="sl-app">
      <nav className="sl-side" aria-label="Main">
        <div className="sl-side__brand">
          <span className="sl-brand__mark" aria-hidden="true">{businessMark}</span>
          <span style={{ minWidth: 0 }}>
            <b>{businessName}</b>
            <small>Slotly</small>
          </span>
        </div>
        {switcher}
        {NAV.map((item) => {
          const Icon = item.icon;
          const isCurrent = item.key === current;
          return (
            <Link key={item.key} href={item.href} className="sl-nav" aria-current={isCurrent ? "page" : undefined}>
              <Icon />
              {item.label}
              {"count" in item && item.count && bookingsCount !== undefined ? <span className="sl-nav__ct">{bookingsCount}</span> : null}
            </Link>
          );
        })}
        {bookingPageHref ? (
          <Link href={bookingPageHref} className="sl-nav">
            <IconExternal />
            View booking page
          </Link>
        ) : null}
        <div className="sl-side__owner">
          <span className="sl-avatar" aria-hidden="true">{ownerInitials}</span>
          <span style={{ minWidth: 0 }}>
            <b>{ownerName}</b>
            <small>{ownerRoleLabel}</small>
          </span>
          <form action={signOut} className="sl-side__signout">
            <button type="submit">Sign out</button>
          </form>
        </div>
      </nav>
      <div className="sl-app__main">{children}</div>
    </div>
  );
}
