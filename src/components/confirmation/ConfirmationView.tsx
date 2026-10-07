"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BellRing, MapPin, Phone, Pencil } from "lucide-react";

import { BookingSummaryCard } from "@/components/booking/BookingSummaryCard";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/EmptyState";
import { SuccessCheck } from "./SuccessCheck";
import { AddToCalendarMenu, ReceiptBlock } from "./CalendarAndReceipt";
import { formatSlotForCustomer, formatDayLabel } from "@/lib/availability";
import {
  apiJson,
  isValidTokenShape,
  type ReceiptResponse,
} from "@/lib/booking/public-api";
import {
  loadConfirmationSnapshot,
  type ConfirmationSnapshot,
} from "@/components/wizard/types";

/**
 * ConfirmationView — /[slug]/book/confirmation/[bookingId].
 *
 * Token-rotation resilient: manage tokens rotate after payment (the Stripe
 * webhook mints a fresh one for the confirmation email), so the token the
 * wizard holds may be stale and GET /api/bookings/receipt?token= can return
 * 400/410 post-payment. The confirmation therefore renders from the
 * wizard's sessionStorage snapshot (saved before navigation) and treats the
 * receipt fetch as enhancement — a failed post-payment receipt fetch still
 * shows the full success state, never an error screen. The email link
 * carries the fresh token for later management.
 *
 * When the receipt DOES resolve, it wins: it carries the live payment
 * state, the rotated manage token, and authoritative receipt lines.
 */
export function ConfirmationView({
  slug,
  bookingId,
}: {
  slug: string;
  bookingId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("t") ?? "";
  const tokenOk = isValidTokenShape(token);

  const [snapshot] = React.useState<ConfirmationSnapshot | null>(() =>
    loadConfirmationSnapshot(bookingId)
  );
  const [receipt, setReceipt] = React.useState<ReceiptResponse | null>(null);
  const [error, setError] = React.useState<string | null>(() =>
    !snapshot && !tokenOk ? "This confirmation link is invalid." : null
  );

  const customerTimezone = React.useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );

  // Receipt fetch = enhancement. Failures are swallowed when the snapshot
  // already gives us a full success state; they only surface when there is
  // nothing else to render from.
  React.useEffect(() => {
    if (!tokenOk) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/bookings/receipt?token=${encodeURIComponent(token)}`
        );
        const data = await apiJson<ReceiptResponse>(res, "Receipt lookup failed");
        if (cancelled) return;
        if (data.booking.id !== bookingId) {
          if (!snapshot) setError("Booking not found.");
          return;
        }
        setReceipt(data);
        if (data.booking.status !== "confirmed" && data.booking.status !== "completed") {
          timer = setTimeout(poll, 2000);
        }
      } catch {
        if (cancelled) return;
        // Stale (rotated) token or network failure: the snapshot still
        // renders the full success state. Only error when we have nothing.
        if (!snapshot) {
          setError(
            "We couldn't load this booking. It may have been cancelled, or the link is wrong."
          );
        }
      }
    };
    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tokenOk]);

  // ---- View model: receipt wins, snapshot is the resilient fallback ----
  const view = React.useMemo(() => {
    if (receipt) {
      const dayKey = receipt.booking.startsAt.slice(0, 10);
      const dual = formatSlotForCustomer(
        receipt.booking.startsAt,
        receipt.business.timezone,
        customerTimezone
      );
      return {
        headline: `You're booked for ${formatDayLabel(dayKey, receipt.business.timezone)} at ${dual.customerLabel}`,
        subline: `${receipt.service.name} with ${receipt.staff?.name ?? receipt.business.name} · booked for ${receipt.customer.name}`,
        lines: [
          { icon: "service" as const, label: "Service", value: receipt.service.name },
          {
            icon: "staff" as const,
            label: "Staff",
            value: receipt.staff?.name ?? "First available",
          },
          {
            icon: "datetime" as const,
            label: "When",
            value: dual.showDual
              ? `${formatDayLabel(dayKey, receipt.business.timezone)} · ${dual.customerLabel} your time (${dual.businessLabel} business time)`
              : `${formatDayLabel(dayKey, receipt.business.timezone)} at ${dual.customerLabel}`,
          },
        ],
        payments: receipt.payments.map((p) => ({
          amountCents: p.amountCents,
          status: p.status,
          paymentReference: p.paymentReference ?? null,
        })),
        receiptLines: receipt.receiptLines,
        processing:
          receipt.booking.status !== "confirmed" &&
          receipt.booking.status !== "completed",
        event: {
          title: `${receipt.service.name} — ${receipt.business.name}`,
          startsAtUtcIso: receipt.booking.startsAt,
          endsAtUtcIso: receipt.booking.endsAt,
        },
        businessName: receipt.business.name,
        businessAddress: receipt.business.address ?? null,
        businessPhone: receipt.business.phone ?? null,
        manageToken:
          receipt.booking.manageToken ?? snapshot?.manageToken ?? token,
      };
    }
    if (snapshot) {
      const dayKey = snapshot.startsAt.slice(0, 10);
      const dual = formatSlotForCustomer(
        snapshot.startsAt,
        snapshot.businessTimezone,
        customerTimezone
      );
      const lines =
        snapshot.amountPaidCents > 0
          ? [
              { label: "Paid now", amountCents: snapshot.amountPaidCents },
              {
                label: "Due at appointment",
                amountCents: snapshot.amountDueLaterCents,
              },
            ]
          : [
              {
                label: "Due at appointment",
                amountCents: snapshot.amountDueLaterCents,
              },
            ];
      return {
        headline: `You're booked for ${formatDayLabel(dayKey, snapshot.businessTimezone)} at ${dual.customerLabel}`,
        subline: `${snapshot.serviceName} with ${snapshot.staffName ?? snapshot.businessName} · booked for ${snapshot.customerName}`,
        lines: [
          { icon: "service" as const, label: "Service", value: snapshot.serviceName },
          {
            icon: "staff" as const,
            label: "Staff",
            value: snapshot.staffName ?? "First available",
          },
          {
            icon: "datetime" as const,
            label: "When",
            value: dual.showDual
              ? `${formatDayLabel(dayKey, snapshot.businessTimezone)} · ${dual.customerLabel} your time (${dual.businessLabel} business time)`
              : `${formatDayLabel(dayKey, snapshot.businessTimezone)} at ${dual.customerLabel}`,
          },
        ],
        payments: snapshot.amountPaidCents > 0
          ? [
              {
                amountCents: snapshot.amountPaidCents,
                status: "succeeded",
                paymentReference: null,
              },
            ]
          : [],
        receiptLines: lines,
        processing: false,
        event: {
          title: `${snapshot.serviceName} — ${snapshot.businessName}`,
          startsAtUtcIso: snapshot.startsAt,
          endsAtUtcIso: snapshot.endsAt,
        },
        businessName: snapshot.businessName,
        businessAddress: snapshot.businessAddress,
        businessPhone: snapshot.businessPhone,
        manageToken: snapshot.manageToken ?? token,
      };
    }
    return null;
  }, [receipt, snapshot, customerTimezone, token]);

  if (!view) {
    if (error) {
      return (
        <div className="mx-auto w-full max-w-2xl px-4 py-16">
          <EmptyState
            title="Booking not found"
            description={error}
            actionLabel="Back to business page"
            onAction={() => router.push(`/${slug}`)}
          />
        </div>
      );
    }
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10" aria-label="Loading confirmation">
        <Skeleton className="mx-auto size-20 rounded-full" />
        <Skeleton className="mx-auto mt-4 h-8 w-64" />
        <Skeleton className="mt-6 h-48 rounded-[0.75rem]" />
        <Skeleton className="mt-4 h-32 rounded-[0.75rem]" />
      </div>
    );
  }

  const manageUrl = view.manageToken ? `/manage/${view.manageToken}` : `/${slug}`;
  const manageAbsolute =
    typeof window !== "undefined" ? `${window.location.origin}${manageUrl}` : manageUrl;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 pb-16">
      <div className="flex flex-col items-center text-center">
        <SuccessCheck />
        <h1 className="tnum mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
          {view.headline}
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground">{view.subline}</p>
      </div>

      {view.processing && (
        <Alert className="mt-6 border-warning/30 bg-warning/10">
          <AlertTitle>Payment processing…</AlertTitle>
          <AlertDescription>
            Your card was accepted — we are waiting on final confirmation. This
            page updates automatically.
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-6">
        <BookingSummaryCard lines={view.lines} />
      </div>

      <div className="mt-4">
        <ReceiptBlock payments={view.payments} receiptLines={view.receiptLines} />
      </div>

      {/* Calendar capture */}
      <section aria-label="Add to calendar" className="mt-6">
        <h2 className="text-sm font-semibold">Add to your calendar</h2>
        <div className="mt-2">
          <AddToCalendarMenu
            event={{
              title: view.event.title,
              description: `Booked via Slotly. Manage: ${manageAbsolute}`,
              location: view.businessAddress ?? view.businessName,
              startsAtUtcIso: view.event.startsAtUtcIso,
              endsAtUtcIso: view.event.endsAtUtcIso,
              url: manageAbsolute,
            }}
          />
        </div>
      </section>

      {/* What happens next */}
      <Card className="mt-6">
        <CardContent className="flex flex-col gap-3 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <BellRing className="size-4 text-primary" aria-hidden />
            What happens next
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>
              We will send reminders 24 hours and 2 hours before your visit.
            </li>
            <li>
              A manage-booking link was sent to your email/SMS — use it to
              reschedule or cancel.
            </li>
            <li>
              Free cancellation is available until the business&apos;s cutoff,
              shown in your confirmation message.
            </li>
          </ul>
          <Separator />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={manageUrl}>
                <Pencil className="mr-1 size-3.5" aria-hidden />
                Manage this booking
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Business contact */}
      <Card className="mt-4">
        <CardContent className="flex flex-col gap-2 p-4 text-sm">
          <p className="font-semibold">{view.businessName}</p>
          {view.businessAddress && (
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {view.businessAddress}
            </p>
          )}
          {view.businessPhone && (
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="size-3.5 shrink-0" aria-hidden />
              <a
                href={`tel:${view.businessPhone.replace(/[^+\d]/g, "")}`}
                className="underline-offset-2 hover:underline"
              >
                {view.businessPhone}
              </a>
            </p>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Booking reference: <span className="font-mono">{bookingId.slice(0, 8)}</span>
      </p>
    </div>
  );
}
