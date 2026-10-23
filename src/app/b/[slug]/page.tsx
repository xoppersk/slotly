import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingShell } from "@/components/sl/shells/BookingShell";
import { ButtonLink } from "@/components/sl/Button";
import { formatCents } from "@/lib/format";
import { shellPropsFor } from "./_lib/shell-props";
import { computeAvailability, loadPublicCatalog } from "./_lib/server-data";
import { addDaysYmd, dateLabel, todayInTz, weekdayShort } from "./_lib/types";

/**
 * P-01 Business home — server-rendered from the PostgreSQL public views
 * (businesses_public / services_public / staff_public) for ANY slug.
 * Hours + next opening are derived from the get_availability RPC grid.
 */
export default async function BusinessHome({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const catalog = await loadPublicCatalog(slug);
  if (!catalog) notFound();
  const { business, services, staff, policy } = catalog;
  const base = `/b/${slug}`;
  const tz = business.timezone;

  // Opening-hours lines + next opening, derived from the real slot grid
  // for the first service (any staff) over the coming week.
  let hoursLines: { label: string; value: string }[] = [];
  let nextOpening: string | null = null;
  const firstService = services[0];
  if (firstService) {
    try {
      const today = todayInTz(tz);
      const computed = await computeAvailability({
        businessId: business.id,
        serviceId: firstService.id,
        staffId: null,
        from: today,
        to: addDaysYmd(today, 13),
      });
      const byWeekday = new Map<string, string>();
      for (const day of computed.days) {
        const wd = weekdayShort(day.date);
        if (!byWeekday.has(wd)) {
          byWeekday.set(
            wd,
            day.openTime && day.closeTime
              ? `${day.openTime} – ${day.closeTime}`
              : "Closed",
          );
        }
      }
      hoursLines = [...byWeekday.entries()].map(([label, value]) => ({
        label,
        value,
      }));
      for (const day of computed.days) {
        const slot = day.slots[0];
        if (slot) {
          const staffName = computed.staff.find(
            (s) => s.id === slot.staffId,
          )?.name;
          nextOpening = `Next opening: ${day.date === today ? "today" : dateLabel(day.date)}, ${slot.label}${staffName ? ` with ${staffName}` : ""}`;
          break;
        }
      }
    } catch {
      hoursLines = [];
      nextOpening = null;
    }
  }

  const depositNote =
    services.length > 0 && services.every((s) => s.depositCents > 0)
      ? `A ${formatCents(services[0]!.depositCents).replace(".00", "")} deposit is due at the shop and holds any booking`
      : services.some((s) => s.depositCents > 0)
        ? "Some services ask for a deposit, due at the shop"
        : "You pay at the shop — nothing is charged online";

  return (
    <BookingShell manageHref="#" {...shellPropsFor(business)}>
      <div className="sl-b-main">
        {business.address ? (
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--oxblood)" }}>
            {business.address}
          </p>
        ) : null}
        <h1 className="sl-b-hero" style={{ marginTop: 10 }}>
          {business.name}
        </h1>
        {business.description ? (
          <p className="sl-b-hero-sub">{business.description}</p>
        ) : null}
        <div className="sl-b-actions">
          <ButtonLink variant="primary" href={`${base}/book/service`}>
            Book an appointment
          </ButtonLink>
          <ButtonLink href="#">Change a booking</ButtonLink>
        </div>
        <p style={{ marginTop: 16, fontSize: 14, color: "var(--muted)" }}>
          {nextOpening ??
            "Booking is open — pick a service to see the next times."}
        </p>
        {(
          <div
            aria-label="Shop photo"
            style={{
              marginTop: 28,
              height: 220,
              borderRadius: "var(--radius-xl)",
              background: "var(--sand)",
              display: "grid",
              placeItems: "center",
              color: "var(--muted)",
              boxShadow: "var(--shadow-ring)",
            }}
          >
            [Shop photo]
          </div>
        )}

        <h2 style={{ font: "600 28px/1.2 var(--font-display)", margin: "44px 0 6px" }}>
          Services
        </h2>
        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16 }}>
          {depositNote}
        </p>
        <div className="sl-b-card" style={{ padding: "4px 24px" }}>
          {services.map((s) => (
            <div className="sl-b-rowline" key={s.id}>
              <div>
                <div className="sl-b-svc-name">{s.name}</div>
                <div className="sl-b-svc-meta">
                  {s.description} {s.durationMinutes} min.
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <b style={{ font: "600 18px/1 var(--font-display)" }}>
                  {formatCents(s.priceCents).replace(".00", "")}
                </b>
                <ButtonLink
                  variant="primary"
                  size="dashboard"
                  className="sl-b-bookbtn"
                  href={`${base}/book/service?service=${s.id}`}
                >
                  Book
                </ButtonLink>
              </div>
            </div>
          ))}
          {services.length === 0 ? (
            <p style={{ padding: "18px 0", color: "var(--muted)", fontSize: 15 }}>
              No services are open for online booking yet.
            </p>
          ) : null}
        </div>

        <h2 style={{ font: "600 28px/1.2 var(--font-display)", margin: "44px 0 16px" }}>
          Barbers
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
            gap: 16,
          }}
        >
          {staff.map((b) => (
            <div className="sl-b-card" key={b.id}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <span className="sl-b-opt__avatar">{b.initial}</span>
                <div>
                  <b style={{ fontSize: 17 }}>{b.name}</b>
                  {b.title || b.specialties.length > 0 ? (
                    <div style={{ fontSize: 14, color: "var(--muted)" }}>
                      {[b.title, b.specialties.join(" · ")]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  ) : null}
                </div>
              </div>
              {b.bio ? (
                <p style={{ marginTop: 14, fontSize: 14 }}>{b.bio}</p>
              ) : null}
            </div>
          ))}
          {staff.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 15 }}>
              The team list is being updated — booking still works with
              &ldquo;Any barber&rdquo;.
            </p>
          ) : null}
        </div>

        <h2 style={{ font: "600 28px/1.2 var(--font-display)", margin: "44px 0 16px" }}>
          Visit
        </h2>
        <div className="sl-b-card">
          <div
            style={{
              height: 160,
              borderRadius: "var(--radius-l)",
              background: "var(--sand)",
              display: "grid",
              placeItems: "center",
              color: "var(--muted)",
              marginBottom: 18,
            }}
          >
            [Map]
          </div>
          {business.address ? (
            <p style={{ fontWeight: 600 }}>{business.address}</p>
          ) : null}
          <p style={{ marginTop: 8 }}>
            <Link href="#">Get directions</Link>
          </p>
          {hoursLines.length > 0 ? (
            <div style={{ marginTop: 16, fontSize: 15, lineHeight: 1.7 }}>
              {hoursLines.map((h) => (
                <div key={h.label}>
                  {h.label}&nbsp;&nbsp;{h.value}
                </div>
              ))}
            </div>
          ) : null}
          {policy ? (
            <p style={{ marginTop: 16, color: "var(--ink-2)" }}>
              Free to cancel or move up to {policy.freeCancelHours} hours
              before your visit.
            </p>
          ) : null}
          {business.phone ? (
            <p style={{ marginTop: 8, color: "var(--ink-2)" }}>
              Call {business.phone} if you&rsquo;re running late.
            </p>
          ) : null}
        </div>
      </div>
    </BookingShell>
  );
}
