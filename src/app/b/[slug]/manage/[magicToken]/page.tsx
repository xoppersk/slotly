import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { BookingShell } from "@/components/sl/shells/BookingShell";
import { ButtonLink } from "@/components/sl/Button";
import { StatusPill } from "@/components/sl/StatusPill";
import { formatCents } from "@/lib/format";
import { shellPropsFor } from "../../_lib/shell-props";
import { loadPublicCatalog, loadReceiptBundle } from "../../_lib/server-data";
import { dateLabel, endTimeLabel, freeCancelLabel, timeLabel } from "../../_lib/types";
import { ManageActions } from "./ManageClient";

/**
 * Manage a booking — server-rendered from `get_booking_receipt(p_token)`
 * (manage_booking itself only accepts cancel/reschedule in migration
 * 00010; the receipt RPC is the token's read path). Cancel + reschedule
 * run through manage_booking, which rotates the token after each action.
 * Invalid/expired token → the drawn error state, never a crash.
 */
export default async function ManagePage({
  params,
}: {
  params: Promise<{ slug: string; magicToken: string }>;
}) {
  const { slug, magicToken } = await params;
  const catalog = await loadPublicCatalog(slug);
  if (!catalog) notFound();
  const base = `/b/${slug}`;
  const shell = shellPropsFor(catalog.business);

  let bundle: Awaited<ReturnType<typeof loadReceiptBundle>> | null = null;
  let failure: "invalid" | "expired" | null = null;
  try {
    bundle = await loadReceiptBundle(magicToken);
  } catch (err) {
    failure =
      err instanceof Error && err.message.includes("manage_token_expired")
        ? "expired"
        : "invalid";
  }
  const receipt = bundle?.receipt;
  if (!bundle || !receipt || !receipt.business || receipt.business.slug !== slug) {
    return (
      <BookingShell manageHref="#" {...shell}>
        <div className="sl-b-main" style={{ maxWidth: 760 }}>
          <h1 className="sl-b-moment">
            {failure === "expired"
              ? "This link has expired."
              : "This link doesn't work."}
          </h1>
          <p className="sl-b-lead">
            {failure === "expired"
              ? "Booking links last 72 hours. Your booking itself is still on the shop's books — call them and they'll help you change it."
              : "We couldn't find a booking for this link. It may have been replaced by a newer one — every time a booking is moved or cancelled, a fresh link is issued and the old one stops working."}
          </p>
          <div className="sl-b-card" style={{ marginTop: 28 }}>
            <div className="sl-b-actions">
              <ButtonLink variant="primary" href={`${base}/book/service`}>
                Book a visit
              </ButtonLink>
              <ButtonLink href={base}>Back to {catalog.business.name}</ButtonLink>
            </div>
            {catalog.business.phone ? (
              <p style={{ marginTop: 16, fontSize: 14, color: "var(--muted)" }}>
                Need a hand? Call {catalog.business.phone}.
              </p>
            ) : null}
          </div>
        </div>
      </BookingShell>
    );
  }

  const { booking, service, staff } = receipt;
  const tz = receipt.business.timezone;
  const localDate = formatInTimeZone(new Date(booking.starts_at), tz, "yyyy-MM-dd");
  const startLabel = timeLabel(booking.starts_at, tz);
  const endLabel = endTimeLabel(startLabel, service?.duration_minutes ?? 0);
  const paidCents = receipt.payments
    .filter((p) => p.status === "succeeded")
    .reduce((sum, p) => sum + p.amount_cents, 0);
  const priceCents = service?.price_cents ?? booking.price_cents;
  const depositCents = service?.deposit_cents ?? 0;
  const cancelled = booking.status === "cancelled";
  const freeCancel =
    bundle.freeCancelHours !== null
      ? freeCancelLabel(booking.starts_at, bundle.freeCancelHours, tz)
      : null;
  const withinFreeWindow =
    bundle.freeCancelHours !== null &&
    new Date().getTime() <=
      Date.parse(booking.starts_at) - bundle.freeCancelHours * 3_600_000;

  if (cancelled) {
    return (
      <BookingShell manageHref="#" {...shell}>
        <div className="sl-b-main" style={{ maxWidth: 760 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--oxblood)" }}>
            Booking {booking.id.slice(0, 8).toUpperCase()}
          </p>
          <h1 className="sl-b-moment" style={{ marginTop: 10 }}>
            Your appointment is cancelled.
          </h1>
          <p className="sl-b-lead">
            {paidCents > 0
              ? `You paid ${formatCents(paidCents)} online — the shop will confirm any refund with you directly.`
              : "Nothing was charged online, so there's nothing to refund and nothing else is owed."}
          </p>
          <div className="sl-b-card" style={{ marginTop: 28 }}>
            <dl className="sl-b-kv">
              <dt>Was</dt>
              <dd>
                {dateLabel(localDate)} · {startLabel}
              </dd>
              <dt>Service</dt>
              <dd>{service?.name}</dd>
              <dt>Status</dt>
              <dd>Cancelled</dd>
            </dl>
            <div className="sl-b-actions">
              <ButtonLink variant="primary" href={`${base}/book/service`}>
                Book another visit
              </ButtonLink>
              <ButtonLink href={base}>Back to {receipt.business.name}</ButtonLink>
            </div>
          </div>
        </div>
      </BookingShell>
    );
  }

  return (
    <BookingShell manageHref="#" {...shell}>
      <div className="sl-b-main" style={{ maxWidth: 760 }}>
        <p style={{ fontSize: 14, color: "var(--muted)" }}>
          Opened from your booking link ·{" "}
          <Link href={base}>Not you?</Link>
        </p>
        <h1 className="sl-b-moment" style={{ marginTop: 12 }}>
          Your booking
        </h1>
        <p className="sl-b-lead">
          {dateLabel(localDate)}
          <br />
          {startLabel} – {endLabel}&nbsp;{" "}
          <StatusPill status="Confirmed" />
        </p>
        <div className="sl-b-card" style={{ marginTop: 28 }}>
          <dl className="sl-b-kv">
            <dt>Service</dt>
            <dd>
              {service?.name} · {service?.duration_minutes} min ·{" "}
              {formatCents(priceCents)}
            </dd>
            <dt>Barber</dt>
            <dd>{staff?.name ?? "First available"}</dd>
            <dt>Where</dt>
            <dd>
              {receipt.business.name}
              {receipt.business.address ? `, ${receipt.business.address}` : ""}
            </dd>
            <dt>Due at the shop</dt>
            <dd>
              {formatCents(Math.max(0, priceCents - paidCents))}
              {depositCents > 0 && paidCents === 0
                ? ` (includes the ${formatCents(depositCents)} deposit)`
                : ""}
            </dd>
            <dt>Booking</dt>
            <dd>{booking.id.slice(0, 8).toUpperCase()}</dd>
          </dl>
          <ManageActions
            slug={slug}
            token={magicToken}
            businessId={receipt.business.id}
            serviceId={booking.service_id}
            staffId={booking.staff_id}
            startsAt={booking.starts_at}
            endsAt={booking.ends_at}
            businessName={receipt.business.name}
            serviceName={service?.name ?? "Your visit"}
            staffName={staff?.name ?? null}
            address={receipt.business.address}
            bookingId={booking.id}
            timezone={tz}
          />
        </div>
        <div className="sl-b-card" style={{ marginTop: 20 }}>
          <h2 style={{ font: "600 20px/1.25 var(--font-display)", marginBottom: 12 }}>
            Changing your plans
          </h2>
          {freeCancel ? (
            <p style={{ fontSize: 15, lineHeight: 1.6 }}>
              <b>
                {withinFreeWindow
                  ? `Free until ${freeCancel}.`
                  : `The free-change window ended ${freeCancel}.`}
              </b>
            </p>
          ) : null}
          <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 1.7, fontSize: 15 }}>
            <li>
              <b>Move it</b> — pick a new time above; nothing extra is due.
            </li>
            <li>
              <b>Cancel</b> — nothing was charged online, so cancelling
              simply frees the chair.
            </li>
          </ul>
          {receipt.business.phone ? (
            <p style={{ marginTop: 14, fontSize: 14, color: "var(--muted)" }}>
              Running late on the day? Call {receipt.business.phone}.
            </p>
          ) : null}
        </div>
      </div>
    </BookingShell>
  );
}
