import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adapterError } from "@/adapters/types";
import { toISODate } from "@/domain/dates";

const loaders = vi.hoisted(() => ({
  github: vi.fn(),
  gitlab: vi.fn(),
  today: () => "2026-11-06",
}));
vi.mock("@/server/cached", () => ({ serverLoaders: loaders }));

const { GET } = await import("./route");

const get = (query: string) => GET(new NextRequest(`http://localhost/api/contributions?${query}`));

beforeEach(() => {
  loaders.github.mockReset();
  loaders.gitlab.mockReset();
  loaders.gitlab.mockResolvedValue({
    ok: true,
    data: { platform: "gitlab", username: "contactkruk", days: [{ date: toISODate("2026-11-01"), count: 2 }] },
  });
});

describe("GET /api/contributions", () => {
  it("rejects requests without usernames", async () => {
    const res = await get("");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Provide a GitHub and/or GitLab username." });
  });

  it("rejects invalid usernames before calling upstream", async () => {
    const res = await get("gitlab=../etc");
    expect(res.status).toBe(400);
    expect(loaders.gitlab).not.toHaveBeenCalled();
  });

  it("returns a dataset with cacheable headers when every answer is stable", async () => {
    const res = await get("gitlab=contactkruk");
    expect(res.status).toBe(200);
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toContain("s-maxage");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
    const body = await res.json();
    expect(body.results).toEqual([{ platform: "gitlab", username: "contactkruk", status: "ok", total: 2 }]);
    expect(body.dataset.provenance).toBe("live");
  });

  it("disables caching when a platform failed transiently or isn't configured", async () => {
    loaders.github.mockResolvedValue(adapterError("github", "not_configured", "Not set up"));
    const res = await get("github=jenkruk&gitlab=contactkruk");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body.results[0]).toMatchObject({ status: "not_configured", retryable: false });
    expect(body.results[1]).toMatchObject({ status: "ok" });
  });
});

describe("years", () => {
  it("rejects anything other than 1, 2 or 3", async () => {
    for (const years of ["0", "4", "two", "-1"]) {
      const res = await get(`gitlab=contactkruk&years=${years}`);
      expect(res.status).toBe(400);
    }
  });

  it("serves GitLab-only multi-year requests as 12 months (no history exists to fetch)", async () => {
    const res = await get("gitlab=contactkruk&years=3");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dataset.days).toHaveLength(365);
    expect(body.history).toBeUndefined();
  });
});
