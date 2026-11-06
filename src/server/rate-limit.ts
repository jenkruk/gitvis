import "server-only";

/**
 * Small fixed-window rate limiter, in memory and per server instance.
 * Best effort by design (no database): it blunts bursts against a single
 * instance. Shared, cross-instance limits belong in the platform firewall
 * (see docs/ARCHITECTURE.md "Abuse protection").
 */
export class FixedWindowLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 10_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a hit for `key`; returns whether it's allowed and when the window resets. */
  hit(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const now = this.now();
    let window = this.windows.get(key);
    if (!window || now - window.start >= this.windowMs) {
      if (!window && this.windows.size >= this.maxKeys) this.prune(now);
      window = { start: now, count: 0 };
      this.windows.set(key, window);
    }
    window.count += 1;
    return {
      allowed: window.count <= this.limit,
      retryAfterSeconds: Math.max(1, Math.ceil((window.start + this.windowMs - now) / 1000)),
    };
  }

  /** Convenience for global budgets (single shared key). */
  take(): boolean {
    return this.hit("*").allowed;
  }

  private prune(now: number) {
    for (const [key, window] of this.windows) {
      if (now - window.start >= this.windowMs) this.windows.delete(key);
    }
    // Still full (sustained flood of distinct keys): drop the oldest entries rather than grow unbounded.
    for (const key of this.windows.keys()) {
      if (this.windows.size < this.maxKeys) break;
      this.windows.delete(key);
    }
  }
}

const MINUTE = 60_000;

export const cardLimiter = new FixedWindowLimiter(120, MINUTE);
export const contributionsLimiter = new FixedWindowLimiter(30, MINUTE);
/** Caps real upstream fetches (cache misses) so a flood of unique usernames can't drain the GitHub quota. */
export const upstreamBudget = new FixedWindowLimiter(300, MINUTE);

/** Client IP as reported by the hosting proxy (Vercel sets x-forwarded-for). */
export function clientKey(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}

export function tooManyRequests(retryAfterSeconds: number): Response {
  return new Response("Too many requests. Please slow down.", {
    status: 429,
    headers: { "Retry-After": String(retryAfterSeconds), "Cache-Control": "no-store" },
  });
}
