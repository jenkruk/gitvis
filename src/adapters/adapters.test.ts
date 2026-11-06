import { describe, expect, it } from "vitest";
import { type GitHubContributionsResponse, normalizeGitHubContributions } from "./github";
import { gitlabCalendarUrl, normalizeGitLabCalendar } from "./gitlab";
import { isValidGitHubUsername, isValidGitLabUsername } from "./types";

describe("username validation", () => {
  it("GitHub", () => {
    for (const ok of ["jenkruk", "a", "a-b", "A1", "x".repeat(39)]) expect(isValidGitHubUsername(ok), ok).toBe(true);
    for (const bad of ["", "-a", "a-", "a--b", "a_b", "a.b", "x".repeat(40), "a/b", "a b"]) {
      expect(isValidGitHubUsername(bad), bad).toBe(false);
    }
  });

  it("GitLab", () => {
    for (const ok of ["contactkruk", "a", "first.last", "a_b-c", "A1"])
      expect(isValidGitLabUsername(ok), ok).toBe(true);
    for (const bad of ["", ".a", "a.", "a..b", "a._b", "repo.git", "me.atom", "a/b", "../x"]) {
      expect(isValidGitLabUsername(bad), bad).toBe(false);
    }
  });

  it("encodes usernames into URLs", () => {
    expect(gitlabCalendarUrl("contactkruk")).toBe("https://gitlab.com/users/contactkruk/calendar.json");
  });
});

describe("normalizeGitLabCalendar", () => {
  it("normalizes the sparse calendar.json shape", () => {
    // Shape matches a real GitLab.com response (values illustrative).
    const result = normalizeGitLabCalendar("contactkruk", { "2026-08-25": 10, "2026-07-01": 2, "2026-08-19": 8 });
    expect(result).toEqual({
      ok: true,
      data: {
        platform: "gitlab",
        username: "contactkruk",
        profileUrl: "https://gitlab.com/contactkruk",
        days: [
          { date: "2026-07-01", count: 2 },
          { date: "2026-08-19", count: 8 },
          { date: "2026-08-25", count: 10 },
        ],
      },
    });
  });

  it("accepts an empty calendar (inactive user)", () => {
    const result = normalizeGitLabCalendar("quiet", {});
    expect(result.ok && result.data.days).toEqual([]);
  });

  it("rejects unexpected shapes", () => {
    for (const body of [null, [], "html", { "2026-01-01": "3" }]) {
      const result = normalizeGitLabCalendar("x", body);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe("invalid_response");
    }
  });
});

describe("normalizeGitHubContributions", () => {
  const response = (restricted: number): GitHubContributionsResponse => ({
    data: {
      user: {
        contributionsCollection: {
          restrictedContributionsCount: restricted,
          contributionCalendar: {
            totalContributions: 6,
            weeks: [
              {
                contributionDays: [
                  { date: "2026-11-01", contributionCount: 0 },
                  { date: "2026-11-02", contributionCount: 4 },
                ],
              },
              { contributionDays: [{ date: "2026-11-08", contributionCount: 2 }] },
            ],
          },
        },
      },
    },
  });

  it("flattens weeks into normalized days and keeps reported totals", () => {
    const result = normalizeGitHubContributions("jenkruk", response(3));
    expect(result).toEqual({
      ok: true,
      data: {
        platform: "github",
        username: "jenkruk",
        profileUrl: "https://github.com/jenkruk",
        days: [
          { date: "2026-11-02", count: 4 },
          { date: "2026-11-08", count: 2 },
        ],
        reportedTotal: 6,
        privateCount: 3,
      },
    });
  });

  it("omits a zero private count rather than claiming there were none", () => {
    const result = normalizeGitHubContributions("jenkruk", response(0));
    expect(result.ok && result.data.privateCount).toBeUndefined();
  });

  it("maps a missing user to not_found", () => {
    const result = normalizeGitHubContributions("ghost-xyz", {
      data: { user: null },
      errors: [{ type: "NOT_FOUND", message: "Could not resolve to a User" }],
    });
    expect(!result.ok && result.error.kind).toBe("not_found");
  });

  it("maps rate limiting and malformed responses", () => {
    expect(
      normalizeGitHubContributions("a", { errors: [{ type: "RATE_LIMITED", message: "slow down" }] }),
    ).toMatchObject({ ok: false, error: { kind: "rate_limited" } });
    expect(normalizeGitHubContributions("a", {})).toMatchObject({ ok: false, error: { kind: "invalid_response" } });
  });
});

describe("GitHub history query", () => {
  it("passes dates and login only as variables, one aliased collection per year", async () => {
    const { githubYearsQuery, githubYearsVariables } = await import("./github");
    const query = githubYearsQuery(3);
    expect(query.match(/contributionsCollection\(from: \$from\d, to: \$to\d\)/g)).toHaveLength(3);
    expect(query).not.toMatch(/\d{4}-\d{2}-\d{2}/); // no literal dates
    expect(githubYearsVariables('jen"kruk', [2023, 2024])).toEqual({
      login: 'jen"kruk',
      from0: "2023-01-01T00:00:00Z",
      to0: "2023-12-31T23:59:59Z",
      from1: "2024-01-01T00:00:00Z",
      to1: "2024-12-31T23:59:59Z",
    });
    expect(githubYearsQuery(99).match(/contributionsCollection/g)).toHaveLength(4); // bounded
  });

  it("normalizes each year and rejects incomplete responses", async () => {
    const { normalizeGitHubYears } = await import("./github");
    const day = (date: string, contributionCount: number) => ({ date, contributionCount });
    const calendar = (days: ReturnType<typeof day>[]) => ({
      contributionCalendar: { weeks: [{ contributionDays: days }] },
    });
    expect(
      normalizeGitHubYears("a", [2023, 2024], {
        data: { user: { y0: calendar([day("2023-02-01", 2)]), y1: calendar([day("2024-03-01", 0)]) } },
      }),
    ).toEqual({
      ok: true,
      years: [
        { year: 2023, days: [{ date: "2023-02-01", count: 2 }] },
        { year: 2024, days: [] },
      ],
    });
    expect(normalizeGitHubYears("a", [2023, 2024], { data: { user: { y0: calendar([]) } } })).toMatchObject({
      ok: false,
      error: { kind: "invalid_response" },
    });
    expect(normalizeGitHubYears("a", [2023], { data: { user: null } })).toMatchObject({
      ok: false,
      error: { kind: "not_found" },
    });
  });
});
