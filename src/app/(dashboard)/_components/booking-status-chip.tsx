import { cn } from "@/lib/utils";
import { StatusChip, type StatusChipStatus } from "@/components/ui/StatusChip";
import type { Database } from "@/lib/supabase/types";

type DbStatus = Database["public"]["Tables"]["bookings"]["Row"]["status"];

/** Map the database booking status to the StatusChip vocabulary. */
export function bookingStatusChip(status: DbStatus): {
  status: StatusChipStatus;
  label?: string;
} {
  switch (status) {
    case "confirmed":
      return { status: "confirmed" };
    case "pending":
      return { status: "pending", label: "Pending request" };
    case "payment_pending":
      return { status: "pending", label: "Payment pending" };
    case "payment_failed":
      return { status: "failed", label: "Payment failed" };
    case "completed":
      return { status: "completed" };
    case "cancelled":
      return { status: "cancelled" };
    case "no_show":
      return { status: "no-show" };
  }
}

export function BookingStatusChip({
  status,
  className,
}: {
  status: DbStatus;
  className?: string;
}) {
  const mapped = bookingStatusChip(status);
  return (
    <StatusChip
      status={mapped.status}
      label={mapped.label}
      className={cn("tnum", className)}
    />
  );
}
