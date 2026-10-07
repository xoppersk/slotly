/**
 * Magic-link manage tokens (bookings) and staff invite tokens.
 *
 * SERVER ONLY — never import from a Client Component. The plaintext token
 * travels in the manage URL; only its sha256 hash is stored in Postgres
 * (`bookings.manage_token_hash`), so a DB read alone can't forge a link.
 *
 * Judgment call: the product spec says "HMAC-signed", but the DB schema pins
 * `manage_token_hash` to sha256-of-token with 72h expiry and rotation after
 * each use — so this module mints 32-byte random tokens and stores sha256
 * hex, exactly as the schema requires. Unpredictability comes from
 * `crypto.randomBytes`, not a keyed MAC.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export interface ManagedToken {
  /** Plaintext token — goes in the URL, never in the database. */
  token: string;
  /** sha256 hex of the token — this is what gets stored. */
  tokenHash: string;
  /** Absolute expiry; enforced server-side on every use. */
  expiresAt: Date;
}

/** 72h in milliseconds — manage-link lifetime per the DB schema. */
export const MANAGE_TOKEN_TTL_MS = 72 * 3_600_000;
/** 7 days in milliseconds — staff invite lifetime. */
export const INVITE_TOKEN_TTL_MS = 7 * 24 * 3_600_000;

/** base64url of 32 random bytes is always 43 chars, alphabet [A-Za-z0-9_-]. */
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

function mint(ttlMs: number): ManagedToken {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  return { token, tokenHash, expiresAt: new Date(Date.now() + ttlMs) };
}

/** Create a booking manage token (72h expiry, rotated after each use). */
export function createManageToken(): ManagedToken {
  return mint(MANAGE_TOKEN_TTL_MS);
}

/** Create a staff invite token (7-day expiry). */
export function createInviteToken(): ManagedToken {
  return mint(INVITE_TOKEN_TTL_MS);
}

/**
 * Reject malformed/forged-shape tokens before any DB lookup — cheap,
 * constant-time-ish gate so junk never reaches the hash comparison.
 */
export function verifyManageTokenFormat(token: unknown): boolean {
  return typeof token === "string" && TOKEN_FORMAT.test(token);
}

/** Hash a plaintext token the same way `mint` does (for verification). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Constant-time comparison for token hashes. Returns false (never throws)
 * when the inputs differ in length.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/** True when the token's expiry has passed (checked against `now`). */
export function isTokenExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= expiresAt.getTime();
}
