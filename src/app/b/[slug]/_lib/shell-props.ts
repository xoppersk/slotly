/** BookingShell props for the REAL business — pure helper shared by the
    server-rendered booking pages (home / booked / manage). Kept OUT of
    `_flow/Shell.tsx` on purpose: that module is a client component file,
    and calling its exports from a Server Component throws at runtime
    ("Attempted to call shellPropsFor() from the server"). */
export function shellPropsFor(business: {
  name: string;
  address: string | null;
  phone: string | null;
  slug: string;
}) {
  const mark =
    business.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "S";
  return {
    businessName: business.name,
    businessAddressLine: business.address ?? "",
    businessMark: mark,
    homeHref: `/b/${business.slug}`,
    footerLine: `${business.name}${business.phone ? ` · ${business.phone}` : ""}${business.address ? ` · ${business.address}` : ""}`,
  };
}
