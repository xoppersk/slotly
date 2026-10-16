import type { ReactNode } from "react";
import { IconCalendar, IconClock, IconPerson } from "../icons";

export interface PhoneShellProps {
  /** Top-bar content (title block) — StaffAgenda draws date + meta line. */
  header: ReactNode;
  headerAction?: ReactNode;
  /** agenda | time-off | profile */
  current: "agenda" | "time-off" | "profile";
  /** Optional sticky bottom bar above the tab bar (booking phone summary). */
  bottomBar?: ReactNode;
  children: ReactNode;
}

const TABS = [
  { key: "agenda", label: "Agenda", href: "/staff", icon: IconClock },
  { key: "time-off", label: "Time off", href: "/staff/time-off", icon: IconCalendar },
  { key: "profile", label: "Profile", href: "/staff/profile", icon: IconPerson },
] as const;

/** PhoneShell — 390×844 frame, white top bar, scrollable main, 64px bottom
    tab bar + safe area (drawn 84px incl. padding on StaffAgenda). */
export function PhoneShell({ header, headerAction, current, bottomBar, children }: PhoneShellProps) {
  return (
    <div className="sl-phone">
      <header className="sl-phone__top">
        <div style={{ minWidth: 0 }}>{header}</div>
        {headerAction}
      </header>
      <main className="sl-phone__main">{children}</main>
      {bottomBar}
      <nav className="sl-tabbar" aria-label="Staff">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isCurrent = tab.key === current;
          return (
            <a key={tab.key} href={tab.href} aria-current={isCurrent ? "page" : undefined}>
              <i aria-hidden="true"><Icon width={18} height={18} /></i>
              {tab.label}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
