import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * StatusChip — booking + payment status with dot indicator.
 *
 * Booking: confirmed (green), pending (amber), cancelled (gray),
 * declined (gray), no-show (red), completed (gray).
 * Payment: succeeded (green), pending (amber), refunded (gray),
 * failed (red), unpaid (gray).
 */
export type BookingStatus =
  | "confirmed"
  | "pending"
  | "cancelled"
  | "declined"
  | "no-show"
  | "completed";
export type PaymentStatus =
  | "succeeded"
  | "pending"
  | "refunded"
  | "failed"
  | "unpaid";

export type StatusChipStatus = BookingStatus | PaymentStatus;

const DOT_COLOR: Record<StatusChipStatus, string> = {
  confirmed: "bg-success",
  completed: "bg-muted-foreground",
  pending: "bg-warning",
  cancelled: "bg-muted-foreground",
  declined: "bg-muted-foreground",
  "no-show": "bg-destructive",
  succeeded: "bg-success",
  refunded: "bg-muted-foreground",
  failed: "bg-destructive",
  unpaid: "bg-muted-foreground",
};

const LABEL: Record<StatusChipStatus, string> = {
  confirmed: "Confirmed",
  pending: "Pending",
  cancelled: "Cancelled",
  declined: "Declined",
  "no-show": "No-show",
  completed: "Completed",
  succeeded: "Paid",
  refunded: "Refunded",
  failed: "Failed",
  unpaid: "Unpaid",
};

interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusChipStatus;
  /** Override the default label. */
  label?: string;
}

export function StatusChip({ status, label, className, ...props }: StatusChipProps) {
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-foreground",
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn("size-1.5 shrink-0 rounded-full", DOT_COLOR[status])}
      />
      {label ?? LABEL[status]}
    </span>
  );
}
