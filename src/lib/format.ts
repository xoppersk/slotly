/**
 * Formatting helpers for Slotly's booking surface: money, phone, slugs.
 * Money is always stored as integer cents; displayed with tabular numerals.
 */

/**
 * Format integer cents as a money string, e.g. 2000 → "$20.00".
 * Currency defaults to USD; pass an ISO 4217 code to override.
 */
export function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Display pass-through for phone numbers. Normalization (E.164 via Twilio
 * lookup or libphonenumber) happens in the customer phase; the UI renders
 * whatever the user typed so nothing is silently mangled.
 */
export function formatPhoneDisplay(phone: string): string {
  return phone.trim();
}

/**
 * Turn a business name into a URL-safe booking-page slug,
 * e.g. "Harbor & Pine Barbershop" → "harbor-pine-barbershop".
 */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
