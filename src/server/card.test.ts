import { afterEach, describe, expect, it, vi } from "vitest";
import { adapterError, type AdapterResult } from "@/adapters/types";
import { toISODate } from "@/domain/dates";
import type { ContributionLoaders } from "./contributions";
import { etagMatches, renderCard, svgEtag } from "./card";

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
    ["github=jenkruk", "5 contributions on GitHub @jenkruk"],
    ["gitlab=contactkruk", "5 contributions on GitLab @contactkruk"],
    ["github=jenkruk&gitlab=contactkruk", "10 contributions across GitHub @jenkruk and GitLab @contactkruk"],
  ])("renders %s with a meaningful accessible description", async (query, expected) => {
    const card = await render(`v=1&${query}`);
    expect(card.status).toBe("ok");
    expect(card.edgeMaxAge).toBe(3600);
    expect(card.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(descOf(card.svg)).toContain(expected);
    expect(descOf(card.svg)).toMatch(/Nov 7, 2025 to Nov 6, 2026\. .*active days\./);
    expect(card.svg).not.toContain("Sample data");
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
    expect(card.svg).toContain(message.replace("<", "&lt;"));
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
    // Every rendered line fits the 840px card at the conservative glyph estimate.
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(100);
    expect(card.svg).not.toContain("b".repeat(40)); // the username is truncated in the message
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
    expect(descOf(card.svg)).toContain("Showing data last updated Nov 3, 2026; a refresh is pending.");
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
