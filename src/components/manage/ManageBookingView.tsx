"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  XCircle,
  MapPin,
  Phone,
  ArrowLeft,
  Check,
} from "lucide-react";

import { BookingSummaryCard } from "@/components/booking/BookingSummaryCard";
import { SlotPill } from "@/components/booking/SlotPill";
import { WeekStrip, type WeekStripDay } from "@/components/booking/WeekStrip";
import { StatusChip } from "@/components/ui/StatusChip";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea, Label } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/EmptyState";
import { Separator } from "@/components/ui/separator";
import { formatCents } from "@/lib/format";
import { formatSlotForCustomer, formatDayLabel } from "@/lib/availability";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import {
  apiJson,
  isValidTokenShape,
  type ReceiptResponse,
  type ManageBookingResponse,
  type ApiDayAvailability,
  type AvailabilityResponse,
  type ApiSlot,
} from "@/lib/booking/public-api";

function ymdOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function dateFromYmd(dateYmd: string): Date {
  const parts = dateYmd.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(y, m - 1, d, 12, 0, 0);
}

function bookingStatusToChip(status: string): Parameters<typeof StatusChip>[0]["status"] {
  switch (status) {
    case "confirmed":
      return "confirmed";
    case "cancelled":
      return "cancelled";
    case "no_show":
      return "no-show";
    case "completed":
      return "completed";
    default:
      return "pending";
  }
}

/**
 * /manage/[token] — magic-link self-service booking management (no login).
 *
 * Loads the booking summary via GET /api/bookings/receipt?token=, then:
 * - Reschedule: scoped slot picker (same service + staff, with a
 *   "change staff" option) → confirm → new booking linked for audit.
 * - Cancel: policy explainer, optional reason → auto-refund notice when the
 *   response carries one.
 * Expired/forged tokens get a "link expired" state with a request-new-link
 * CTA.
 */
export function ManageBookingView({ token }: { token: string }) {
  const router = useRouter();
  const tokenOk = isValidTokenShape(token);

  const [receipt, setReceipt] = React.useState<ReceiptResponse | null>(null);
  const [activeToken, setActiveToken] = React.useState(token);
  const [error, setError] = React.useState<string | null>(null);
  // Malformed tokens never hit the network — the expired state is derived
  // at init, not set inside an effect.
  const [expired, setExpired] = React.useState(() => !tokenOk);
  const [mode, setMode] = React.useState<"view" | "reschedule" | "cancel">("view");

  const customerTimezone = React.useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );

  const loadReceipt = React.useCallback(
    async (t: string) => {
      const res = await fetch(`/api/bookings/receipt?token=${encodeURIComponent(t)}`);
      return apiJson<ReceiptResponse>(res, "Booking lookup failed");
    },
    []
  );

  React.useEffect(() => {
    if (!tokenOk) return;
    let cancelled = false;
    loadReceipt(activeToken)
      .then((data) => {
        if (!cancelled) setReceipt(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "";
        if (/expir|invalid|token/i.test(msg)) setExpired(true);
        else setError(msg || "Booking lookup failed");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeToken]);

  const applyManaged = React.useCallback(
    (data: ManageBookingResponse) => {
      setActiveToken(data.manageToken);
      router.replace(`/manage/${data.manageToken}`);
      loadReceipt(data.manageToken).then(setReceipt).catch(() => undefined);
    },
    [loadReceipt, router]
  );

  // Resolve the public slug for the "Book another visit" action on the
  // cancelled state (the receipt payload carries no slug). These hooks sit
  // above every early return; the effect no-ops until the receipt arrives.
  const [businessSlug, setBusinessSlug] = React.useState<string | null>(null);
  const receiptBusinessId = receipt?.business.id ?? null;
  const receiptCancelled = receipt?.booking.status === "cancelled";
  React.useEffect(() => {
    if (!receiptCancelled || !receiptBusinessId) return;
    let alive = true;
    (async () => {
      try {
        const { data } = await createBrowserClient()
          .from("businesses_public")
          .select("slug")
          .eq("id", receiptBusinessId)
          .single();
        if (alive && data)
          setBusinessSlug((data as { slug: string }).slug);
      } catch {
        /* slug stays unresolved — the copy still reads correctly */
      }
    })();
    return () => {
      alive = false;
    };
  }, [receiptCancelled, receiptBusinessId]);

  if (expired) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-16">
        <EmptyState
          title="This link has expired"
          description="Manage-booking links expire after 72 hours for security."
          actionLabel="Request a new link"
          onAction={() => {
            // No resend-link endpoint exists in the API contract yet (gap:
            // POST /api/bookings/resend-link). Surface the business contact
            // so the customer can still get help.
            setMode("view");
            document
              .getElementById("manage-business-contact")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        />
        <Alert className="mt-4">
          <AlertDescription>
            New-link requests aren&apos;t automated yet — contact the business below
            and they&apos;ll send you a fresh link.
          </AlertDescription>
        </Alert>
        <div id="manage-business-contact" className="mt-6">
          <BusinessContactCard
            name={receipt?.business.name ?? "The business"}
            address={receipt?.business.address ?? null}
            phone={receipt?.business.phone ?? null}
          />
        </div>
      </div>
    );
  }

  if (error && !receipt) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-16">
        <EmptyState
          title="Couldn't load your booking"
          description={error}
          actionLabel="Try again"
          onAction={() => window.location.reload()}
        />
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-10" aria-label="Loading booking">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-52 rounded-[0.75rem]" />
        <Skeleton className="mt-4 h-12 rounded-[0.5rem]" />
      </div>
    );
  }

  const { booking, business, service, staff, customer } = receipt;
  const cancelled = booking.status === "cancelled";
  const dayKey = booking.startsAt.slice(0, 10);
  const dual = formatSlotForCustomer(
    booking.startsAt,
    business.timezone,
    customerTimezone
  );

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8 pb-16">
      <h1 className="text-2xl font-bold tracking-tight">Manage booking</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Booked for {customer.name}
      </p>

      <div className="mt-4 flex items-center gap-2">
        <StatusChip status={bookingStatusToChip(booking.status)} />
        {receipt.payments.some((p) => p.status === "succeeded") && (
          <StatusChip status="succeeded" />
        )}
      </div>

      <div className="mt-4">
        <BookingSummaryCard
          lines={[
            { label: "Service", value: service.name },
            {
              label: "Staff",
              value: staff?.name ?? "First available",
            },
            { label: "Date", value: formatDayLabel(dayKey, business.timezone) },
            {
              label: "Time",
              value: dual.showDual
                ? `${dual.customerLabel} your time (${dual.businessLabel} business time)`
                : dual.customerLabel,
            },
          ]}
        />
      </div>

      {mode === "view" && !cancelled && (
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setMode("reschedule")}
            className="min-h-[48px]"
          >
            <CalendarClock className="mr-1.5 size-4" aria-hidden />
            Reschedule
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => setMode("cancel")}
            className="min-h-[48px] text-destructive hover:text-destructive"
          >
            <XCircle className="mr-1.5 size-4" aria-hidden />
            Cancel
          </Button>
        </div>
      )}

      {cancelled && (
        <Alert className="mt-6">
          <AlertTitle>Your appointment has been cancelled.</AlertTitle>
          <AlertDescription>
            Nothing is owed. If you would still like to visit {business.name},
            choose another time with any available team member.
            {businessSlug && (
              <span className="mt-3 block">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/${businessSlug}`}>Book another visit</Link>
                </Button>
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {mode === "reschedule" && !cancelled && (
        <RescheduleFlow
          token={activeToken}
          receipt={receipt}
          customerTimezone={customerTimezone}
          onDone={applyManaged}
          onBack={() => setMode("view")}
        />
      )}

      {mode === "cancel" && !cancelled && (
        <CancelFlow
          token={activeToken}
          receipt={receipt}
          onDone={(data) => {
            applyManaged(data);
            setMode("view");
          }}
          onBack={() => setMode("view")}
        />
      )}

      <div className="mt-8">
        <BusinessContactCard
          name={business.name}
          address={business.address ?? null}
          phone={business.phone ?? null}
        />
      </div>
    </div>
  );
}

function BusinessContactCard({
  name,
  address,
  phone,
}: {
  name: string;
  address: string | null;
  phone: string | null;
}) {
  return (
    <div className="rounded-[0.75rem] border border-border bg-card p-4 text-sm">
      <p className="font-semibold">{name}</p>
      {address && (
        <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          {address}
        </p>
      )}
      {phone && (
        <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
          <Phone className="size-3.5 shrink-0" aria-hidden />
          <a
            href={`tel:${phone.replace(/[^+\d]/g, "")}`}
            className="underline-offset-2 hover:underline"
          >
            {phone}
          </a>
        </p>
      )}
    </div>
  );
}

/**
 * Reschedule sub-flow: scoped slot picker (same service + staff, with a
 * "change staff" option) → confirm. The manage response rotates the token
 * and links the new booking to the original for audit.
 */
function RescheduleFlow({
  token,
  receipt,
  customerTimezone,
  onDone,
  onBack,
}: {
  token: string;
  receipt: ReceiptResponse;
  customerTimezone: string;
  onDone: (data: ManageBookingResponse) => void;
  onBack: () => void;
}) {
  const { business, service, staff } = receipt;
  const [changeStaff, setChangeStaff] = React.useState(false);
  const [days, setDays] = React.useState<ApiDayAvailability[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [dayKey, setDayKey] = React.useState<string | null>(null);
  const [slot, setSlot] = React.useState<ApiSlot | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<ManageBookingResponse | null>(null);

  const staffId = changeStaff ? "any" : staff?.id ?? "any";

  // Reset the picker when the staff scope changes (render-time derived
  // state instead of setState-in-effect).
  const scopeKey = `${business.id}|${service.id}|${staffId}`;
  const [lastScopeKey, setLastScopeKey] = React.useState(scopeKey);
  if (scopeKey !== lastScopeKey) {
    setLastScopeKey(scopeKey);
    setDays(null);
    setLoading(true);
    setDayKey(null);
    setSlot(null);
    setError(null);
  }

  React.useEffect(() => {
    let cancelled = false;
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 21);
    const params = new URLSearchParams({
      businessId: business.id,
      serviceId: service.id,
      staffId,
      from: ymdOf(from),
      to: ymdOf(to),
    });
    fetch(`/api/availability?${params.toString()}`)
      .then((res) => apiJson<AvailabilityResponse>(res, "Couldn't load times"))
      .then((data) => {
        if (cancelled) return;
        setDays(data.days);
        setLoading(false);
        const firstOpen = data.days.find((d) => d.slots.length > 0);
        setDayKey(firstOpen?.date ?? null);
        setSlot(null);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  const daysByDate = React.useMemo(
    () => new Map((days ?? []).map((d) => [d.date, d])),
    [days]
  );
  const selectedDay = dayKey ? daysByDate.get(dayKey) ?? null : null;

  const weekDays: WeekStripDay[] = React.useMemo(
    () =>
      (days ?? []).slice(0, 7).map((d) => ({
        date: dateFromYmd(d.date),
        status:
          d.status === "closed"
            ? "closed"
            : d.slots.length === 0
              ? "full"
              : "available",
      })),
    [days]
  );

  const confirm = async () => {
    if (!slot) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings/manage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          action: "reschedule",
          newStartsAt: slot.startsAt,
          newEndsAt: slot.endsAt,
          newStaffId: slot.staffId,
        }),
      });
      const data = await apiJson<ManageBookingResponse>(res, "Reschedule failed");
      setDone(data);
      onDone(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Reschedule failed");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    const newDual = formatSlotForCustomer(
      done.booking.startsAt,
      business.timezone,
      customerTimezone
    );
    return (
      <Alert className="mt-6 border-success/30 bg-success/10">
        <Check className="size-4 text-success" aria-hidden />
        <AlertTitle>Rescheduled</AlertTitle>
        <AlertDescription>
          <p>
            Your new time:{" "}
            <strong className="tnum">
              {formatDayLabel(done.booking.startsAt.slice(0, 10), business.timezone)}{" "}
              at {newDual.customerLabel}
            </strong>
            . The old slot was freed and the business was notified.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={onBack}>
            Back to booking details
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mt-6 rounded-[0.75rem] border border-border bg-card p-4">
      <h2 className="text-[15px] font-semibold">Pick a new time</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {service.name}
        {staff && !changeStaff ? ` with ${staff.name}` : ""}
      </p>

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={changeStaff}
          onChange={(e) => setChangeStaff(e.target.checked)}
          className="size-4 accent-primary"
        />
        Change staff (show all availability)
      </label>

      {loading ? (
        <div className="mt-3 flex gap-2" aria-label="Loading days">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-16 w-14 rounded-[0.75rem]" />
          ))}
        </div>
      ) : (
        <>
          <WeekStrip
            days={weekDays}
            selected={dayKey ? dateFromYmd(dayKey) : null}
            onSelect={(d) => {
              const day = daysByDate.get(ymdOf(d));
              if (day && day.slots.length > 0) {
                setDayKey(day.date);
                setSlot(null);
              }
            }}
            className="mt-3"
          />
          {selectedDay && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {selectedDay.slots.map((s) => {
                const key = `${s.startsAt}-${s.staffId}`;
                const isSelected =
                  slot?.startsAt === s.startsAt && slot?.staffId === s.staffId;
                const dual = formatSlotForCustomer(
                  s.startsAt,
                  business.timezone,
                  customerTimezone
                );
                return (
                  <SlotPill
                    key={key}
                    state={isSelected ? "selected" : "available"}
                    aria-pressed={isSelected}
                    onClick={() => setSlot(s)}
                  >
                    {dual.customerLabel}
                  </SlotPill>
                );
              })}
            </div>
          )}
        </>
      )}

      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertTitle>Couldn&apos;t reschedule</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mt-4 flex gap-2">
        <Button variant="outline" onClick={onBack} className="min-h-[48px] flex-1">
          Back
        </Button>
        <Button
          variant="primary"
          onClick={confirm}
          disabled={!slot || saving}
          className="min-h-[48px] flex-1"
        >
          {saving ? "Rescheduling…" : "Confirm new time"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Cancel sub-flow: policy explainer, optional reason → confirm. A paid
 * booking inside the free-cancel window shows the auto-refund notice with
 * the refund reference; outside the window it explains the owner will
 * review.
 */
function CancelFlow({
  token,
  receipt,
  onDone,
  onBack,
}: {
  token: string;
  receipt: ReceiptResponse;
  onDone: (data: ManageBookingResponse) => void;
  onBack: () => void;
}) {
  const { business } = receipt;
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ManageBookingResponse | null>(null);

  const paid = receipt.payments.some((p) => p.status === "succeeded");
  const freeCancelUntil = receipt.booking.freeCancelUntil ?? null;
  // Captured once — Date.now() is impure and must not run during render.
  const [nowMs] = React.useState(() => Date.now());
  const inFreeWindow = freeCancelUntil
    ? Date.parse(freeCancelUntil) > nowMs
    : null;

  const confirm = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings/manage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          action: "cancel",
          reason: reason.trim() || undefined,
        }),
      });
      const data = await apiJson<ManageBookingResponse>(res, "Cancellation failed");
      setResult(data);
      onDone(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Cancellation failed");
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <Alert className="mt-6">
        <AlertTitle>Booking cancelled</AlertTitle>
        <AlertDescription>
          {result.refund ? (
            <p>
              Your {formatCents(result.refund.amountCents)} refund was issued —
              reference{" "}
              <span className="font-mono text-xs">{result.refund.reference}</span>.
              It arrives in 5–10 business days.
            </p>
          ) : inFreeWindow === false ? (
            <p>
              This booking is past the free-cancel window, so the business will
              review your cancellation and confirm any refund by email.
            </p>
          ) : (
            <p>The business has been notified. Your time slot was released.</p>
          )}
          <Button variant="outline" size="sm" className="mt-3" onClick={onBack}>
            <ArrowLeft className="mr-1 size-3.5" aria-hidden />
            Back to booking details
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mt-6 rounded-[0.75rem] border border-border bg-card p-4">
      <h2 className="text-[15px] font-semibold">Cancel this booking?</h2>
      <div className="mt-2 text-sm text-muted-foreground">
        {freeCancelUntil ? (
          <p>
            Free cancellation until{" "}
            <strong className="tnum text-foreground">
              {formatSlotForCustomer(
                freeCancelUntil,
                business.timezone,
                Intl.DateTimeFormat().resolvedOptions().timeZone
              ).customerLabel}{" "}
              on {formatDayLabel(freeCancelUntil.slice(0, 10), business.timezone)}
            </strong>
            .
            {paid && inFreeWindow && (
              <> Your payment will be refunded automatically.</>
            )}
            {inFreeWindow === false && (
              <>
                {" "}You&apos;re past that window — the owner will review your
                cancellation.
              </>
            )}
          </p>
        ) : (
          <p>Cancelling releases your time slot immediately.</p>
        )}
      </div>

      <div className="mt-4">
        <Label htmlFor="cancel-reason">Reason (optional)</Label>
        <Textarea
          id="cancel-reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Anything the business should know?"
          className="mt-1"
        />
      </div>

      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertTitle>Couldn&apos;t cancel</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Separator className="my-4" />
      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="min-h-[48px] flex-1">
          Keep booking
        </Button>
        <Button
          variant="destructive"
          onClick={confirm}
          disabled={saving}
          className="min-h-[48px] flex-1"
        >
          {saving ? "Cancelling…" : "Cancel booking"}
        </Button>
      </div>
    </div>
  );
}
