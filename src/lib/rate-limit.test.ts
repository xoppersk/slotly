import { afterEach, describe, expect, it, vi } from "vitest";

import { __resetRateLimits, checkRateLimit } from "./rate-limit";

afterEach(() => {
  __resetRateLimits();
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("allows up to the limit, then denies, counting remaining down", () => {
    const opts = { limit: 3, windowMs: 60_000 };
    expect(checkRateLimit("ip:1", opts)).toMatchObject({ allowed: true, remaining: 2 });
    expect(checkRateLimit("ip:1", opts)).toMatchObject({ allowed: true, remaining: 1 });
    expect(checkRateLimit("ip:1", opts)).toMatchObject({ allowed: true, remaining: 0 });
    const denied = checkRateLimit("ip:1", opts);
    expect(denied).toMatchObject({ allowed: false, remaining: 0 });
    // Further attempts stay denied within the window
    expect(checkRateLimit("ip:1", opts).allowed).toBe(false);
  });

  it("tracks keys independently", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    expect(checkRateLimit("ip:1", opts).allowed).toBe(true);
    expect(checkRateLimit("ip:1", opts).allowed).toBe(false);
    expect(checkRateLimit("ip:2", opts)).toMatchObject({ allowed: true, remaining: 0 });
  });

  it("refills the bucket when the window expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
    const opts = { limit: 1, windowMs: 1_000 };
    expect(checkRateLimit("ip:1", opts).allowed).toBe(true);
    expect(checkRateLimit("ip:1", opts).allowed).toBe(false);
    vi.setSystemTime(new Date("2026-10-06T12:00:01.001Z"));
    expect(checkRateLimit("ip:1", opts)).toMatchObject({ allowed: true, remaining: 0 });
  });

  it("reports resetAt as now + windowMs", () => {
    vi.useFakeTimers();
    const t0 = new Date("2026-10-06T12:00:00Z");
    vi.setSystemTime(t0);
    const result = checkRateLimit("ip:1", { limit: 5, windowMs: 60_000 });
    expect(result.resetAt.getTime()).toBe(t0.getTime() + 60_000);
  });

  it("throws on invalid options", () => {
    expect(() => checkRateLimit("k", { limit: 0, windowMs: 1000 })).toThrow(/limit/);
    expect(() => checkRateLimit("k", { limit: 1.5, windowMs: 1000 })).toThrow(/limit/);
    expect(() => checkRateLimit("k", { limit: 1, windowMs: -5 })).toThrow(/windowMs/);
    expect(() => checkRateLimit("", { limit: 1, windowMs: 1000 })).toThrow(/key/);
  });
});
