import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { toISODate, trailingYear } from "@/domain/dates";
import { fetchGitHubContributions, fetchGitHubYears } from "./github";
import { createHistoryLoader, yearsIn } from "./history";
import type { SnapshotStore } from "./cached";

const login = process.env.GITVIS_LIVE_GITHUB;
const token = process.env.GITHUB_TOKEN;

describe.skipIf(!login || !token)("live GitHub API (opt-in)", () => {
  it("fetches several calendar years in one request and the trailing year", { timeout: 60_000 }, async () => {
    const today = toISODate(new Date().toISOString().slice(0, 10));
    const years = [2023, 2024, 2025];
    const history = await fetchGitHubYears(login!, years, token, { timeoutMs: 20_000 });
    expect(history.ok).toBe(true);
    const trailing = await fetchGitHubContributions(login!, trailingYear(today), token, { timeoutMs: 20_000 });
    expect(trailing.ok).toBe(true);
    if (!history.ok || !trailing.ok) return;

    for (const { year, days } of history.years) expect(days.every((d) => d.date.startsWith(`${year}-`))).toBe(true);

    const data = new Map<string, unknown>();
    const store: SnapshotStore = { get: async (k) => data.get(k) ?? null, set: async (k, v) => void data.set(k, v) };
    let requests = 0;
    const load = createHistoryLoader({
      store,
      fetchYears: (user, ys) => {
        requests++;
        return fetchGitHubYears(user, ys, token, { timeoutMs: 20_000 });
      },
    });
    const range = { start: toISODate("2023-11-08"), end: toISODate("2025-11-07") };
    const first = await load(login!, range);
    const second = await load(login!.toUpperCase(), { start: toISODate("2024-11-08"), end: range.end });
    expect(first.ok && second.ok).toBe(true);
    expect(requests).toBe(1);
    expect(yearsIn(range)).toEqual(years);

    if (process.env.GITVIS_LIVE_OUT) {
      writeFileSync(
        process.env.GITVIS_LIVE_OUT,
        JSON.stringify({
          fetchedAt: new Date().toISOString(),
          years: history.years,
          trailing: { range: trailingYear(today), days: trailing.data.days },
          cachedKeys: [...data.keys()],
        }),
      );
    }
  });
});
