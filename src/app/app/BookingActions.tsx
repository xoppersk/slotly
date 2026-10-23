"use client";
/* Run-sheet / drawer status actions (PROD-W4). The production chain is
   pending → confirmed → completed (+ cancelled / no_show exits) — the
   fixture's Check in → Start → Finish chain implied states the database
   cannot represent, so those buttons are gone. Actions call the
   updateBookingStatus server action (RLS-scoped) and refresh. */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/sl/Button";
import type { BookingStatus as DbBookingStatus } from "@/lib/supabase/types";
import { updateBookingStatus } from "./actions";

export function primaryActionFor(
  status: DbBookingStatus,
): { next: DbBookingStatus; label: string } | null {
  switch (status) {
    case "pending":
      return { next: "confirmed", label: "Confirm" };
    case "confirmed":
      return { next: "completed", label: "Complete" };
    default:
      return null;
  }
}

export function BookingStatusButton({
  bookingId,
  status,
  size = "sm",
  label,
  variant,
}: {
  bookingId: string;
  status: DbBookingStatus;
  size?: "sm" | "dashboard";
  label?: string;
  variant?: "outline" | "primary" | "linen";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const action = primaryActionFor(status);
  if (!action) return null;
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <Button
        size={size}
        variant={variant ?? (action.next === "confirmed" ? "outline" : "primary")}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await updateBookingStatus(bookingId, action.next);
            if (!res.ok) setError(res.error);
            else router.refresh();
          })
        }
      >
        {label ?? action.label}
      </Button>
      {error ? <span style={{ fontSize: 12, color: "var(--danger, #b3261e)" }}>{error}</span> : null}
    </span>
  );
}

export function BookingTerminalButtons({
  bookingId,
  status,
  onDone,
}: {
  bookingId: string;
  status: DbBookingStatus;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<"noshow" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canExit = status === "pending" || status === "payment_pending" || status === "payment_failed" || status === "confirmed";
  if (!canExit) return null;

  const run = (next: DbBookingStatus) =>
    startTransition(async () => {
      const res = await updateBookingStatus(bookingId, next);
      if (!res.ok) {
        setError(res.error);
        setConfirming(null);
      } else {
        onDone?.();
        router.refresh();
      }
    });

  if (confirming === "noshow") {
    return (
      <>
        <span style={{ fontSize: 14, alignSelf: "center" }}>Mark as no-show?</span>
        <span style={{ display: "flex", gap: 8 }}>
          <Button size="dashboard" onClick={() => setConfirming(null)}>Back</Button>
          <Button size="dashboard" variant="destructive" disabled={pending} onClick={() => run("no_show")}>
            Mark no-show
          </Button>
        </span>
      </>
    );
  }
  if (confirming === "cancel") {
    return (
      <>
        <span style={{ fontSize: 14, alignSelf: "center" }}>Cancel this booking?</span>
        <span style={{ display: "flex", gap: 8 }}>
          <Button size="dashboard" onClick={() => setConfirming(null)}>Back</Button>
          <Button size="dashboard" variant="destructive" disabled={pending} onClick={() => run("cancelled")}>
            Cancel booking
          </Button>
        </span>
      </>
    );
  }
  return (
    <>
      {error ? <span style={{ fontSize: 13, color: "var(--danger, #b3261e)", alignSelf: "center" }}>{error}</span> : null}
      <Button size="dashboard" disabled={pending} onClick={() => setConfirming("noshow")}>Mark no-show</Button>
      <Button size="dashboard" variant="destructive" disabled={pending} onClick={() => setConfirming("cancel")}>
        Cancel booking
      </Button>
    </>
  );
}
