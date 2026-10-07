"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { HoldCountdown } from "@/components/booking/HoldCountdown";
import { formatCents } from "@/lib/format";
import { amountDueNow } from "@/lib/payments/policy";
import {
  apiJson,
  ApiError,
  type CreateBookingResponse,
  type CreateIntentResponse,
  type ReceiptResponse,
} from "@/lib/booking/public-api";
import { createBookingResponseToPayment, saveConfirmationSnapshot } from "../types";

import type { StepProps } from "../BookingWizard";
import type { WizardStepId } from "../types";

const LazyStripePaymentForm = dynamic(
  () =>
    import("./StripePaymentForm").then((m) => ({
      default: m.StripePaymentForm,
    })),
  { ssr: false, loading: () => <Skeleton className="h-64 rounded-[0.75rem]" /> }
);

interface StepPaymentProps extends StepProps {
  goToStep: (index: number) => void;
  steps: WizardStepId[];
}

type Phase =
  | "creating" // POST /api/bookings (payment_pending + hold)
  | "intent" // POST /api/payments/create-intent
  | "ready" // Payment Element shown
  | "processing" // confirming / polling receipt
  | "failed";

/**
 * Wizard Step 5 — Payment (skipped when the policy is `none`).
 *
 * Entering this step creates the booking as `payment_pending` with a
 * 10-minute slot hold in one transaction (the slot is immediately blocked
 * for other bookers). The Stripe Payment Element lazy-loads via
 * next/dynamic ssr:false. After the card succeeds we poll the receipt until
 * the Stripe webhook confirms, then advance to the review step.
 *
 * Hold expiry (410) redirects to the slot picker with the same
 * service/staff/details preserved and a "That slot was released" notice.
 */
export function StepPayment({
  ctx,
  state,
  update,
  setPrimary,
  goToStep,
  steps,
  slug,
}: StepPaymentProps) {
  const router = useRouter();
  const { business, services, staff: staffList } = ctx;
  const service = services.find((s) => s.id === state.serviceId);
  const slot = state.slot;

  // The step's inputs are frozen for its lifetime; derive the initial phase
  // (and the invalid-inputs error) during render — no setState-in-effect.
  const inputsValid = !!(service && slot);
  const [phase, setPhase] = React.useState<Phase>(() => {
    if (!inputsValid) return "failed";
    if (state.payment) return state.payment.clientSecret ? "ready" : "intent";
    return "creating";
  });
  const [error, setError] = React.useState<string | null>(() =>
    inputsValid
      ? null
      : "The booking details are incomplete. Please go back and try again."
  );
  const [holdExpired, setHoldExpired] = React.useState(false);

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
  const isDev = process.env.NODE_ENV !== "production";

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

  // No footer primary action on this step — the Pay button lives in the form.
  React.useEffect(() => {
    setPrimary(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const releaseSlot = React.useCallback(() => {
    if (!slot) return;
    update({
      payment: null,
      slot: null,
      slotRaceNotice: {
        missedStartsAt: slot.startsAt,
        message: "That slot was released — pick another time.",
      },
    });
    const datetimeIndex = steps.indexOf("datetime");
    if (datetimeIndex >= 0) goToStep(datetimeIndex);
  }, [slot, update, steps, goToStep]);

  // 1) Create the payment_pending booking + hold when the step mounts.
  React.useEffect(() => {
    if (!service || !slot || state.payment) return;
    let cancelled = false;
    (async () => {
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
        if (cancelled) return;
        const payment = createBookingResponseToPayment(data);
        if (!payment) {
          throw new Error("The booking was created but no payment is due.");
        }
        update({ payment });
        setPhase("intent");
      } catch (err: unknown) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === "slot_taken") {
          // Race: the slot filled between picking and paying — never a dead end.
          update({
            payment: null,
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
        setPhase("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only on mount — the inputs are frozen for this step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Create the Payment Intent once the booking exists.
  React.useEffect(() => {
    if (phase !== "intent" || !state.payment || state.payment.clientSecret) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/payments/create-intent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ manageToken: state.payment!.manageToken }),
        });
        const data = await apiJson<CreateIntentResponse>(
          res,
          "Payment setup failed"
        );
        if (cancelled) return;
        update({
          payment: { ...state.payment!, clientSecret: data.clientSecret },
        });
        setPhase("ready");
      } catch (err: unknown) {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 410 || err.code === "hold_expired")) {
          setHoldExpired(true);
          releaseSlot();
          return;
        }
        setError(err instanceof Error ? err.message : "Payment setup failed");
        setPhase("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // 3) After the card confirms, poll the receipt until the webhook lands.
  const pollReceipt = React.useCallback(async () => {
    const token = state.payment?.manageToken;
    if (!token) return;
    setPhase("processing");
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(
          `/api/bookings/receipt?token=${encodeURIComponent(token)}`
        );
        const data = await apiJson<ReceiptResponse>(res, "Receipt lookup failed");
        if (data.booking.status === "confirmed") {
          const reviewIndex = steps.indexOf("review");
          if (reviewIndex >= 0) goToStep(reviewIndex);
          return;
        }
      } catch {
        // Keep polling — the webhook may still be in flight.
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    // Webhook still pending after 60s — send them to the confirmation page,
    // which renders from the wizard snapshot and treats the receipt fetch
    // as enhancement (the token may already be rotated by the webhook).
    const payment = state.payment!;
    saveConfirmationSnapshot({
      bookingId: payment.bookingId,
      manageToken: token,
      serviceName: service?.name ?? "",
      durationMinutes: service?.duration_minutes ?? 0,
      priceCents: service?.price_cents ?? 0,
      staffName:
        staffList.find((m) => m.id === slot?.staffId)?.name ?? null,
      startsAt: slot?.startsAt ?? "",
      endsAt: slot?.endsAt ?? "",
      customerName: state.details.name,
      amountPaidCents: payment.amountDueCents,
      amountDueLaterCents: (service?.price_cents ?? 0) - payment.amountDueCents,
      businessName: business.name,
      businessTimezone: business.timezone,
      businessAddress: business.address ?? null,
      businessPhone: business.phone ?? null,
    });
    router.push(
      `/${slug}/book/confirmation/${payment.bookingId}?t=${encodeURIComponent(token)}`
    );
  }, [state, service, slot, staffList, business, steps, goToStep, slug, router]);

  const onHoldExpire = React.useCallback(() => {
    if (phase === "processing" || holdExpired) return;
    setHoldExpired(true);
    releaseSlot();
  }, [phase, holdExpired, releaseSlot]);

  if (!service || !slot || !due) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>
          The booking details are incomplete. Please go back and try again.
        </AlertDescription>
      </Alert>
    );
  }

  const kind = due.kind; // "deposit" | "full_payment"

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Payment
        </h1>
        {isDev && <Badge variant="warning">Test mode</Badge>}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {kind === "deposit"
          ? `${formatCents(due.dueNowCents)} deposit due now · ${formatCents(
              due.dueLaterCents
            )} due at appointment`
          : `${formatCents(due.dueNowCents)} due now — paid in full`}
      </p>

      {/* Hold countdown */}
      {state.payment && phase !== "processing" && (
        <div className="mt-4">
          <HoldCountdown
            expiresAt={Date.parse(state.payment.holdExpiresAt)}
            onExpire={onHoldExpire}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Your slot is held while you pay — it releases automatically when
            the timer ends.
          </p>
        </div>
      )}

      {phase === "creating" && (
        <div className="mt-6 flex flex-col gap-3" aria-label="Reserving your slot">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-64 rounded-[0.75rem]" />
        </div>
      )}

      {phase === "failed" && error && (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>Payment unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!publishableKey && phase !== "creating" && (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>Payments not configured</AlertTitle>
          <AlertDescription>
            This business hasn&apos;t connected card payments yet. Please book by
            phone instead.
          </AlertDescription>
        </Alert>
      )}

      {phase !== "creating" &&
        phase !== "failed" &&
        publishableKey &&
        state.payment?.clientSecret && (
          <div className="mt-6">
            <LazyStripePaymentForm
              publishableKey={publishableKey}
              clientSecret={state.payment.clientSecret}
              amountCents={state.payment.amountDueCents}
              onPaid={pollReceipt}
              onProcessing={(processing) => {
                if (processing) setPhase("processing");
              }}
            />
          </div>
        )}

      {phase === "processing" && (
        <Alert className="mt-4 border-warning/30 bg-warning/10">
          <AlertTitle>Payment processing…</AlertTitle>
          <AlertDescription>
            Your card was accepted — we&apos;re confirming with the business. This
            usually takes a few seconds.
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <p>
          Payments are processed securely by Stripe. Your payment reference is
          issued after confirmation; refunds follow the business&apos;s cancellation
          policy shown on the review step.
        </p>
      </div>
    </div>
  );
}
