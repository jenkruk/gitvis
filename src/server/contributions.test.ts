import { describe, expect, it, vi } from "vitest";
import { adapterError, type AdapterResult } from "@/adapters/types";
import { normalizeDailyCounts } from "@/domain/combine";
import { toISODate } from "@/domain/dates";
import type { PlatformId } from "@/domain/types";
import { type ContributionLoaders, loadContributions } from "./contributions";

const TODAY = toISODate("2026-11-06");

function ok(platform: PlatformId, entries: [string, number][], extra: object = {}): AdapterResult {
  return {
    ok: true,
    data: {
      platform,
      username: `${platform}-user`,
      days: normalizeDailyCounts(entries.map(([date, count]) => ({ date, count }))),
      ...extra,
    },
  };
}

function loaders(overrides: Partial<ContributionLoaders> = {}): ContributionLoaders {
  return {
    github: vi.fn(async () => ok("github", [["2026-11-01", 2]])),
    gitlab: vi.fn(async () => ok("gitlab", [["2026-11-02", 3]])),
    today: () => TODAY,
    ...overrides,
  };
}

describe("loadContributions", () => {
  it("combines both platforms into a live dataset with a trailing-year range", async () => {
    const l = loaders();
    const response = await loadContributions({ github: "jenkruk", gitlab: "contactkruk" }, l);

    expect(response.dataset).toMatchObject({
      provenance: "live",
      range: { start: "2025-11-07", end: "2026-11-06" },
    });
    expect(response.dataset!.days).toHaveLength(365);
    expect(response.results).toEqual([
      { platform: "github", username: "jenkruk", status: "ok", total: 2, privateCount: undefined },
      { platform: "gitlab", username: "contactkruk", status: "ok", total: 3, privateCount: undefined },
    ]);
    expect(l.github).toHaveBeenCalledWith("jenkruk", { start: "2025-11-07", end: "2026-11-06" });
  });

  it("only calls the platforms that were requested", async () => {
    const l = loaders();
    const response = await loadContributions({ gitlab: "contactkruk" }, l);
    expect(l.github).not.toHaveBeenCalled();
    expect(response.results.map((r) => r.platform)).toEqual(["gitlab"]);
    expect(response.dataset!.sources.map((s) => s.platform)).toEqual(["gitlab"]);
  });

  it("returns partial results when one platform fails", async () => {
    const response = await loadContributions(
      { github: "jenkruk", gitlab: "contactkruk" },
      loaders({ github: async () => adapterError("github", "rate_limited", "Slow down") }),
    );
    expect(response.results[0]).toEqual({
      platform: "github",
      username: "jenkruk",
      status: "rate_limited",
      message: "Slow down",
      retryable: true,
    });
    expect(response.results[1]).toMatchObject({ status: "ok" });
    expect(response.dataset!.sources.map((s) => s.platform)).toEqual(["gitlab"]);
  });

  it("returns a null dataset when nothing loads, marking stable errors as not retryable", async () => {
    const response = await loadContributions(
      { gitlab: "ghost" },
      loaders({ gitlab: async () => adapterError("gitlab", "not_found", "Not found") }),
    );
    expect(response.dataset).toBeNull();
    expect(response.results[0]).toMatchObject({ status: "not_found", retryable: false });
  });

  it("extends the range by one day for activity dated tomorrow-in-UTC", async () => {
    const response = await loadContributions(
      { gitlab: "east" },
      loaders({ gitlab: async () => ok("gitlab", [["2026-11-07", 4]]) }),
    );
    expect(response.dataset!.range).toEqual({ start: "2025-11-08", end: "2026-11-07" });
    expect(response.results[0]).toMatchObject({ total: 4 });
  });

  it("ignores implausible future dates and excludes out-of-range days from totals", async () => {
    const response = await loadContributions(
      { gitlab: "x" },
      loaders({
        gitlab: async () =>
          ok("gitlab", [
            ["2024-01-01", 50],
            ["2026-11-06", 1],
            ["2026-12-25", 9],
          ]),
      }),
    );
    expect(response.dataset!.range.end).toBe("2026-11-06");
    expect(response.results[0]).toMatchObject({ total: 1 });
  });

  it("passes through GitHub's private contribution count", async () => {
    const response = await loadContributions(
      { github: "jenkruk" },
      loaders({ github: async () => ok("github", [["2026-11-01", 5]], { privateCount: 3 }) }),
    );
    expect(response.results[0]).toMatchObject({ status: "ok", total: 5, privateCount: 3 });
  });
});
