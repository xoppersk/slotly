import { describe, expect, it } from "vitest";

import { formatCents, formatPhoneDisplay, slugify } from "./format";

describe("formatCents", () => {
  it("formats integer cents as USD by default", () => {
    expect(formatCents(2000)).toBe("$20.00");
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(95)).toBe("$0.95");
  });

  it("honors a currency override", () => {
    expect(formatCents(2000, "EUR")).toBe("€20.00");
  });
});

describe("formatPhoneDisplay", () => {
  it("trims without reformatting the number", () => {
    expect(formatPhoneDisplay("  +1 (215) 555-0134 ")).toBe("+1 (215) 555-0134");
  });
});

describe("slugify", () => {
  it("produces URL-safe booking slugs", () => {
    expect(slugify("Harbor & Pine Barbershop")).toBe("harbor-pine-barbershop");
    expect(slugify("  Café Noir — Salon  ")).toBe("cafe-noir-salon");
    expect(slugify("...")).toBe("");
  });
});
