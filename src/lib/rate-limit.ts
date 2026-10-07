/**
 * In-memory token-bucket rate limiter for Slotly's public API routes.
 *
 * SERVER-SIDE USE (route handlers / middleware). Buckets live in the
 * process, so this is correct on a single instance; a multi-instance deploy
 * should swap it for a shared store (Redis/Upstash) behind the same
 * `checkRateLimit` signature.
 */

export interface RateLimitOptions {
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Requests remaining in the current window (0 when denied). */
  remaining: number;
  /** When the current window resets. */
  resetAt: Date;
}

interface Bucket {
  tokens: number;
  resetAtMs: number;
}

const buckets = new Map<string, Bucket>();

function validate({ limit, windowMs }: RateLimitOptions): void {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error(`limit must be a positive integer (got ${limit})`);
  }
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error(`windowMs must be a positive number (got ${windowMs})`);
  }
}

/**
 * Consume one token from `key`'s bucket. Fixed windows: when the window
 * expires the bucket refills to `limit`.
 */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  if (!key) throw new Error("key is required");
  validate(options);
  const { limit, windowMs } = options;

  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAtMs) {
    bucket = { tokens: limit, resetAtMs: now + windowMs };
  }

  if (bucket.tokens <= 0) {
    buckets.set(key, bucket);
    return { allowed: false, remaining: 0, resetAt: new Date(bucket.resetAtMs) };
  }

  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return { allowed: true, remaining: bucket.tokens, resetAt: new Date(bucket.resetAtMs) };
}

/** Clear all buckets — test use only. */
export function __resetRateLimits(): void {
  buckets.clear();
}
