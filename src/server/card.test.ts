import { afterEach, describe, expect, it, vi } from "vitest";
import { adapterError, type AdapterResult } from "@/adapters/types";
import { toISODate } from "@/domain/dates";
import type { ContributionLoaders } from "./contributions";
import { cacheHeaders, etagMatches, renderCard, svgEtag } from "./card";
import { DEFAULT_POLICY } from "./freshness";

const ok = (platform: "github" | "gitlab", username: string): AdapterResult => ({
  ok: true,
  data: {
    platform,
    username,
    profileUrl: `https://${platform}.com/${username}`,
    days: [{ date: toISODate("2026-11-01"), count: 5 }],
  },
});

function loaders(overrides: Partial<ContributionLoaders> = {}): ContributionLoaders {
  return {
    github: vi.fn(async (u: string) => ok("github", u)),
    gitlab: vi.fn(async (u: string) => ok("gitlab", u)),
    today: () => toISODate("2026-11-06"),
    ...overrides,
  };
}

const render = (query: string, l = loaders()) => renderCard(new URLSearchParams(query), l);
const descOf = (svg: string) => /<desc[^>]*>([^<]*)<\/desc>/.exec(svg)?.[1];

afterEach(() => vi.restoreAllMocks());

describe("renderCard", () => {
  it.each([
    ["github=jenkruk", "5 contributions on GitHub @jenkruk from Nov 2, 2025 to Nov 6, 2026."],
    ["gitlab=contactkruk", "5 contributions on GitLab @contactkruk from Nov 6, 2025 to Nov 6, 2026."],
    [
      "github=jenkruk&gitlab=contactkruk",
      "10 contributions across GitHub @jenkruk and GitLab @contactkruk from Nov 2, 2025 to Nov 6, 2026.",
    ],
  ])("renders %s with a meaningful accessible description", async (query, expected) => {
    const card = await render(`v=1&${query}`);
    expect(card.status).toBe("ok");
    expect(card.edgeMaxAge).toBe(3600);
    expect(card.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(descOf(card.svg)).toContain(expected);
    expect(descOf(card.svg)).toMatch(/active days\./);
    expect(card.svg).not.toContain("Sample data");
  });

  it("says when the platforms count their years from different dates", async () => {
    const card = await render("v=1&github=jenkruk&gitlab=contactkruk");
    expect(descOf(card.svg)).toContain(
      "GitHub counts from Nov 2, 2025 and GitLab from Nov 6, 2025, matching the yearly total on each profile.",
    );
    expect(descOf(await (await render("v=1&github=jenkruk")).svg)).not.toContain("counts from");
  });

  it("leaves out per-day tooltips, which a README image can never show, but keeps its text alternative", async () => {
    const card = await render("v=1&github=jenkruk&gitlab=contactkruk");
    expect(card.svg).not.toMatch(/<title>[^<]* contributions? on /);
    expect(card.svg).toContain('<title id="gitvis-title">');
    expect(descOf(card.svg)).toMatch(/contributions across GitHub @jenkruk and GitLab @contactkruk/);
  });

  it("applies the requested design", async () => {
    const card = await render("github=jenkruk&layout=data-rich&f=heatmap,trends");
    expect(card.svg).toContain("Weekly contributions");
    expect(card.svg).not.toContain("Platform breakdown");
  });

  it.each([
    ["", "Add a github and/or gitlab username."],
    ["github=../etc", "Invalid github username."],
    ["github=jenkruk&layout=<script>", "Unknown layout"],
    ["v=9&github=jenkruk", "Unsupported version"],
  ])("renders an invalid-config card for %j without calling upstream", async (query, message) => {
    const l = loaders();
    const card = await render(query, l);
    expect(card.status).toBe("invalid_config");
    expect(card.svg).toContain("Invalid GitVis image URL");
    expect(card.svg).toContain(message.replaceAll("<", "&lt;"));
    expect(card.svg).not.toContain("<script>");
    expect(l.github).not.toHaveBeenCalled();
  });

  it("explains a missing account (cached for an hour)", async () => {
    const card = await render(
      "gitlab=ghost",
      loaders({ gitlab: async () => adapterError("gitlab", "not_found", "No public GitLab profile found.") }),
    );
    expect(card).toMatchObject({ status: "not_found", edgeMaxAge: 3600 });
    expect(card.svg).toContain("Account not found");
    expect(card.svg).toMatch(/role="img"[^>]*aria-labelledby/);
  });

  it("keeps a 255-character username inside the error card", async () => {
    const longName = `a${"b".repeat(254)}`;
    const notFound = (await import("./gitlab")).fetchGitLabContributions;
    const result = await notFound(longName, { fetchImpl: async () => new Response(null, { status: 302 }) });
    const card = await render(`gitlab=${longName}`, loaders({ gitlab: async () => result }));
    expect(card.status).toBe("not_found");
    const lines = [...card.svg.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((m) => m[1]!);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(100);
    expect(card.svg).not.toContain("b".repeat(40));
  });

  it("labels last-known-good data in the image and keeps it short-lived at the edge", async () => {
    const staleGitHub = async (u: string): Promise<AdapterResult> => {
      const result = ok("github", u);
      return result.ok
        ? { ok: true, data: { ...result.data, stale: true, fetchedAt: "2026-11-03T08:00:00.000Z" } }
        : result;
    };
    const card = await render("github=jenkruk&gitlab=contactkruk", loaders({ github: staleGitHub }));
    expect(card).toMatchObject({ status: "stale", edgeMaxAge: 60, asOf: "2026-11-03T08:00:00.000Z" });
    expect(card.svg).toContain("Data from Nov 3, 2026");
    expect(descOf(card.svg)).toContain("Showing GitHub data last updated Nov 3, 2026; a refresh is pending.");
  });

  it("states each platform's own data age when both are being refreshed, and the badge shows the oldest", async () => {
    const staleAt =
      (fetchedAt: string) =>
      async (u: string): Promise<AdapterResult> => {
        const platform = u === "jenkruk" ? "github" : "gitlab";
        const result = ok(platform, u);
        return result.ok ? { ok: true, data: { ...result.data, stale: true, fetchedAt } } : result;
      };
    const card = await render(
      "github=jenkruk&gitlab=contactkruk",
      loaders({ github: staleAt("2026-11-05T12:00:00.000Z"), gitlab: staleAt("2026-11-01T00:00:00.000Z") }),
    );
    expect(card).toMatchObject({ status: "stale", edgeMaxAge: 60, asOf: "2026-11-01T00:00:00.000Z" });
    expect(card.svg).toContain("Data from Nov 1, 2026");
    expect(descOf(card.svg)).toContain(
      "Showing GitHub data last updated Nov 5, 2026 and GitLab data last updated Nov 1, 2026; a refresh is pending.",
    );
  });

  it("does not label fresh data", async () => {
    const card = await render("github=jenkruk");
    expect(card.svg).not.toContain("Data from");
    expect(descOf(card.svg)).not.toContain("refresh is pending");
  });

  it("never publishes a misleading partial total when one platform fails", async () => {
    const card = await render(
      "github=jenkruk&gitlab=contactkruk",
      loaders({ github: async () => adapterError("github", "rate_limited", "GitHub is rate-limiting requests.") }),
    );
    expect(card).toMatchObject({ status: "unavailable", edgeMaxAge: 60 });
    expect(card.svg).toContain("GitHub is rate-limiting requests.");
    expect(card.svg).not.toContain("contributions across");
  });

  it("hides internal errors and secrets behind a generic card", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const card = await render(
      "github=jenkruk",
      loaders({
        github: async () => {
          throw new Error("ECONNRESET at api.github.com with token ghp_SECRET123");
        },
      }),
    );
    expect(card).toMatchObject({ status: "internal_error", edgeMaxAge: 60 });
    expect(card.svg).toContain("Something went wrong");
    expect(card.svg).not.toMatch(/ECONNRESET|ghp_|SECRET|api\.github/);
  });
});

describe("ETags", () => {
  it("are stable, content-addressed and match If-None-Match variants", async () => {
    const etag = await svgEtag("<svg/>");
    expect(etag).toMatch(/^"[0-9a-f]{40}"$/);
    expect(await svgEtag("<svg/>")).toBe(etag);
    expect(await svgEtag("<svg></svg>")).not.toBe(etag);
    expect(etagMatches(etag, etag)).toBe(true);
    expect(etagMatches(`"other", W/${etag}`, etag)).toBe(true);
    expect(etagMatches("*", etag)).toBe(true);
    expect(etagMatches(null, etag)).toBe(false);
    expect(etagMatches('"other"', etag)).toBe(false);
  });
});

describe("renderCard avatars", () => {
  const AVATAR = "data:image/png;base64,iVBORw0KGgo=";

  it("loads and embeds avatars only when the header shows them", async () => {
    const loadAvatars = vi.fn(async () => ({ github: AVATAR }));
    const withAvatars = await renderCard(
      new URLSearchParams("v=1&github=jenkruk&hdr=compact&av=github"),
      loaders(),
      loadAvatars,
    );
    expect(loadAvatars).toHaveBeenCalledWith({ github: "jenkruk" }, ["github"]);
    expect(withAvatars.svg).toContain(`href="${AVATAR}"`);

    loadAvatars.mockClear();
    await renderCard(new URLSearchParams("v=1&github=jenkruk&av=github"), loaders(), loadAvatars);
    expect(loadAvatars).not.toHaveBeenCalled();
  });

  it("falls back to a monogram if avatar loading fails", async () => {
    const card = await renderCard(new URLSearchParams("v=1&github=jenkruk&hdr=full&av=github"), loaders(), async () => {
      throw new Error("boom");
    });
    expect(card.status).toBe("ok");
    expect(card.svg).toMatch(/<text[^>]*>J<\/text>/);
  });
});

describe("cache lifetimes follow the 12-hour data window", () => {
  const at = (iso: string) => Date.parse(iso);
  const renderAt = (startIso: string, query = "v=1&github=jenkruk") =>
    renderCard(new URLSearchParams(query), loaders(), undefined, { policy: DEFAULT_POLICY, now: () => at(startIso) });
  const seconds = (header: string) => Number(/max-?age=(\d+)/.exec(header)![1]);

  it.each([
    ["2026-11-17T00:00:00.000Z", "2026-11-17T12:00:00.000Z", 43_200],
    ["2026-11-17T06:00:00.000Z", "2026-11-17T12:00:00.000Z", 21_600],
    ["2026-11-17T11:59:30.000Z", "2026-11-17T12:00:00.000Z", 30],
    ["2026-11-17T11:59:59.999Z", "2026-11-17T12:00:00.000Z", 0],
    ["2026-11-17T12:00:00.000Z", "2026-11-18T00:00:00.000Z", 43_200],
    ["2026-11-17T23:59:59.000Z", "2026-11-18T00:00:00.000Z", 1],
  ])("a fresh card rendered at %s is valid until %s (max-age %i)", async (start, end, maxAge) => {
    const card = await renderAt(start);
    expect(card).toMatchObject({ status: "ok", validUntil: at(end) });
    expect(cacheHeaders(card, at(start))).toEqual({
      "Cache-Control": `public, max-age=${maxAge}`,
      "Vercel-CDN-Cache-Control": `public, s-maxage=${Math.min(maxAge, 3600)}`,
    });
  });

  it("never lets any cache keep a fresh card past the end of its window, whenever it's served", async () => {
    for (let minute = 0; minute < 24 * 60; minute += 7) {
      const now = at("2026-11-17T00:00:00.000Z") + minute * 60_000 + 123;
      const card = await renderCard(new URLSearchParams("v=1&github=jenkruk"), loaders(), undefined, {
        now: () => now,
      });
      const headers = cacheHeaders(card, now);
      expect(now + seconds(headers["Cache-Control"]) * 1000).toBeLessThanOrEqual(card.validUntil!);
      expect(now + seconds(headers["Vercel-CDN-Cache-Control"]) * 1000).toBeLessThanOrEqual(card.validUntil!);
      expect(headers["Vercel-CDN-Cache-Control"]).not.toContain("stale-while-revalidate");
    }
  });

  it("keeps the window of the request's start when the window rolls over while it renders", async () => {
    const card = await renderAt("2026-11-17T11:59:59.900Z");
    expect(cacheHeaders(card, at("2026-11-17T12:00:00.400Z"))).toEqual({
      "Cache-Control": "public, max-age=0",
      "Vercel-CDN-Cache-Control": "public, s-maxage=0",
    });
  });

  it("leaves stale and error cards uncacheable downstream with their existing edge lifetimes", async () => {
    const staleGitHub = async (u: string): Promise<AdapterResult> => {
      const result = ok("github", u);
      return result.ok
        ? { ok: true, data: { ...result.data, stale: true, fetchedAt: "2026-11-16T08:00:00.000Z" } }
        : result;
    };
    const stale = await renderCard(new URLSearchParams("v=1&github=jenkruk"), loaders({ github: staleGitHub }));
    expect(stale.validUntil).toBeUndefined();
    expect(cacheHeaders(stale, Date.now())).toEqual({
      "Cache-Control": "no-cache, max-age=0",
      "Vercel-CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
    });
    const invalid = await render("v=1&github=jenkruk&palette=neon");
    expect(cacheHeaders(invalid, Date.now())).toEqual({
      "Cache-Control": "no-cache, max-age=0",
      "Vercel-CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
    });
  });

  it("caches a card missing a requested avatar for at most 30 minutes, so a failed fetch doesn't stick", async () => {
    const start = "2026-11-17T01:00:00.000Z";
    const options = { now: () => at(start) };
    const missing = await renderCard(
      new URLSearchParams("v=1&github=jenkruk&gitlab=contactkruk&hdr=compact&av=github,gitlab"),
      loaders(),
      async () => ({ github: "data:image/png;base64,iVBORw0KGgo=" }),
      options,
    );
    expect(missing.missingAvatar).toBe(true);
    expect(cacheHeaders(missing, at(start))).toEqual({
      "Cache-Control": "public, max-age=1800",
      "Vercel-CDN-Cache-Control": "public, s-maxage=1800",
    });

    const nearEnd = await renderCard(
      new URLSearchParams("v=1&github=jenkruk&hdr=compact&av=github"),
      loaders(),
      async () => ({}),
      { now: () => at("2026-11-17T11:50:00.000Z") },
    );
    expect(cacheHeaders(nearEnd, at("2026-11-17T11:50:00.000Z"))["Cache-Control"]).toBe("public, max-age=600");

    const complete = await renderCard(
      new URLSearchParams("v=1&github=jenkruk&hdr=compact&av=github"),
      loaders(),
      async () => ({ github: "data:image/png;base64,iVBORw0KGgo=" }),
      options,
    );
    expect(complete.missingAvatar).toBeUndefined();
    expect(cacheHeaders(complete, at(start))["Cache-Control"]).toBe("public, max-age=39600");
  });
});
