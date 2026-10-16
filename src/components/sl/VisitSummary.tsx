import type { ReactNode } from "react";
import { formatCents } from "@/lib/format";

export interface VisitRow {
  label: string;
  value?: string;
  sub?: string;
  changeHref?: string;
  /** Drawn placeholder when not chosen yet: "Not chosen yet" / "Next step". */
  placeholder?: string;
}

export interface VisitSummaryProps {
  /** Premium default: dark ink card. "light" matches the DS preview. */
  variant?: "dark" | "light";
  note?: string;
  hold?: ReactNode;
  rows: VisitRow[];
  /** Chosen service name for the money block; omit before a service is picked. */
  serviceName?: string;
  priceCents?: number;
  depositCents?: number;
  /** Deposit line label: "Deposit due today" / "Deposit charged now". */
  depositLabel?: string;
  cta?: ReactNode;
  policyLine?: string;
}

/** VisitSummary — the sticky summary panel (Premium: dark ink card,
    shadow-dark, linen primary button). Rows fill in step by step; money
    is always three lines: price, deposit due today (bold), pay at shop. */
export function VisitSummary({
  variant = "dark",
  note = "Nothing is booked until you confirm.",
  hold,
  rows,
  serviceName,
  priceCents,
  depositCents = 2000,
  depositLabel = "Deposit due today",
  cta,
  policyLine,
}: VisitSummaryProps) {
  const atShop = priceCents !== undefined ? priceCents - depositCents : undefined;
  return (
    <aside className={`sl-visit${variant === "light" ? " sl-visit--light" : ""}`} aria-label="Your visit">
      <div className="sl-visit__title">Your visit</div>
      {note ? <p className="sl-visit__note">{note}</p> : null}
      {hold ? <div className="sl-visit__hold">{hold}</div> : null}
      <dl className="sl-visit__rows">
        {rows.map((row) => (
          <div className="sl-visit__row" key={row.label}>
            <dt>{row.label}</dt>
            {row.value ? (
              <dd>
                {row.value}
                {row.sub ? <small>{row.sub}</small> : null}
              </dd>
            ) : (
              <dd className="sl-visit__unset">{row.placeholder ?? "Not chosen yet"}</dd>
            )}
            {row.changeHref && row.value ? <a href={row.changeHref}>Change</a> : <span />}
          </div>
        ))}
      </dl>
      {serviceName && priceCents !== undefined && atShop !== undefined ? (
        <div className="sl-visit__money">
          <div><span>{serviceName}</span><span>{formatCents(priceCents)}</span></div>
          <div><span>Pay at the shop</span><span>{formatCents(atShop)}</span></div>
          <div className="due"><span>{depositLabel}</span><span>{formatCents(depositCents)}</span></div>
        </div>
      ) : null}
      {cta ? <div className="sl-visit__cta">{cta}</div> : null}
      {policyLine ? <p className="sl-visit__policy">{policyLine}</p> : null}
    </aside>
  );
}

/** Phone bottom-bar form of the summary, as drawn on MainPhone.html:
    "Thu, Oct 8 · 9:00 AM · $20 deposit · $48 total" + Continue. */
export function VisitSummaryBar({
  summaryLine,
  holdLine,
  children,
}: {
  summaryLine: string;
  holdLine?: string;
  children: ReactNode;
}) {
  return (
    <div className="sl-phone-bar">
      {holdLine ? (
        <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "var(--oxblood-deep)" }}>{holdLine}</p>
      ) : null}
      <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600 }}>{summaryLine}</p>
      {children}
    </div>
  );
}
