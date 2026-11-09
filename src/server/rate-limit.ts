import "server-only";

export class FixedWindowLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 10_000,
    private readonly now: () => number = Date.now,
  ) {}

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

  take(): boolean {
    return this.hit("*").allowed;
  }

  private prune(now: number) {
    for (const [key, window] of this.windows) {
      if (now - window.start >= this.windowMs) this.windows.delete(key);
    }
    for (const key of this.windows.keys()) {
      if (this.windows.size < this.maxKeys) break;
      this.windows.delete(key);
    }
  }
}

const MINUTE = 60_000;

export const CARD_LIMIT_PER_MINUTE = 600;
export const cardLimiter = new FixedWindowLimiter(CARD_LIMIT_PER_MINUTE, MINUTE);
export const contributionsLimiter = new FixedWindowLimiter(30, MINUTE);
export const avatarLimiter = new FixedWindowLimiter(60, MINUTE);
export const upstreamBudget = new FixedWindowLimiter(300, MINUTE);

export function clientKey(headers: Headers): string {
  return headers.get("x-real-ip")?.trim() || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export function tooManyRequests(retryAfterSeconds: number): Response {
  return new Response("Too many requests. Please slow down.", {
    status: 429,
    headers: { "Retry-After": String(retryAfterSeconds), "Cache-Control": "no-store" },
  });
}
