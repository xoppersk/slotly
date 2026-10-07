"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  updateBookingStatus,
  rescheduleBooking,
  issueBookingRefund,
  type BookingStatusAction,
  type BookingDetail,
} from "../../../_actions/bookings";
import { getBookingCatalog } from "../../../_actions/scheduling";
import { SlotPicker, type PickedSlot } from "./slot-picker";
import { formatDateTimeLabel } from "@/lib/dashboard/format";

interface BookingActionsProps {
  detail: BookingDetail;
  businessId: string;
  timezone: string;
  onChanged: () => void;
}

/**
 * Action row for the booking detail drawer: Confirm/Decline (pending),
 * Reschedule, Cancel, Complete, No-show, Refund. Every destructive action
 * explains itself before committing.
 */
export function BookingActions({
  detail,
  businessId,
  timezone,
  onChanged,
}: BookingActionsProps) {
  const router = useRouter();
  const { booking } = detail;
  const [pending, startTransition] = useTransition();

  const run = (
    action: BookingStatusAction,
    reason?: string,
    successMessage?: string
  ) => {
    startTransition(async () => {
      const result = await updateBookingStatus(
        businessId,
        booking.id,
        action,
        reason
      );
      if (!result.ok) {
        toast.error(friendlyError(result.error));
        return;
      }
      toast.success(successMessage ?? "Booking updated");
      onChanged();
      router.refresh();
    });
  };

  const status = booking.status;
  const showConfirmDecline = status === "pending";
  const showReschedule = ["pending", "confirmed", "payment_pending"].includes(status);
  const showCancel = !["cancelled", "completed", "no_show"].includes(status);
  const showComplete = status === "confirmed";
  const showNoShow = ["pending", "confirmed"].includes(status);

  return (
    <div className="flex flex-wrap gap-2">
      {showConfirmDecline && (
        <>
          <Button disabled={pending} onClick={() => run("confirm", undefined, "Booking confirmed")}>
            Confirm
          </Button>
          <DeclineDialog
            disabled={pending}
            onDecline={(reason) => run("decline", reason, "Booking declined — customer notified")}
          />
        </>
      )}
      {showReschedule && (
        <RescheduleDialog
          detail={detail}
          businessId={businessId}
          timezone={timezone}
          disabled={pending}
          onDone={() => {
            toast.success("Booking rescheduled — customer notified");
            onChanged();
            router.refresh();
          }}
        />
      )}
      {showComplete && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => run("complete", undefined, "Marked as completed")}
        >
          Mark completed
        </Button>
      )}
      {showNoShow && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => run("no_show", undefined, "Marked as no-show")}
        >
          Mark no-show
        </Button>
      )}
      {showCancel && (
        <CancelDialog
          detail={detail}
          timezone={timezone}
          disabled={pending}
          onCancel={(reason) => run("cancel", reason, "Booking cancelled — customer notified")}
        />
      )}
      {pending && <Loader2 className="size-4 animate-spin self-center" aria-hidden />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function DeclineDialog({
  disabled,
  onDecline,
}: {
  disabled: boolean;
  onDecline: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          Decline
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Decline this request?</DialogTitle>
          <DialogDescription>
            The customer is notified automatically — tell them why.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="decline-reason">Reason</Label>
          <Textarea
            id="decline-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Fully booked that day, please pick another time"
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Keep request
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim()}
            onClick={() => {
              onDecline(reason.trim());
              setOpen(false);
              setReason("");
            }}
          >
            Decline and notify
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({
  detail,
  timezone,
  disabled,
  onCancel,
}: {
  detail: BookingDetail;
  timezone: string;
  disabled: boolean;
  onCancel: (reason?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [now] = useState(() => Date.now());
  const insideWindow =
    detail.freeCancelUntil !== null &&
    Date.parse(detail.freeCancelUntil) > now;
  const willAutoRefund = insideWindow && detail.paidCents > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled} className="text-destructive hover:text-destructive">
          Cancel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel this booking?</DialogTitle>
        </DialogHeader>
        {insideWindow ? (
          <Alert>
            <AlertDescription>
              Inside the free-cancel window
              {detail.freeCancelUntil &&
                ` (until ${formatDateTimeLabel(detail.freeCancelUntil, timezone)})`}
              .
              {willAutoRefund
                ? ` The ${formatCents(detail.paidCents)} payment will be refunded automatically.`
                : " No payment was taken."}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertDescription>
              Outside the free-cancel window — cancelling keeps any payment
              unless you issue a refund from the payment block.
            </AlertDescription>
          </Alert>
        )}
        <div>
          <Label htmlFor="cancel-reason">Reason (optional)</Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Shown to the customer"
            rows={2}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Keep booking
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onCancel(reason.trim() || undefined);
              setOpen(false);
              setReason("");
            }}
          >
            Cancel booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RescheduleDialog({
  detail,
  businessId,
  timezone,
  disabled,
  onDone,
}: {
  detail: BookingDetail;
  businessId: string;
  timezone: string;
  disabled: boolean;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<PickedSlot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [staffOptions, setStaffOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, startTransition] = useTransition();
  const busy = disabled || saving;

  useEffect(() => {
    if (!open || !detail.service) return;
    let cancelled = false;
    (async () => {
      const catalog = await getBookingCatalog(businessId);
      if (cancelled || "error" in catalog) return;
      const eligibleIds = catalog.serviceStaff[detail.service!.id] ?? [];
      setStaffOptions(catalog.staff.filter((s) => eligibleIds.includes(s.id)));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, businessId, detail.service]);

  const confirm = () => {
    if (!slot) return;
    setError(null);
    startTransition(async () => {
      const result = await rescheduleBooking(businessId, detail.booking.id, {
        staffId: slot.staffId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      });
      if (!result.ok) {
        setError(friendlyError(result.error));
        return;
      }
      setOpen(false);
      setSlot(null);
      onDone();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setSlot(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          Reschedule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reschedule booking</DialogTitle>
          <DialogDescription>
            Currently{" "}
            <span className="tnum font-medium">
              {formatDateTimeLabel(detail.booking.starts_at, timezone)}
            </span>
            . Pick a new time — the customer is notified.
          </DialogDescription>
        </DialogHeader>
        {detail.service && (
          <SlotPicker
            businessId={businessId}
            serviceId={detail.service.id}
            staff={
              staffOptions.length > 0
                ? staffOptions
                : detail.staff
                  ? [{ id: detail.staff.id, name: detail.staff.name }]
                  : []
            }
            initialStaffId={detail.staff?.id ?? null}
            selectedSlot={slot}
            onSelect={setSlot}
          />
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Keep current time
          </Button>
          <Button disabled={!slot || busy} onClick={confirm}>
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Move booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* refund                                                              */
/* ------------------------------------------------------------------ */

export function RefundBlock({
  detail,
  businessId,
  onRefunded,
}: {
  detail: BookingDetail;
  businessId: string;
  onRefunded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [paymentId, setPaymentId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startTransition] = useTransition();

  const refundable = detail.payments.filter((p) => p.status === "succeeded");
  const remaining = (paymentId: string) => {
    const p = refundable.find((x) => x.id === paymentId);
    if (!p) return 0;
    const already = detail.refunds
      .filter((r) => r.payment_id === p.id && ["pending", "succeeded"].includes(r.status))
      .reduce((s, r) => s + r.amount_cents, 0);
    return Math.max(0, p.amount_cents - already);
  };

  if (refundable.length === 0) return null;

  const openFor = (id: string) => {
    setPaymentId(id);
    setAmount((remaining(id) / 100).toFixed(2));
    setReason("");
    setError(null);
    setOpen(true);
  };

  const submit = () => {
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (cents > remaining(paymentId)) {
      setError("Amount exceeds the refundable balance.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await issueBookingRefund(
        businessId,
        paymentId,
        cents,
        reason.trim() || undefined
      );
      if (!result.ok) {
        setError(friendlyError(result.error));
        return;
      }
      toast.success(`Refunded ${formatCents(cents)}`);
      setOpen(false);
      onRefunded();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Issue refund
      </p>
      {refundable.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between gap-2 rounded-[0.5rem] border border-border px-3 py-2 text-sm"
        >
          <span className="tnum">
            {formatCents(p.amount_cents)}
            <span className="text-muted-foreground">
              {" "}
              · {formatCents(remaining(p.id))} refundable
            </span>
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={remaining(p.id) <= 0}
            onClick={() => openFor(p.id)}
          >
            Refund
          </Button>
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Issue refund</DialogTitle>
            <DialogDescription>
              Processed through Stripe immediately and recorded against the
              payment.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="refund-amount">Amount (USD)</Label>
              <Input
                id="refund-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={cn("tnum")}
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAmount((remaining(paymentId) / 100).toFixed(2))}
              >
                Full amount
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="refund-reason">Reason (optional)</Label>
            <Input
              id="refund-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer cancelled in time"
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Back
            </Button>
            <Button disabled={saving} onClick={submit}>
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Issue {amount ? formatCents(Math.round(Number(amount) * 100) || 0) : ""} refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function friendlyError(code: string): string {
  const map: Record<string, string> = {
    not_authorized: "You are not authorized for this business.",
    booking_not_found: "Booking not found.",
    decline_reason_required: "A decline reason is required.",
    update_failed: "Could not update the booking.",
    slot_taken: "That slot was just taken — pick another time.",
    payment_not_refundable: "That payment cannot be refunded.",
    invalid_refund_amount: "Enter a valid refund amount.",
    stripe_refund_failed: "Stripe declined the refund — no money moved.",
    refund_record_failed: "Stripe refunded, but recording failed — check the payment.",
  };
  return map[code] ?? code.replace(/_/g, " ");
}
