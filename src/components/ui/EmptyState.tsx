import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * EmptyState — line-art slot-grid motif (a small calendar grid with one
 * highlighted pill) in teal/stone, drawn as inline SVG per the design
 * brief. Headline + single CTA pattern, variants per screen via props.
 */
interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/** Inline SVG slot-grid motif: 4×3 grid with one highlighted pill. */
function SlotGridMotif({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 88"
      role="img"
      aria-hidden
      className={cn("h-22 w-30", className)}
    >
      {/* grid frame */}
      <rect
        x="4"
        y="4"
        width="112"
        height="80"
        rx="10"
        className="fill-card stroke-border"
        strokeWidth="2"
      />
      {/* calendar rows — 3 rows × 3 slot dots */}
      {[22, 40, 58].map((cy) =>
        [22, 48, 74].map((cx) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" className="fill-muted" />
        ))
      )}
      {/* highlighted slot pill */}
      <rect
        x="62"
        y="52"
        width="36"
        height="12"
        rx="6"
        className="fill-primary"
      />
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[0.75rem] border border-dashed border-border bg-card/60 px-6 py-12 text-center",
        className
      )}
    >
      <SlotGridMotif />
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction} className="mt-1">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
