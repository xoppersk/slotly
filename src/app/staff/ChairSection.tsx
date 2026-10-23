"use client";
/* The chair card at the top of the staff agenda: the booking whose
   window contains real now. Its button completes the booking (the
   production transition) — the balance is collected at the shop, never
   in the app. "Finish and take $X" is the drawn component's own label
   for finishing the appointment and taking payment at the till. */
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChairCard } from "@/components/sl/ChairCard";
import { updateBookingStatus } from "../app/actions";

export function ChairSection({
  bookingId,
  customer,
  service,
  windowLabel,
  balanceCents,
  overrunLabel,
}: {
  bookingId: string;
  customer: string;
  service: string;
  windowLabel: string;
  balanceCents: number;
  overrunLabel?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  return (
    <ChairCard
      customer={customer}
      service={service}
      windowLabel={windowLabel}
      balanceCents={balanceCents}
      overrunLabel={overrunLabel}
      onFinish={() =>
        startTransition(async () => {
          await updateBookingStatus(bookingId, "completed");
          router.refresh();
        })
      }
    />
  );
}
