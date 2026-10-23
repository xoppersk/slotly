"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { updateBookingStatus } from "./actions";

export function CancelBookingButton({
  bookingId,
  className,
}: {
  bookingId: string;
  className?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await updateBookingStatus(bookingId, "cancelled");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel the booking.");
    } finally {
      setPending(false);
      setConfirming(false);
    }
  }

  return (
    <span>
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={handleCancel}
      >
        {pending ? "Cancelling…" : confirming ? "Confirm cancel" : "Cancel booking"}
      </button>
      {error ? <span className="ml-2 text-sm text-red-600">{error}</span> : null}
    </span>
  );
}

export function StatusButton({
  bookingId,
  status,
  label,
  className,
}: {
  bookingId: string;
  status: "confirmed" | "completed" | "no_show" | "cancelled";
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      await updateBookingStatus(bookingId, status);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the booking.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span>
      <button type="button" className={className} disabled={pending} onClick={handleClick}>
        {pending ? "Saving…" : label}
      </button>
      {error ? <span className="ml-2 text-sm text-red-600">{error}</span> : null}
    </span>
  );
}
