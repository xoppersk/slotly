import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { BookingShell } from "@/components/sl/shells/BookingShell";
import { ButtonLink } from "@/components/sl/Button";
import { StatusPill } from "@/components/sl/StatusPill";
import { formatCents } from "@/lib/format";
import { shellPropsFor } from "../../_lib/shell-props";
import { loadPublicCatalog, loadReceiptBundle } from "../../_lib/server-data";
import { dateLabel, freeCancelLabel, timeLabel } from "../../_lib/types";
import { BookedActions, TokenRecovery } from "./BookedClient";

/**
 * Confirmation — renders the REAL booking from `get_booking_receipt`.
 * The manage token arrives as ?t= (put there by the Review step's
 * redirect; also stored in sessionStorage by Review and recovered by
 * TokenRecovery on revisit). Without a token we can prove nothing, so the
 * page shows the graceful "use the link from your confirmation" state —
 * never fixture data.
 */
export default async function BookedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { slug, id } = await params;
  const { t } = await searchParams;
  const catalog = await loadPublicCatalog(slug);
  if (!catalog) notFound();
  const business = catalog.business;
  const base = `/b/${slug}`;
  const shell = shellPropsFor(business);

  if (!t) {
    return (
      <BookingShell manageHref="#" {...shell}>
        <TokenRecovery bookingId={id} />
        <div className="sl-b-main" style={{ maxWidth: 760 }}>
          <h1 className="sl-b-moment">Your booking is confirmed</h1>
          <p className="sl-b-lead">
            To see the details here, open this page from the link in your
            confirmation — that link is yours alone and it&rsquo;s also how
            you change or cancel. If you just booked on this device, this
            page will reload with your details in a moment.
          </p>
          <div className="sl-b-actions" style={{ marginTop: 28 }}>
            <ButtonLink variant="primary" href={base}>
              Back to {business.name}
            </ButtonLink>
            <ButtonLink href={`${base}/book/service`}>Book another visit</ButtonLink>
          </div>
        </div>
      </BookingShell>
    );
  }

  let bundle: Awaited<ReturnType<typeof loadReceiptBundle>> | null = null;
  try {
    bundle = await loadReceiptBundle(t);
  } catch {
    bundle = null;
  }
  const receipt = bundle?.receipt;
  if (
    !bundle ||
    !receipt ||
    receipt.booking.id !== id ||
    !receipt.business ||
    receipt.business.slug !== slug
  ) {
    return (
      <BookingShell manageHref="#" {...shell}>
        <div className="sl-b-main" style={{ maxWidth: 760 }}>
          <h1 className="sl-b-moment">That link doesn&rsquo;t work</h1>
          <p className="sl-b-lead">
            This confirmation link is invalid or has expired (links last 72
            hours). Your booking itself is still on the shop&rsquo;s books —
            use the newest link from your confirmation, or call{" "}
            {business.phone ?? "the shop"} and they&rsquo;ll sort it out.
          </p>
          <div className="sl-b-actions" style={{ marginTop: 28 }}>
            <ButtonLink variant="primary" href={base}>
              Back to {business.name}
            </ButtonLink>
          </div>
        </div>
      </BookingShell>
    );
  }

  const { booking, service, staff, customer } = receipt;
  const tz = receipt.business.timezone;
  const localDate = formatInTimeZone(new Date(booking.starts_at), tz, "yyyy-MM-dd");
  const firstName = (customer?.name ?? "").split(/\s+/)[0] ?? "";
  const paidCents = receipt.payments
    .filter((p) => p.status === "succeeded")
    .reduce((sum, p) => sum + p.amount_cents, 0);
  const priceCents = service?.price_cents ?? booking.price_cents;
  const depositCents = service?.deposit_cents ?? 0;
  const cancelled = booking.status === "cancelled";

  return (
    <BookingShell manageHref={`/b/${slug}/manage/${t}`} {...shell}>
      <div className="sl-b-main" style={{ maxWidth: 760 }}>
        <h1 className="sl-b-moment">
          {cancelled
            ? "This booking was cancelled."
            : `You're booked${firstName ? `, ${firstName}` : ""}.`}
        </h1>
        <p className="sl-b-lead">
          {dateLabel(localDate)} at {timeLabel(booking.starts_at, tz)}
          {staff ? ` with ${staff.name}` : ""}.
        </p>
        <BookedActions
          slug={slug}
          businessName={receipt.business.name}
          serviceName={service?.name ?? "Your visit"}
          staffName={staff?.name ?? null}
          startsAt={booking.starts_at}
          endsAt={booking.ends_at}
          address={receipt.business.address}
          bookingId={booking.id}
          manageToken={t}
        />
        <div className="sl-b-card" style={{ marginTop: 28 }}>
          <dl className="sl-b-kv">
            <dt>Booking</dt>
            <dd>
              {booking.id.slice(0, 8).toUpperCase()}{" "}
              <StatusPill
                status={cancelled ? "Taken" : "Confirmed"}
                label={cancelled ? "Cancelled" : "Confirmed"}
              />
            </dd>
            <dt>Service</dt>
            <dd>
              {service?.name} · {service?.duration_minutes} min
            </dd>
            <dt>Where</dt>
            <dd>
              {receipt.business.name}
              {receipt.business.address ? `, ${receipt.business.address}` : ""}
            </dd>
            {bundle.freeCancelHours !== null && !cancelled ? (
              <>
                <dt>Free changes until</dt>
                <dd style={{ fontWeight: 400 }}>
                  {freeCancelLabel(booking.starts_at, bundle.freeCancelHours, tz)}.
                  After that the shop&rsquo;s late-change policy applies.
                </dd>
              </>
            ) : null}
            <dt>Paid today</dt>
            <dd>
              {paidCents > 0
                ? formatCents(paidCents)
                : "$0.00 — nothing is charged online"}
            </dd>
            <dt>At the shop</dt>
            <dd>
              {formatCents(Math.max(0, priceCents - paidCents))}
              {depositCents > 0 && paidCents === 0
                ? ` (includes the ${formatCents(depositCents)} deposit)`
                : ""}
            </dd>
          </dl>
        </div>
        <p style={{ marginTop: 16, fontSize: 14, color: "var(--muted)" }}>
          Keep your booking link — it&rsquo;s how you change or cancel, and
          it expires 72 hours after it was issued.
        </p>
      </div>
    </BookingShell>
  );
}
