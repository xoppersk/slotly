/**
 * Per-business accent palette (UI-DESIGN.md §5).
 *
 * The business picks one accent for its public page; it is applied to the
 * header gradient and primary buttons on /[slug] only — Slotly brand teal
 * stays everywhere else. Values must match the palette names allowed by
 * the dashboard settings UI; anything else falls back to teal.
 */
export const ACCENT_PALETTE = {
  teal: "#0E7C6B",
  plum: "#8B5CF6",
  forest: "#166534",
  terracotta: "#C2410C",
  slate: "#475569",
} as const;

export type AccentName = keyof typeof ACCENT_PALETTE;

/**
 * Resolve a raw `accent_color` view value to a hex string. Accepts either
 * the palette name ("plum") or the literal hex ("#8B5CF6"); anything else
 * falls back to teal. Case-insensitive.
 */
export function resolveAccent(accentColor: string | null | undefined): string {
  if (!accentColor) return ACCENT_PALETTE.teal;
  const key = accentColor.trim().toLowerCase();
  if (key in ACCENT_PALETTE) {
    return ACCENT_PALETTE[key as AccentName];
  }
  if (/^#[0-9a-f]{6}$/i.test(key)) {
    return key;
  }
  return ACCENT_PALETTE.teal;
}
