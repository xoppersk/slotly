import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  MapPin,
  Phone,
  Clock,
  ArrowRight,
  Users,
  CalendarCheck,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/format";
import { DEMO_SLUG, demoPublicData } from "@/lib/demo-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback, getInitials } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { BusinessStatusLine } from "@/components/business/BusinessStatusLine";
import { resolveAccent } from "./accent";

import type {
  BusinessPublicRow,
  ServicePublicRow,
  StaffPublicRow,
} from "@/lib/supabase/types";

/**
 * /[slug] — public business booking home (Server Component).
 *
 * Reads the PUBLIC VIEWS via the anon server client (RLS-bypassing views;
 * no base-table access). The view already filters
 * `booking_page_enabled = true`, so a missing row means 404.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses_public")
    .select("name, description")
    .eq("slug", slug)
    .single();
  const business = data as Pick<BusinessPublicRow, "name" | "description"> | null;
  return {
    title: business ? `${business.name} — book online` : "Book online",
    description:
      business?.description ??
      "Book an appointment online with Slotly.",
  };
}

async function getBusinessData(slug: string) {
  const supabase = await createClient();
  const { data: businessRaw, error } = await supabase
    .from("businesses_public")
    .select("*")
    .eq("slug", slug)
    .single();
  // Demo fallback: the Harbor & Pine demo business renders from the design
  // truth ledger when it has no live database row. Every other unknown slug
  // still 404s (unpublished businesses stay unpublished).
  if (error || !businessRaw) {
    if (slug === DEMO_SLUG) return demoPublicData();
    return null;
  }
  const business = businessRaw as BusinessPublicRow;

  const { data: servicesRaw } = await supabase
    .from("services_public")
    .select("*")
    .eq("business_id", business.id)
    .order("sort_order", { ascending: true });
  const { data: staffRaw } = await supabase
    .from("staff_public")
    .select("*")
    .eq("business_id", business.id)
    .order("name", { ascending: true });

  return {
    business,
    services: (servicesRaw ?? []) as ServicePublicRow[],
    staff: (staffRaw ?? []) as StaffPublicRow[],
  };
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export default async function BusinessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getBusinessData(slug);
  if (!data) notFound();
  const { business, services, staff } = data;
  const accent = resolveAccent(business.accent_color);
  const firstServiceId = services[0]?.id ?? null;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* Brand header — cover image or business-accent gradient */}
      <header className="relative overflow-hidden">
        {business.cover_url ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${business.cover_url})` }}
            role="img"
            aria-label={`${business.name} cover photo`}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${accent} 0%, ${accent}CC 60%, ${accent}99 100%)`,
            }}
            aria-hidden
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" aria-hidden />
        <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-10 pt-10 sm:pt-14">
          <div className="flex items-start gap-4">
            {business.logo_url ? (
              <Image
                src={business.logo_url}
                alt={`${business.name} logo`}
                width={80}
                height={80}
                sizes="(max-width: 640px) 64px, 80px"
                className="size-16 shrink-0 rounded-[0.75rem] border-2 border-white/60 bg-card object-cover shadow-sm sm:size-20"
              />
            ) : (
              <span
                aria-hidden
                className="flex size-16 shrink-0 items-center justify-center rounded-[0.75rem] bg-white text-2xl font-bold shadow-sm sm:size-20 sm:text-3xl"
                style={{ color: accent }}
              >
                {getInitials(business.name)}
              </span>
            )}
            <div className="min-w-0 flex-1 pt-1">
              <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-sm sm:text-3xl">
                {business.name}
              </h1>
              {business.address && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-white/90">
                  <MapPin className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{business.address}</span>
                </p>
              )}
              {business.phone && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-white/90">
                  <Phone className="size-3.5 shrink-0" aria-hidden />
                  <a
                    href={`tel:${business.phone.replace(/[^+\d]/g, "")}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {business.phone}
                  </a>
                </p>
              )}
            </div>
          </div>
          <div className="hidden sm:block">
            <Button
              asChild
              size="lg"
              style={{ backgroundColor: accent }}
              className="text-white shadow-md hover:brightness-110"
            >
              <Link href={`/${slug}/book`}>
                Book appointment <ArrowRight className="ml-1 size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 sm:pb-16">
        {/* Availability status line */}
        <div className="pt-5">
          {firstServiceId ? (
            <BusinessStatusLine
              businessId={business.id}
              serviceId={firstServiceId}
              businessName={business.name}
              businessTimezone={business.timezone}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Online booking is not set up yet — please call the business directly.
            </p>
          )}
        </div>

        {business.description && (
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            {business.description}
          </p>
        )}

        {/* Services grid */}
        <section aria-labelledby="services-heading" className="mt-8">
          <h2 id="services-heading" className="text-xl font-semibold tracking-tight">
            Services
          </h2>
          {services.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No bookable services yet"
                description="This business hasn't published any services. Please check back soon or call directly."
              />
            </div>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {services.map((service) => (
                <li key={service.id}>
                  <Card className="flex h-full flex-col">
                    <CardContent className="flex flex-1 flex-col gap-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-[15px] font-semibold leading-snug">
                            {service.name}
                          </h3>
                          {service.description && (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                              {service.description}
                            </p>
                          )}
                        </div>
                        <p className="tnum shrink-0 text-[15px] font-semibold">
                          {service.price_display ?? formatCents(service.price_cents)}
                        </p>
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Clock className="size-3.5" aria-hidden />
                          <span className="tnum">{formatDuration(service.duration_minutes)}</span>
                        </span>
                        <Button
                          asChild
                          variant="primary"
                          size="sm"
                          style={{ backgroundColor: accent }}
                          className="text-white hover:brightness-110"
                        >
                          <Link href={`/${slug}/book?service=${service.id}`}>
                            Book
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Staff strip — hidden when the business has a single staff member */}
        {staff.length > 1 && (
          <section aria-labelledby="team-heading" className="mt-10">
            <h2 id="team-heading" className="text-xl font-semibold tracking-tight">
              Meet the team
            </h2>
            <div
              className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2"
              role="list"
            >
              {staff.map((member) => (
                <Card key={member.id} role="listitem" className="w-36 shrink-0 snap-start">
                  <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
                    <Avatar className="size-14">
                      {member.photo_url && (
                        <AvatarImage src={member.photo_url} alt={member.name} />
                      )}
                      <AvatarFallback initials={getInitials(member.name)} />
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{member.name}</p>
                      {member.title && (
                        <p className="truncate text-xs text-muted-foreground">
                          {member.title}
                        </p>
                      )}
                    </div>
                    {member.specialties.length > 0 && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {member.specialties.slice(0, 2).join(" · ")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Info section */}
        <section aria-labelledby="info-heading" className="mt-10">
          <h2 id="info-heading" className="text-xl font-semibold tracking-tight">
            Good to know
          </h2>
          <Card className="mt-4">
            <CardContent className="flex flex-col gap-4 p-4">
              {business.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Location
                    </p>
                    <p className="mt-0.5 text-sm">{business.address}</p>
                  </div>
                </div>
              )}
              {business.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Phone
                    </p>
                    <a
                      href={`tel:${business.phone.replace(/[^+\d]/g, "")}`}
                      className="mt-0.5 block text-sm underline-offset-2 hover:underline"
                    >
                      {business.phone}
                    </a>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <CalendarCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Cancellation
                  </p>
                  <p className="mt-0.5 text-sm">
                    Free cancellation is available up to the business&apos;s stated cutoff
                    — the exact window is shown during booking.
                  </p>
                </div>
              </div>
              <Separator />
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="size-3.5" aria-hidden />
                Times are shown in your local timezone when it differs from the
                business&apos;s ({business.timezone}).
              </p>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-1 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium text-foreground">{business.name}</p>
          <p>
            Online booking by{" "}
            <Link href="/" className="underline-offset-2 hover:underline">
              Slotly
            </Link>
          </p>
        </div>
      </footer>

      {/* Sticky booking CTA (mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:hidden">
        <Button
          asChild
          size="lg"
          className="w-full text-white"
          style={{ backgroundColor: accent }}
        >
          <Link href={`/${slug}/book`}>Book appointment</Link>
        </Button>
      </div>
    </div>
  );
}
