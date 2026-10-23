import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import "@/styles/booking.css";
import { BookingProvider } from "./_flow/BookingFlow";
import { loadPublicCatalog } from "./_lib/server-data";

/**
 * Public booking layout for ANY business: resolves the slug against the
 * PostgreSQL `businesses_public` view (which only exposes businesses with
 * the booking page enabled). Unknown slug / disabled page → 404.
 * (Unknown slugs are ALSO rejected in middleware with a hard 404 status —
 * under Partial Prerendering this layout's notFound() alone streams the
 * not-found UI with a 200 status, a soft 404.)
 */
export default async function BookingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const catalog = await loadPublicCatalog(slug);
  if (!catalog) notFound();
  return (
    <BookingProvider slug={slug} catalog={catalog}>
      {children}
    </BookingProvider>
  );
}
