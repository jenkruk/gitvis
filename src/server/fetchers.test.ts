import { afterEach, describe, expect, it, vi } from "vitest";
import { toISODate } from "@/domain/dates";
import { fetchGitHubContributions, GITHUB_GRAPHQL_URL } from "./github";
import { fetchGitLabContributions } from "./gitlab";

const range = { start: toISODate("2025-11-07"), end: toISODate("2026-11-06") };

function respond(status: number, body?: unknown, init: ResponseInit = {}) {
  return vi.fn<typeof fetch>(
    async () =>
      new Response(body === undefined ? null : typeof body === "string" ? body : JSON.stringify(body), {
        status,
        ...init,
      }),
  );
}

afterEach(() => vi.restoreAllMocks());

describe("fetchGitHubContributions", () => {
  const ok = {
    data: {
      user: {
        contributionsCollection: {
          restrictedContributionsCount: 0,
          contributionCalendar: {
            totalContributions: 3,
            weeks: [{ contributionDays: [{ date: "2026-11-02", contributionCount: 3 }] }],
          },
        },
      },
    },
  };

  it("reports not_configured without a token and makes no request", async () => {
    const fetchImpl = respond(200, ok);
    const result = await fetchGitHubContributions("jenkruk", range, undefined, { fetchImpl });
    expect(result).toMatchObject({ ok: false, error: { kind: "not_configured" } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends the username as a GraphQL variable with a bounded date range", async () => {
    const fetchImpl = respond(200, ok);
    const result = await fetchGitHubContributions("jenkruk", range, "token-123", { fetchImpl });

    expect(result).toMatchObject({ ok: true, data: { platform: "github", days: [{ date: "2026-11-02", count: 3 }] } });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(GITHUB_GRAPHQL_URL);
    expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer token-123");
    const body = JSON.parse(init!.body as string);
    expect(body.variables).toMatchObject({
      login: "jenkruk",
      from: "2025-11-07T00:00:00Z",
      to: "2026-11-06T23:59:59Z",
      hasLead: false,
    });
    expect(body.query).not.toContain("jenkruk");
  });

  it("fetches the days before GitHub's 365-day calendar limit as a second collection", async () => {
    const withLead = {
      data: {
        user: {
          ...ok.data.user,
          lead: {
            restrictedContributionsCount: 1,
            contributionCalendar: {
              totalContributions: 6,
              weeks: [{ contributionDays: [{ date: "2025-11-04", contributionCount: 6 }] }],
            },
          },
        },
      },
    };
    const fetchImpl = respond(200, withLead);
    const githubYear = { start: toISODate("2025-11-02"), end: toISODate("2026-11-06") };
    const result = await fetchGitHubContributions("jenkruk", githubYear, "token-123", { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchImpl.mock.calls[0]![1]!.body as string);
    expect(body.variables).toEqual({
      login: "jenkruk",
      from: "2025-11-07T00:00:00Z",
      to: "2026-11-06T23:59:59Z",
      leadFrom: "2025-11-02T00:00:00Z",
      leadTo: "2025-11-06T23:59:59Z",
      hasLead: true,
    });
    expect(result).toMatchObject({
      ok: true,
      data: {
        days: [
          { date: "2025-11-04", count: 6 },
          { date: "2026-11-02", count: 3 },
        ],
      },
    });
  });

  it("maps a rejected token to not_configured without leaking details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await fetchGitHubContributions("jenkruk", range, "secret-token", { fetchImpl: respond(401, {}) });
    expect(result).toMatchObject({ ok: false, error: { kind: "not_configured" } });
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });

  it.each([403, 429])("maps HTTP %i to rate_limited", async (status) => {
    const result = await fetchGitHubContributions("jenkruk", range, "t", { fetchImpl: respond(status, {}) });
    expect(result).toMatchObject({ ok: false, error: { kind: "rate_limited" } });
  });

  it("maps network failures and timeouts to upstream", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new DOMException("timed out", "TimeoutError");
    });
    const result = await fetchGitHubContributions("jenkruk", range, "t", { fetchImpl });
    expect(result).toMatchObject({ ok: false, error: { kind: "upstream" } });
  });

  it("maps a GraphQL NOT_FOUND to not_found", async () => {
    const fetchImpl = respond(200, { data: { user: null }, errors: [{ type: "NOT_FOUND", message: "nope" }] });
    const result = await fetchGitHubContributions("ghost-xyz", range, "t", { fetchImpl });
    expect(result).toMatchObject({ ok: false, error: { kind: "not_found" } });
  });

  it("maps non-JSON bodies to invalid_response", async () => {
    const result = await fetchGitHubContributions("jenkruk", range, "t", { fetchImpl: respond(200, "<html>") });
    expect(result).toMatchObject({ ok: false, error: { kind: "invalid_response" } });
  });
});

describe("fetchGitLabContributions", () => {
  it("normalizes calendar.json and requests it without following redirects", async () => {
    const fetchImpl = respond(200, { "2026-08-25": 10, "2026-07-01": 2 });
    const result = await fetchGitLabContributions("contactkruk", { fetchImpl });

    expect(result).toMatchObject({
      ok: true,
      data: {
        platform: "gitlab",
        days: [
          { date: "2026-07-01", count: 2 },
          { date: "2026-08-25", count: 10 },
        ],
      },
    });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://gitlab.com/users/contactkruk/calendar.json");
    expect(init!.redirect).toBe("manual");
  });

  it("treats the sign-in redirect (unknown or private user) as not_found", async () => {
    const fetchImpl = respond(302, undefined, { headers: { Location: "https://gitlab.com/users/sign_in" } });
    const result = await fetchGitLabContributions("ghost-xyz", { fetchImpl });
    expect(result).toMatchObject({ ok: false, error: { kind: "not_found" } });
    if (!result.ok) expect(result.error.message).toMatch(/may be private/);
  });

  it.each([
    [404, "not_found"],
    [429, "rate_limited"],
    [500, "upstream"],
  ])("maps HTTP %i to %s", async (status, kind) => {
    const result = await fetchGitLabContributions("x", { fetchImpl: respond(status, {}) });
    expect(result).toMatchObject({ ok: false, error: { kind } });
  });

  it("maps HTML (e.g. a maintenance page) to invalid_response", async () => {
    const result = await fetchGitLabContributions("x", { fetchImpl: respond(200, "<!doctype html>") });
    expect(result).toMatchObject({ ok: false, error: { kind: "invalid_response" } });
  });
});
