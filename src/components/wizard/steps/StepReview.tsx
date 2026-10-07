"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import { BookingSummaryCard } from "@/components/booking/BookingSummaryCard";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatCents } from "@/lib/format";
import { amountDueNow } from "@/lib/payments/policy";
import { formatSlotForCustomer, formatDayLabel } from "@/lib/availability";
import {
  apiJson,
  ApiError,
  type CreateBookingResponse,
} from "@/lib/booking/public-api";

import type { StepProps } from "../BookingWizard";
import type { WizardStepId, ConfirmationSnapshot } from "../types";
import { saveConfirmationSnapshot } from "../types";

interface StepReviewProps extends StepProps {
  goToStep: (index: number) => void;
  steps: WizardStepId[];
}

/**
 * Wizard Step 6 — Review.
 *
 * Summary card (service, staff photo/name, date/time in both timezones when
 * they differ, price breakdown, amount paid / due at appointment,
 * cancellation policy), "Change" links per row, big "Confirm booking".
 *
 * - `none`-policy services: Confirm creates the booking directly here.
 * - Paid services: the booking already exists (confirmed after payment);
 *   Confirm just advances to the confirmation screen.
 */
export function StepReview({
  ctx,
  state,
  update,
  setPrimary,
  goToStep,
  steps,
  slug,
  customerTimezone,
}: StepReviewProps) {
  const router = useRouter();
  const { business, services, staff } = ctx;
  const service = services.find((s) => s.id === state.serviceId);
  const staffMember = staff.find((s) => s.id === state.slot?.staffId);
  const slot = state.slot;
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const paid = service?.payment_policy !== "none";
  const due = React.useMemo(() => {
    if (!service) return null;
    try {
      return amountDueNow({
        paymentPolicy: service.payment_policy,
        priceCents: service.price_cents,
        depositCents: service.deposit_cents,
      });
    } catch {
      return null;
    }
  }, [service]);

  const dual = slot
    ? formatSlotForCustomer(slot.startsAt, business.timezone, customerTimezone)
    : null;
  const dayLabel = state.dayKey
    ? formatDayLabel(state.dayKey, business.timezone)
    : "";

  const buildSnapshot = React.useCallback(
    (bookingId: string, manageToken: string | null): ConfirmationSnapshot => {
      const paidCents = state.payment?.amountDueCents ?? 0;
      return {
        bookingId,
        manageToken,
        serviceName: service?.name ?? "",
        durationMinutes: service?.duration_minutes ?? 0,
        priceCents: service?.price_cents ?? 0,
        staffName: staffMember?.name ?? null,
        startsAt: slot?.startsAt ?? "",
        endsAt: slot?.endsAt ?? "",
        customerName: state.details.name,
        amountPaidCents: paid ? paidCents : 0,
        amountDueLaterCents: paid
          ? (service?.price_cents ?? 0) - paidCents
          : (service?.price_cents ?? 0),
        businessName: business.name,
        businessTimezone: business.timezone,
        businessAddress: business.address ?? null,
        businessPhone: business.phone ?? null,
      };
    },
    [service, slot, staffMember, state, paid, business]
  );

  const confirm = React.useCallback(async () => {
    if (!service || !slot) return;
    setError(null);
    if (paid) {
      // Paid bookings already exist server-side (confirmed after payment) —
      // Confirm just moves to the confirmation screen.
      const token = state.payment?.manageToken;
      const bookingId = state.payment?.bookingId;
      if (!bookingId || !token) {
        setError("The payment record is missing. Please go back and try again.");
        return;
      }
      saveConfirmationSnapshot(buildSnapshot(bookingId, token));
      router.push(
        `/${slug}/book/confirmation/${bookingId}?t=${encodeURIComponent(token)}`
      );
      return;
    }
    setConfirming(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessId: business.id,
          serviceId: service.id,
          staffId: state.staffId ?? "any",
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          customer: {
            name: state.details.name,
            phone: state.details.phone || undefined,
            email: state.details.email || undefined,
            notes: state.details.notes || undefined,
          },
        }),
      });
      const data = await apiJson<CreateBookingResponse>(res, "Booking failed");
      update({
        confirmedBooking: {
          bookingId: data.bookingId,
          manageToken: data.manageToken,
        },
      });
      saveConfirmationSnapshot(
        buildSnapshot(data.bookingId, data.manageToken)
      );
      router.push(
        `/${slug}/book/confirmation/${data.bookingId}?t=${encodeURIComponent(data.manageToken)}`
      );
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === "slot_taken") {
        // Slot taken between review and confirm — the same notice pattern.
        update({
          slot: null,
          slotRaceNotice: {
            missedStartsAt: slot.startsAt,
            message: "That slot just filled — here are the closest times.",
          },
        });
        const datetimeIndex = steps.indexOf("datetime");
        if (datetimeIndex >= 0) goToStep(datetimeIndex);
        return;
      }
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setConfirming(false);
    }
  }, [service, slot, state, paid, business, slug, router, steps, goToStep, update, buildSnapshot]);

  React.useEffect(() => {
    setPrimary({
      label: "Confirm booking",
      onClick: confirm,
      disabled: !service || !slot,
      loading: confirming,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirm, confirming, service, slot]);

  if (!service || !slot || !due) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>
          Your booking details are incomplete. Please go back and try again.
        </AlertDescription>
      </Alert>
    );
  }

  const priceLines = paid
    ? state.payment?.amountDueKind === "deposit"
      ? [
          { label: `Deposit paid now`, amountCents: due.dueNowCents },
          { label: `Due at appointment`, amountCents: due.dueLaterCents },
        ]
      : [{ label: `Paid now`, amountCents: due.dueNowCents }]
    : [{ label: `Due at appointment`, amountCents: due.dueLaterCents }];

  const changeLinks = [
    { label: "Service", step: "service" as const },
    { label: "Staff", step: "staff" as const },
    { label: "Date & time", step: "datetime" as const },
    { label: "Details", step: "details" as const },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
        Review your booking
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Check everything looks right before confirming.
      </p>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>Couldn&apos;t confirm your booking</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mt-4">
        <BookingSummaryCard
          lines={[
            {
              icon: "service",
              label: "Service",
              value: `${service.name} · ${service.duration_minutes} min`,
            },
            {
              icon: "staff",
              label: "Staff",
              value:
                state.staffId === "any" && !staffMember
                  ? "First available"
                  : staffMember?.name ?? "First available",
            },
            {
              icon: "datetime",
              label: "When",
              value: dual?.showDual
                ? `${dayLabel} · ${dual.customerLabel} your time (${dual.businessLabel} business time)`
                : `${dayLabel} at ${dual?.customerLabel ?? ""}`,
            },
            {
              icon: "policy",
              label: "Cancellation",
              value:
                "Free cancellation is available until the business's cutoff — the exact window is in your confirmation.",
            },
          ]}
          totalCents={service.price_cents}
        />
      </div>

      {/* Price breakdown */}
      <div className="mt-4 rounded-[0.75rem] border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Price breakdown</h2>
        <dl className="tnum mt-2 flex flex-col gap-1.5 text-sm">
          {priceLines.map((line) => (
            <div key={line.label} className="flex items-center justify-between">
              <dt className="text-muted-foreground">{line.label}</dt>
              <dd className="font-medium">{formatCents(line.amountCents)}</dd>
            </div>
          ))}
          <Separator className="my-1" />
          <div className="flex items-center justify-between">
            <dt className="font-medium">Total</dt>
            <dd className="font-semibold">{formatCents(service.price_cents)}</dd>
          </div>
        </dl>
      </div>

      {/* Change links */}
      <div className="mt-4 flex flex-wrap gap-2">
        {changeLinks.map(({ label, step }) => {
          const index = steps.indexOf(step);
          if (index < 0) return null;
          return (
            <Button
              key={step}
              variant="outline"
              size="sm"
              onClick={() => goToStep(index)}
            >
              <Pencil className="mr-1 size-3.5" aria-hidden />
              Change {label.toLowerCase()}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
