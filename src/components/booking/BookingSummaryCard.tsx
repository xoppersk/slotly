import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/format";
import { Button } from "@/components/ui/button";

/**
 * BookingSummaryCard — the "Your booking" summary panel from the Slotly
 * signature UI (Flagship UI Designs · Slotly · Signature).
 *
 * Anatomy (verbatim from the design): Newsreader "Your booking" heading,
 * label/value sum-blocks with hairline dividers, a receipt-total row with
 * the price in IBM Plex Mono, and an optional Continue action. Reused
 * identically in the wizard side panel, review step, confirmation screen,
 * manage-booking page, and dashboard booking drawer.
 */
export interface BookingSummaryLine {
  label: string;
  value: string;
}

interface BookingSummaryCardProps {
  lines: BookingSummaryLine[];
  /** Total price in integer cents; null hides the total row. */
  totalCents?: number | null;
  currency?: string;
  /** Label for the total row, e.g. "Total · pay at visit". */
  totalLabel?: string;
  /** Panel heading. */
  title?: string;
  /** Optional primary action rendered under the total (wizard Continue). */
  action?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  className?: string;
}

export function BookingSummaryCard({
  lines,
  totalCents = null,
  currency = "USD",
  totalLabel = "Total",
  title = "Your booking",
  action,
  className,
}: BookingSummaryCardProps) {
  return (
    <section
      aria-label={title}
      className={cn(
        "border border-border bg-summary p-5 shadow-none",
        className
      )}
    >
      <h4 className="border-b border-border pb-4 text-[22px] font-semibold">
        {title}
      </h4>
      <dl>
        {lines.map((line, i) => (
          <div
            key={`${line.label}-${i}`}
            className="border-b border-border py-3 last:border-b-0"
          >
            <dt className="text-xs text-muted-foreground">{line.label}</dt>
            <dd className="tnum mt-0.5 text-[15px] font-semibold text-foreground">
              {line.value}
            </dd>
          </div>
        ))}
      </dl>
      {totalCents !== null && (
        <div className="flex items-baseline justify-between border-t border-border py-3">
          <span className="text-sm text-muted-foreground">{totalLabel}</span>
          <strong className="font-mono text-[15px] font-semibold text-foreground">
            {formatCents(totalCents, currency)}
          </strong>
        </div>
      )}
      {action && (
        <Button
          variant="primary"
          size="lg"
          onClick={action.onClick}
          disabled={action.disabled || action.loading}
          className="mt-2 w-full"
        >
          {action.loading ? "Working…" : action.label}
        </Button>
      )}
    </section>
  );
}
