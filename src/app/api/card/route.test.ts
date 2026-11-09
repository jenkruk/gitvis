import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toISODate } from "@/domain/dates";

const loaders = vi.hoisted(() => ({ github: vi.fn(), gitlab: vi.fn(), today: () => "2026-11-06" }));
vi.mock("@/server/cached", () => ({ serverLoaders: loaders }));

const { GET } = await import("./route");
const { CARD_LIMIT_PER_MINUTE } = await import("@/server/rate-limit");

let ip = 0;
function get(query: string, headers: Record<string, string> = {}) {
  ip += 1;
  return GET(
    new NextRequest(`http://localhost/api/card?${query}`, {
      headers: { "x-forwarded-for": `203.0.113.${ip % 250}`, ...headers },
    }),
  );
}

beforeEach(() => {
  loaders.github.mockReset();
  loaders.github.mockResolvedValue({
    ok: true,
    data: { platform: "github", username: "jenkruk", days: [{ date: toISODate("2026-11-01"), count: 3 }] },
  });
});

describe("GET /api/card", () => {
  it("is fully sandboxed: no scripts, no popups (the graphic has no links)", async () => {
    const csp = (await get("v=1&github=jenkruk")).headers.get("Content-Security-Policy")!;
    expect(csp).toBe("default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox");
  });

  it("serves a GitHub-compatible, cache-friendly SVG", async () => {
    const res = await get("v=1&github=jenkruk&layout=minimal&palette=ember&mode=light&f=heatmap,total");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("no-cache, max-age=0");
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe("public, s-maxage=3600, stale-while-revalidate=600");
    expect(res.headers.get("ETag")).toMatch(/^"[0-9a-f]{40}"$/);
    expect(res.headers.get("X-GitVis-Status")).toBe("ok");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
    expect(await res.text()).toMatch(/^<svg[^>]+role="img"/);
  });

  it("answers revalidation with 304 when the image is unchanged", async () => {
    const first = await get("github=jenkruk");
    const etag = first.headers.get("ETag")!;
    const second = await get("github=jenkruk", { "If-None-Match": etag });
    expect(second.status).toBe(304);
    expect(await second.text()).toBe("");
    expect(second.headers.get("ETag")).toBe(etag);
  });

  it("renders invalid URLs as an explanatory 200 SVG with a short-lived edge cache", async () => {
    const res = await get("github=jenkruk&palette=neon");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-GitVis-Status")).toBe("invalid_config");
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toContain("s-maxage=3600");
    expect(await res.text()).toContain("Unknown palette");
    expect(loaders.github).not.toHaveBeenCalled();
  });

  it("rate-limits a single client and recovers with Retry-After", async () => {
    const pinned = { "x-forwarded-for": "198.51.100.7" };
    const statuses: number[] = [];
    for (let i = 0; i < CARD_LIMIT_PER_MINUTE + 5; i++) statuses.push((await get("github=jenkruk", pinned)).status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(CARD_LIMIT_PER_MINUTE);
    const limited = await get("github=jenkruk", pinned);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await get("github=jenkruk")).status).toBe(200);
  });
});
