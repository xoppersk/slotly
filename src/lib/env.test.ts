import { afterEach, describe, expect, it, vi } from "vitest";

import { __resetEnvCache, getEnv } from "./env";

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "APP_URL",
  "CRON_SECRET",
];

afterEach(() => {
  __resetEnvCache();
  vi.unstubAllEnvs();
});

function stubTestEnv(stripeKey = "sk_test_123") {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
  vi.stubEnv("STRIPE_SECRET_KEY", stripeKey);
  vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_123");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_123");
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("CRON_SECRET", "secret");
}

describe("getEnv", () => {
  it("throws when required variables are missing", () => {
    for (const key of REQUIRED) vi.stubEnv(key, "");
    expect(() => getEnv()).toThrow(/Missing required environment variables/);
  });

  it("throws when Stripe is in live mode", () => {
    stubTestEnv("sk_live_123");
    expect(() => getEnv()).toThrow(/test-mode key/);
  });

  it("returns validated env for test-mode keys and caches", () => {
    stubTestEnv();
    const first = getEnv();
    expect(first.STRIPE_SECRET_KEY).toBe("sk_test_123");
    expect(getEnv()).toBe(first); // cached
  });
});
