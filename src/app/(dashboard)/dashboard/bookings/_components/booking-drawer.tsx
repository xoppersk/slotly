"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Phone, Mail, StickyNote } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCents } from "@/lib/format";
import {
  formatDateTimeLabel,
  formatTimeShort,
  formatDateShort,
} from "@/lib/dashboard/format";
import { getBookingDetail, type BookingDetail } from "../../../_actions/bookings";
import { BookingStatusChip } from "../../../_components/booking-status-chip";
import { BookingActions, RefundBlock } from "./booking-actions";

interface BookingDrawerProps {
  businessId: string;
  bookingId: string;
  timezone: string;
  role: "owner" | "staff";
  freeCancelHours: number;
}

/**
 * Booking detail drawer (Sheet): customer info, booking facts, payment
 * block with refunds, history timeline, and the action row. Open state is
 * driven by the `?booking=` URL param so rows link straight into it.
 */
export function BookingDrawer({
  businessId,
  bookingId,
  timezone,
  role,
  freeCancelHours,
}: BookingDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("booking");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, pathname, searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getBookingDetail(businessId, bookingId);
      if (!cancelled) {
        setDetail(result);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, bookingId, version]);

  const refresh = useCallback(() => {
    setLoading(true);
    setVersion((v) => v + 1);
  }, []);

  return (
    <Sheet
      open
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-md"
        aria-label="Booking details"
      >
        {loading || !detail ? (
          <div className="flex flex-col gap-3 p-6">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-40 w-full rounded-[0.75rem]" />
            <Skeleton className="h-24 w-full rounded-[0.75rem]" />
          </div>
        ) : (
          <DrawerBody
            detail={detail}
            businessId={businessId}
            timezone={timezone}
            role={role}
            freeCancelHours={freeCancelHours}
            onChanged={refresh}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({
  detail,
  businessId,
  timezone,
  role,
  freeCancelHours,
  onChanged,
}: {
  detail: BookingDetail;
  businessId: string;
  timezone: string;
  role: "owner" | "staff";
  freeCancelHours: number;
  onChanged: () => void;
}) {
  const { booking, service, staff, customer } = detail;

  return (
    <>
      <SheetHeader className="px-6 pt-6 text-left">
        <div className="flex items-center justify-between gap-2 pr-8">
          <SheetTitle className="truncate">
            {customer?.name ?? "Booking"}
          </SheetTitle>
          <BookingStatusChip status={booking.status} />
        </div>
        <SheetDescription className="tnum">
          {formatDateTimeLabel(booking.starts_at, timezone)}
          {" · "}
          {formatTimeShort(booking.starts_at, timezone)} –{" "}
          {formatTimeShort(booking.ends_at, timezone)}
        </SheetDescription>
      </SheetHeader>

      <ScrollArea className="flex-1 px-6 py-4">
        <div className="flex flex-col gap-5 pb-6">
          {/* Customer */}
          <section aria-label="Customer">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Customer
            </h3>
            <div className="rounded-[0.75rem] border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{customer?.name ?? "—"}</p>
                {customer && (
                  <Link
                    href={`/dashboard/customers?customer=${customer.id}`}
                    className="text-xs text-primary underline-offset-4 hover:underline"
                  >
                    View profile
                  </Link>
                )}
              </div>
              {customer?.phone && (
                <p className="tnum mt-1 flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="size-3.5" aria-hidden />
                  {customer.phone}
                </p>
              )}
              {customer?.email && (
                <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="size-3.5" aria-hidden />
                  {customer.email}
                </p>
              )}
              {customer && (
                <div className="tnum mt-2 flex gap-3 text-xs text-muted-foreground">
                  <span>{customer.total_visits} visits</span>
                  <span
                    className={
                      customer.no_show_count > 0
                        ? "font-medium text-destructive"
                        : undefined
                    }
                  >
                    {customer.no_show_count} no-shows
                  </span>
                </div>
              )}
              {customer?.notes && (
                <p className="mt-2 flex items-start gap-1.5 rounded-[0.5rem] bg-muted p-2 text-xs">
                  <StickyNote className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {customer.notes}
                </p>
              )}
            </div>
          </section>

          {/* Booking facts */}
          <section aria-label="Booking details">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Booking
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-[0.75rem] border border-border p-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Service</dt>
                <dd className="font-medium">{service?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Staff</dt>
                <dd className="font-medium">{staff?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Duration</dt>
                <dd className="tnum">{service?.duration_minutes ?? "—"} min</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Price</dt>
                <dd className="tnum font-medium">{formatCents(booking.price_cents)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Source</dt>
                <dd className="capitalize">{booking.source.replace("_", " ")}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Reference</dt>
                <dd className="tnum">{booking.id.slice(0, 8).toUpperCase()}</dd>
              </div>
            </dl>
            {booking.customer_notes && (
              <p className="mt-2 rounded-[0.5rem] bg-muted p-2 text-xs">
                <span className="font-medium">Customer notes: </span>
                {booking.customer_notes}
              </p>
            )}
            {booking.internal_notes && (
              <p className="mt-2 rounded-[0.5rem] border border-dashed border-border p-2 text-xs text-muted-foreground">
                <span className="font-medium">Internal: </span>
                {booking.internal_notes}
              </p>
            )}
          </section>

          {/* Payment */}
          {role === "owner" && (
            <section aria-label="Payment">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Payment
              </h3>
              <div className="flex flex-col gap-3 rounded-[0.75rem] border border-border p-3">
                <div className="flex items-center justify-between">
                  <StatusChip status={paymentChip(detail)} />
                  <span className="tnum text-sm font-semibold">
                    {formatCents(detail.paidCents)}
                    {detail.refundedCents > 0 && (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        ({formatCents(detail.refundedCents)} refunded)
                      </span>
                    )}
                  </span>
                </div>
                <RefundBlock detail={detail} businessId={businessId} onRefunded={onChanged} />
                {detail.refunds.length > 0 && (
                  <div className="flex flex-col gap-1 border-t border-border pt-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Refund history
                    </p>
                    {detail.refunds.map((r) => (
                      <p key={r.id} className="tnum text-xs text-muted-foreground">
                        {formatCents(r.amount_cents)} · {r.status}
                        {r.reason ? ` · ${r.reason}` : ""} ·{" "}
                        {formatDateShort(r.created_at, timezone)}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* History */}
          <section aria-label="History">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              History
            </h3>
            <ol className="flex flex-col gap-0">
              {detail.history.map((h, i) => (
                <li key={`${h.at}-${i}`} className="relative flex gap-3 pb-3 last:pb-0">
                  <span
                    aria-hidden
                    className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                  />
                  {i < detail.history.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute left-[3px] top-4 h-[calc(100%-12px)] w-px bg-border"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{h.label}</p>
                    <p className="tnum text-xs text-muted-foreground">
                      {formatDateTimeLabel(h.at, timezone)}
                      {h.detail ? ` · ${h.detail}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <Separator />

          {/* Actions */}
          <BookingActions
            detail={detail}
            businessId={businessId}
            timezone={timezone}
            onChanged={onChanged}
          />
          <p className="tnum text-xs text-muted-foreground">
            Free cancellation until{" "}
            {detail.freeCancelUntil
              ? formatDateTimeLabel(detail.freeCancelUntil, timezone)
              : "—"}{" "}
            ({freeCancelHours}h policy).
          </p>
        </div>
      </ScrollArea>
    </>
  );
}

function paymentChip(detail: BookingDetail) {
  if (detail.paidCents > 0) {
    return detail.refundedCents >= detail.paidCents ? "refunded" : "succeeded";
  }
  if (detail.booking.status === "payment_failed") return "failed";
  if (detail.booking.status === "payment_pending") return "pending";
  return "unpaid";
}
