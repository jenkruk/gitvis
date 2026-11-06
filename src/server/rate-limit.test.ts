import { describe, expect, it } from "vitest";
import { clientKey, FixedWindowLimiter } from "./rate-limit";

describe("FixedWindowLimiter", () => {
  it("allows up to the limit per window, then reports when to retry", () => {
    let now = 0;
    const limiter = new FixedWindowLimiter(2, 60_000, 100, () => now);
    expect(limiter.hit("a").allowed).toBe(true);
    expect(limiter.hit("a").allowed).toBe(true);
    now = 15_000;
    expect(limiter.hit("a")).toEqual({ allowed: false, retryAfterSeconds: 45 });
    expect(limiter.hit("b").allowed).toBe(true);
    now = 60_000;
    expect(limiter.hit("a").allowed).toBe(true); // new window
  });

  it("stays bounded under a flood of distinct keys", () => {
    let now = 0;
    const limiter = new FixedWindowLimiter(1, 60_000, 3, () => now);
    for (let i = 0; i < 1_000; i++) limiter.hit(`ip-${i}`);
    // Internal map never exceeds maxKeys; newest keys still get counted.
    expect((limiter as unknown as { windows: Map<string, unknown> }).windows.size).toBeLessThanOrEqual(3);
    expect(limiter.hit("ip-999").allowed).toBe(false);
    now = 61_000;
    expect(limiter.hit("ip-999").allowed).toBe(true);
  });

  it("take() enforces a global budget", () => {
    const budget = new FixedWindowLimiter(1, 60_000, 10, () => 0);
    expect(budget.take()).toBe(true);
    expect(budget.take()).toBe(false);
  });
});

describe("clientKey", () => {
  it("uses the first forwarded address, then fallbacks", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "203.0.113.1, 10.0.0.1" }))).toBe("203.0.113.1");
    expect(clientKey(new Headers({ "x-real-ip": "203.0.113.2" }))).toBe("203.0.113.2");
    expect(clientKey(new Headers())).toBe("unknown");
  });
});
