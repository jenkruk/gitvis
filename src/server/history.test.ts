import { describe, expect, it, vi } from "vitest";
import type { HistoryResult } from "@/adapters/github";
import type { AdapterResult } from "@/adapters/types";
import { normalizeDailyCounts } from "@/domain/combine";
import { addDays, toISODate } from "@/domain/dates";
import type { SnapshotStore } from "./cached";
import { type ContributionLoaders, loadContributions } from "./contributions";
import { renderCard } from "./card";
import { createHistoryLoader, HISTORY_POLICY, historyKey, yearsIn } from "./history";

const TODAY = toISODate("2026-11-06");
const NOW = Date.parse("2026-11-06T12:00:00Z");
const DAY = 86_400_000;

function memoryStore() {
  const data = new Map<string, { value: unknown; ttl: number }>();
  const store: SnapshotStore = {
    get: vi.fn(async (key: string) => data.get(key)?.value ?? null),
    set: vi.fn(async (key: string, value: unknown, ttl: number) => void data.set(key, { value, ttl })),
  };
  return { store, data };
}

const yearDays = (year: number) => [{ date: toISODate(`${year}-06-15`), count: year - 2000 }];
const okYears = (years: readonly number[]): HistoryResult => ({
  ok: true,
  years: years.map((year) => ({ year, days: yearDays(year) })),
});

describe("GitHub history cache", () => {
  const range = { start: toISODate("2023-11-08"), end: toISODate("2025-11-07") };

  it("splits a range into complete calendar years", () => {
    expect(yearsIn(range)).toEqual([2023, 2024, 2025]);
  });

  it("fetches every missing year in ONE request and stores one key per year", async () => {
    const { store, data } = memoryStore();
    const fetchYears = vi.fn(async (_u: string, years: readonly number[]) => okYears(years));
    const load = createHistoryLoader({ store, fetchYears, now: () => NOW });

    const result = await load("JenKruk", range);
    expect(fetchYears).toHaveBeenCalledTimes(1);
    expect(fetchYears).toHaveBeenCalledWith("JenKruk", [2023, 2024, 2025]);
    expect([...data.keys()]).toEqual([
      historyKey("jenkruk", 2023),
      historyKey("jenkruk", 2024),
      historyKey("jenkruk", 2025),
    ]);
    expect(data.get(historyKey("jenkruk", 2024))!.ttl).toBe(HISTORY_POLICY.completeYear.ttlSeconds);
    expect(result).toEqual({ ok: true, days: [...yearDays(2024), ...yearDays(2025)] }); // 2023-06 is outside the range
  });

  it("reuses cached years for a week without calling GitHub (case-insensitive logins)", async () => {
    const { store } = memoryStore();
    const fetchYears = vi.fn(async (_u: string, years: readonly number[]) => okYears(years));
    let now = NOW;
    const load = createHistoryLoader({ store, fetchYears, now: () => now });
    await load("jenkruk", range);
    now += 6 * DAY;
    await load("JENKRUK", range);
    expect(fetchYears).toHaveBeenCalledTimes(1);
  });

  it("only fetches the years it doesn't have (e.g. a new year after Jan 1)", async () => {
    const { store } = memoryStore();
    const fetchYears = vi.fn(async (_u: string, years: readonly number[]) => okYears(years));
    const load = createHistoryLoader({ store, fetchYears, now: () => NOW });
    await load("jenkruk", { start: toISODate("2024-01-01"), end: toISODate("2024-12-31") });
    await load("jenkruk", range);
    expect(fetchYears).toHaveBeenLastCalledWith("jenkruk", [2023, 2025]);
  });

  it("refreshes weekly, but keeps serving cached years if the refresh fails", async () => {
    const { store } = memoryStore();
    const fetchYears = vi.fn(async (_u: string, years: readonly number[]) => okYears(years));
    let now = NOW;
    const load = createHistoryLoader({ store, fetchYears, now: () => now });
    await load("jenkruk", range);

    now += 8 * DAY;
    fetchYears.mockResolvedValueOnce({ ok: false, error: { platform: "github", kind: "upstream", message: "x" } });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await load("jenkruk", range);
    expect(fetchYears).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });

  it("fails honestly — and writes nothing — when a year has never been loaded", async () => {
    const { store, data } = memoryStore();
    const fetchYears = vi.fn(async (): Promise<HistoryResult> => ({
      ok: false,
      error: { platform: "github", kind: "rate_limited", message: "GitHub rate limit reached." },
    }));
    const load = createHistoryLoader({ store, fetchYears, now: () => NOW });
    expect(await load("jenkruk", range)).toEqual({
      ok: false,
      error: { platform: "github", kind: "rate_limited", message: "GitHub rate limit reached." },
    });
    expect(data.size).toBe(0);
  });

  it("ignores malformed cache entries", async () => {
    const { store, data } = memoryStore();
    data.set(historyKey("jenkruk", 2024), { value: { days: "nope", fetchedAt: "x" }, ttl: 1 });
    const fetchYears = vi.fn(async (_u: string, years: readonly number[]) => okYears(years));
    await createHistoryLoader({ store, fetchYears, now: () => NOW })("jenkruk", range);
    expect(fetchYears).toHaveBeenCalledWith("jenkruk", [2023, 2024, 2025]);
  });

  it("shares one request between concurrent views", async () => {
    const { store } = memoryStore();
    const fetchYears = vi.fn(async (_u: string, years: readonly number[]) => okYears(years));
    const load = createHistoryLoader({ store, fetchYears, now: () => NOW });
    await Promise.all([load("jenkruk", range), load("jenkruk", range), load("jenkruk", range)]);
    expect(fetchYears).toHaveBeenCalledTimes(1);
  });
});

function ok(platform: "github" | "gitlab", entries: [string, number][]): AdapterResult {
  return {
    ok: true,
    data: {
      platform,
      username: `${platform}-user`,
      profileUrl: `https://${platform}.com/${platform}-user`,
      days: normalizeDailyCounts(entries.map(([date, count]) => ({ date, count }))),
    },
  };
}

function loaders(overrides: Partial<ContributionLoaders> = {}): ContributionLoaders {
  return {
    github: vi.fn(async () => ok("github", [["2026-11-01", 2]])),
    gitlab: vi.fn(async () => ok("gitlab", [["2026-11-02", 3]])),
    githubHistory: vi.fn(async () => ({ ok: true as const, days: [{ date: addDays(TODAY, -500), count: 9 }] })),
    today: () => TODAY,
    ...overrides,
  };
}

describe("loadContributions with history", () => {
  it("leaves 1-year requests exactly as before (no history call, no coverage)", async () => {
    const l = loaders();
    const response = await loadContributions({ github: "a", gitlab: "b" }, l);
    expect(l.githubHistory).not.toHaveBeenCalled();
    expect(response.history).toBeUndefined();
    expect(response.dataset!.sources.every((s) => s.coverage === undefined)).toBe(true);
  });

  it("extends GitHub to 3 years and marks GitLab as covering only the last 12 months", async () => {
    const l = loaders();
    const response = await loadContributions({ github: "a", gitlab: "b" }, l, { years: 3 });
    expect(l.githubHistory).toHaveBeenCalledWith("a", { start: "2023-11-08", end: "2025-11-07" });
    expect(response.history).toEqual({ years: 3, status: "ok" });
    const { dataset } = response;
    expect(dataset!.range).toEqual({ start: "2023-11-08", end: "2026-11-06" });
    expect(dataset!.days).toHaveLength(1095);
    const [github, gitlab] = dataset!.sources;
    expect(github!.coverage).toEqual(dataset!.range);
    expect(gitlab!.coverage).toEqual({ start: "2025-11-07", end: "2026-11-06" });
    // The per-platform "last 12 months" total is unchanged.
    expect(response.results[0]).toMatchObject({ status: "ok", total: 2 });
    expect(dataset!.days.find((d) => d.date === addDays(TODAY, -500))!.byPlatform).toEqual({ github: 9 });
  });

  it("never asks GitLab (or anyone) for history it can't provide", async () => {
    const l = loaders();
    const response = await loadContributions({ gitlab: "b" }, l, { years: 3 });
    expect(l.githubHistory).not.toHaveBeenCalled();
    expect(response.history).toBeUndefined();
    expect(response.dataset!.days).toHaveLength(365);
  });

  it("reports a history failure separately and keeps the last 12 months", async () => {
    const l = loaders({
      githubHistory: vi.fn(async () => ({
        ok: false as const,
        error: { platform: "github" as const, kind: "upstream" as const, message: "down" },
      })),
    });
    const response = await loadContributions({ github: "a" }, l, { years: 2 });
    expect(response.history).toEqual({ years: 2, status: "upstream", message: "down", retryable: true });
    expect(response.dataset!.days).toHaveLength(365);
  });
});

describe("published multi-year card", () => {
  it("renders the stacked calendars", async () => {
    const card = await renderCard(new URLSearchParams("v=1&github=jenkruk&gitlab=contactkruk&yrs=3"), loaders());
    expect(card.status).toBe("ok");
    expect(card.svg).toContain("Nov 8, 2023 – Nov 6, 2024");
    expect(card.svg).toContain("GitLab history isn&#x27;t available for this period.");
  });

  it("shows an explanatory error instead of fewer years when history can't load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const card = await renderCard(
      new URLSearchParams("v=1&github=jenkruk&yrs=2"),
      loaders({
        githubHistory: vi.fn(async () => ({
          ok: false as const,
          error: { platform: "github" as const, kind: "upstream" as const, message: "x" },
        })),
      }),
    );
    expect(card.status).toBe("unavailable");
    expect(card.edgeMaxAge).toBe(60);
    expect(card.svg).toContain("Earlier GitHub history couldn");
  });

  it("rejects a multi-year URL combined with a 30/90-day range", async () => {
    const card = await renderCard(new URLSearchParams("v=1&github=jenkruk&yrs=2&range=90"), loaders());
    expect(card.status).toBe("invalid_config");
  });
});
