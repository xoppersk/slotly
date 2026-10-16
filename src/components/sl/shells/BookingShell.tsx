import type { ReactNode } from "react";
import { business } from "@/lib/api";

export const BOOKING_STEPS = ["Service", "Barber", "Time", "Details", "Deposit", "Review"] as const;

export interface BookingShellProps {
  /** 1–6; omit on the business home (no step bar drawn there). */
  step?: number;
  stepHrefs?: string[];
  manageHref?: string;
  /** Optional class applied to the root div (e.g. page-scoped phone rules). */
  className?: string;
  children: ReactNode;
}

/** BookingShell — white 76px top bar (screens; brief says 72px — screens
    win, logged), H&P mark + name + address, slim progress-bar steps as an
    <ol> with aria-current="step" (done steps link back), "Manage a booking"
    ghost button, Harbor & Pine footer. */
export function BookingShell({ step, stepHrefs, manageHref = "#", className, children }: BookingShellProps) {
  return (
    <div className={className} style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="sl-book-head">
        <div className="sl-wrap sl-book-head__in">
          <a href="/b/harbor-and-pine" className="sl-brand">
            <span className="sl-brand__mark" aria-hidden="true">{business.mark}</span>
            <span>
              <b>{business.name}</b>
              <small>{business.address.line}</small>
            </span>
          </a>
          {step ? (
            <ol className="sl-prog" aria-label="Booking steps">
              {BOOKING_STEPS.map((label, i) => {
                const n = i + 1;
                if (n < step) {
                  return (
                    <li key={label} className="sl-prog--done">
                      <i aria-hidden="true" />
                      {stepHrefs?.[i] ? <a href={stepHrefs[i]}>{label}</a> : label}
                    </li>
                  );
                }
                if (n === step) {
                  return (
                    <li key={label} aria-current="step">
                      <i aria-hidden="true" />
                      {label}
                    </li>
                  );
                }
                return (
                  <li key={label}>
                    <i aria-hidden="true" />
                    {label}
                  </li>
                );
              })}
            </ol>
          ) : null}
          <a href={manageHref} className="sl-ghost">Manage a booking</a>
        </div>
      </header>
      <main style={{ flex: 1 }}>{children}</main>
      <footer className="sl-book-foot">
        <div className="sl-wrap sl-book-foot__in">
          <span>{business.footerLine}</span>
          <nav aria-label="Footer">
            <a href="#">Cancellation policy</a>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <span>Booking by Slotly</span>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/** "Step N of 6" eyebrow + 60px headline (BookingShell step header). */
export function StepHeading({ step, title, children }: { step: number; title: string; children?: ReactNode }) {
  return (
    <div>
      <p className="sl-step-eyebrow">Step {step} of 6</p>
      <h1 className="sl-step-title">{title}</h1>
      {children}
    </div>
  );
}
