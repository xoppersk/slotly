import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  createInviteToken,
  createManageToken,
  hashToken,
  INVITE_TOKEN_TTL_MS,
  isTokenExpired,
  MANAGE_TOKEN_TTL_MS,
  timingSafeCompare,
  verifyManageTokenFormat,
} from "./tokens";

describe("createManageToken", () => {
  it("mints a well-formed token with matching sha256 hash and ~72h expiry", () => {
    const before = Date.now();
    const { token, tokenHash, expiresAt } = createManageToken();
    const after = Date.now();

    expect(verifyManageTokenFormat(token)).toBe(true);
    expect(tokenHash).toBe(createHash("sha256").update(token, "utf8").digest("hex"));
    expect(tokenHash).toHaveLength(64);
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + MANAGE_TOKEN_TTL_MS);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + MANAGE_TOKEN_TTL_MS);
  });

  it("mints unique tokens", () => {
    const a = createManageToken();
    const b = createManageToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
});

describe("createInviteToken", () => {
  it("uses the same shape with a 7-day expiry", () => {
    const before = Date.now();
    const { token, tokenHash, expiresAt } = createInviteToken();
    expect(verifyManageTokenFormat(token)).toBe(true);
    expect(tokenHash).toHaveLength(64);
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + INVITE_TOKEN_TTL_MS);
  });
});

describe("verifyManageTokenFormat", () => {
  it("accepts a real minted token", () => {
    expect(verifyManageTokenFormat(createManageToken().token)).toBe(true);
  });

  it("rejects malformed tokens", () => {
    expect(verifyManageTokenFormat("")).toBe(false);
    expect(verifyManageTokenFormat("short")).toBe(false);
    expect(verifyManageTokenFormat("a".repeat(42))).toBe(false); // too short
    expect(verifyManageTokenFormat("a".repeat(44))).toBe(false); // too long
    expect(verifyManageTokenFormat("a".repeat(42) + "!")).toBe(false); // bad alphabet
    expect(verifyManageTokenFormat("a".repeat(43).replace("a", "+"))).toBe(false); // + not base64url
    expect(verifyManageTokenFormat(null)).toBe(false);
    expect(verifyManageTokenFormat(undefined)).toBe(false);
    expect(verifyManageTokenFormat(12345)).toBe(false);
    expect(verifyManageTokenFormat({})).toBe(false);
  });

  it("accepts the full base64url alphabet", () => {
    expect(verifyManageTokenFormat("A".repeat(41) + "-_")).toBe(true);
    expect(verifyManageTokenFormat("0123456789".repeat(4) + "abc")).toBe(true);
  });
});

describe("hashToken + timingSafeCompare (verification round-trip)", () => {
  it("a presented token verifies against its stored hash", () => {
    const { token, tokenHash } = createManageToken();
    expect(timingSafeCompare(hashToken(token), tokenHash)).toBe(true);
  });

  it("a tampered token fails verification even though its shape is valid", () => {
    const { token, tokenHash } = createManageToken();
    const last = token[token.length - 1];
    const replacement = last === "A" ? "B" : "A";
    const tampered = token.slice(0, -1) + replacement;
    expect(verifyManageTokenFormat(tampered)).toBe(true); // shape still fine…
    expect(timingSafeCompare(hashToken(tampered), tokenHash)).toBe(false); // …hash doesn't match
  });

  it("returns false on length mismatch instead of throwing", () => {
    expect(timingSafeCompare("abc", "abcd")).toBe(false);
    expect(timingSafeCompare("", "x".repeat(64))).toBe(false);
    expect(timingSafeCompare("", "")).toBe(true);
  });

  it("hashToken matches an independent sha256 computation", () => {
    const token = randomBytes(32).toString("base64url");
    expect(hashToken(token)).toBe(createHash("sha256").update(token, "utf8").digest("hex"));
  });
});

describe("isTokenExpired", () => {
  it("detects expired and live tokens", () => {
    const now = new Date("2026-10-06T12:00:00Z");
    expect(isTokenExpired(new Date("2026-10-06T11:59:59Z"), now)).toBe(true);
    expect(isTokenExpired(new Date("2026-10-06T12:00:00Z"), now)).toBe(true); // boundary: expired
    expect(isTokenExpired(new Date("2026-10-06T12:00:01Z"), now)).toBe(false);
  });

  it("a fresh manage token is not expired", () => {
    expect(isTokenExpired(createManageToken().expiresAt)).toBe(false);
  });
});
