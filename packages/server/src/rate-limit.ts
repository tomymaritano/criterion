import type { Context, Next } from "hono";
import type { RateLimitOptions, RateLimitStore, RateLimitInfo } from "./types.js";

/**
 * Default in-memory rate limit store
 *
 * Simple implementation for single-instance deployments.
 * For distributed deployments, use a custom store (e.g., Redis).
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private hits: Map<string, { count: number; resetTime: number }> = new Map();
  private windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  async increment(key: string): Promise<RateLimitInfo> {
    const now = Date.now();
    const record = this.hits.get(key);

    if (!record || now >= record.resetTime) {
      // Window expired or new key, reset
      const resetTime = now + this.windowMs;
      this.hits.set(key, { count: 1, resetTime });
      return { count: 1, resetTime };
    }

    // Increment existing
    record.count++;
    return { count: record.count, resetTime: record.resetTime };
  }

  async reset(key: string): Promise<void> {
    this.hits.delete(key);
  }

  /**
   * Get current info for a key (for testing/debugging)
   */
  getInfo(key: string): RateLimitInfo | undefined {
    return this.hits.get(key);
  }

  /**
   * Clear all entries (for testing)
   */
  clear(): void {
    this.hits.clear();
  }
}

/**
 * Default key generator - extracts client IP from headers
 */
function defaultKeyGenerator(c: Context): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown"
  );
}

/**
 * Default skip function - skips health and metrics endpoints
 */
function defaultSkip(c: Context): boolean {
  const path = c.req.path;
  return path === "/health" || path === "/metrics";
}

/**
 * Create rate limiting middleware for Hono
 *
 * @example
 * ```typescript
 * app.use("*", createRateLimitMiddleware({
 *   windowMs: 60000,  // 1 minute
 *   max: 100,         // 100 requests per window
 * }));
 * ```
 */
export function createRateLimitMiddleware(options: RateLimitOptions) {
  const windowMs = options.windowMs ?? 60000;
  const max = options.max ?? 100;
  const store = options.store ?? new InMemoryRateLimitStore(windowMs);
  const keyGenerator = options.keyGenerator ?? defaultKeyGenerator;
  const skip = options.skip ?? defaultSkip;

  return async (c: Context, next: Next) => {
    // Check if this request should skip rate limiting
    if (skip(c)) {
      return next();
    }

    const key = keyGenerator(c);
    const info = await store.increment(key);

    // Always set rate limit headers
    c.header("X-RateLimit-Limit", String(max));
    c.header("X-RateLimit-Remaining", String(Math.max(0, max - info.count)));
    c.header("X-RateLimit-Reset", String(Math.floor(info.resetTime / 1000)));

    // Check if limit exceeded
    if (info.count > max) {
      const retryAfter = Math.max(1, Math.ceil((info.resetTime - Date.now()) / 1000));
      c.header("Retry-After", String(retryAfter));

      // Use custom handler if provided
      if (options.handler) {
        return options.handler(c);
      }

      // Default 429 response
      return c.json(
        {
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests, please try again later",
          },
          retryAfter,
          timestamp: new Date().toISOString(),
        },
        429
      );
    }

    return next();
  };
}
