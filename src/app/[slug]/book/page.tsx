import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { BookingWizard } from "@/components/wizard/BookingWizard";

import type {
  BusinessPublicRow,
  ServicePublicRow,
  StaffPublicRow,
} from "@/lib/supabase/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses_public")
    .select("name")
    .eq("slug", slug)
    .single();
  const business = data as Pick<BusinessPublicRow, "name"> | null;
  return {
    title: business ? `Book with ${business.name}` : "Book appointment",
  };
}

/**
 * /[slug]/book — booking wizard entry (Server Component).
 *
 * Fetches the business, services, and staff via the PUBLIC VIEWS (anon
 * client, RLS applies) and hands them to the client-side wizard. Deep-link
 * preselect (?service=<uuid>, ?staff=<uuid>) is validated against the
 * fetched rows; unknown ids are ignored so a stale link degrades to the
 * normal flow.
 */
export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ service?: string; staff?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const supabase = await createClient();

  const { data: businessRaw, error } = await supabase
    .from("businesses_public")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error || !businessRaw) notFound();
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

  const services = (servicesRaw ?? []) as ServicePublicRow[];
  const staff = (staffRaw ?? []) as StaffPublicRow[];

  if (services.length === 0) notFound();

  const preselect = {
    serviceId: services.some((s) => s.id === query.service)
      ? (query.service as string)
      : null,
    staffId: staff.some((s) => s.id === query.staff)
      ? (query.staff as string)
      : null,
  };

  return (
    <BookingWizard
      business={business}
      services={services}
      staff={staff}
      preselect={preselect}
      slug={slug}
    />
  );
}
