import { afterEach, describe, expect, it, vi } from "vitest";

import { __resetEnvCache } from "./env";
import { __resetStripeClient, assertTestMode, getStripe } from "./stripe";

afterEach(() => {
  __resetEnvCache();
  __resetStripeClient();
  vi.unstubAllEnvs();
});

describe("assertTestMode", () => {
  it("accepts test-mode keys", () => {
    expect(() => assertTestMode("sk_test_123")).not.toThrow();
    expect(() => assertTestMode("sk_test_abc_xyz")).not.toThrow();
  });

  it("rejects live keys", () => {
    expect(() => assertTestMode("sk_live_123")).toThrow(/test mode only/);
  });
});

describe("getStripe", () => {
  it("throws when env is not configured (no network touched)", () => {
    // getEnv() throws before any Stripe client is constructed.
    expect(() => getStripe()).toThrow(/Missing required environment variables/);
  });

  it("refuses a live key from env even if validation were bypassed", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_abc");
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_123");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_123");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("CRON_SECRET", "secret");
    expect(() => getStripe()).toThrow(/test-mode key|test mode only/);
  });

  it("constructs and caches the client for a test key without network", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_123");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_123");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("CRON_SECRET", "secret");
    const first = getStripe();
    expect(getStripe()).toBe(first); // cached
  });
});
