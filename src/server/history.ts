import "server-only";
import { type HistoryResult, MAX_HISTORY_YEARS_PER_REQUEST } from "@/adapters/github";
import type { AdapterError } from "@/adapters/types";
import { type DateRange, isWithinRange } from "@/domain/dates";
import type { DailyCount } from "@/domain/types";
import type { SnapshotStore } from "./cached";
import { upstreamBudget } from "./rate-limit";

export const HISTORY_SCHEMA = 1;
const DAY_MS = 86_400_000;
export const HISTORY_POLICY = {
  completeYear: { refreshAfterMs: 7 * DAY_MS, ttlSeconds: 30 * 86_400 },
  currentYear: { refreshAfterMs: DAY_MS / 2, ttlSeconds: 86_400 },
} as const;

export type HistoryOutcome = { ok: true; days: DailyCount[] } | { ok: false; error: AdapterError };
export type HistoryFetcher = (username: string, years: readonly number[]) => Promise<HistoryResult>;

interface StoredYear {
  days: DailyCount[];
  fetchedAt: string;
}

export function historyKey(username: string, year: number): string {
  return `v${HISTORY_SCHEMA}:github-year:${username.toLowerCase()}:${year}`;
}

function asStoredYear(value: unknown): StoredYear | null {
  if (!value || typeof value !== "object") return null;
  const { days, fetchedAt } = value as Partial<StoredYear>;
  if (typeof fetchedAt !== "string" || Number.isNaN(Date.parse(fetchedAt)) || !Array.isArray(days)) return null;
  const valid = days.every(
    (d) =>
      d && typeof d === "object" && typeof d.date === "string" && Number.isFinite(d.count) && (d.count as number) >= 0,
  );
  return valid ? (value as StoredYear) : null;
}

export function yearsIn(range: DateRange): number[] {
  const first = Number(range.start.slice(0, 4));
  const last = Number(range.end.slice(0, 4));
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => first + i);
}

export interface HistoryLoaderDeps {
  store: SnapshotStore;
  fetchYears: HistoryFetcher;
  now?: () => number;
}

export function createHistoryLoader({ store, fetchYears, now = Date.now }: HistoryLoaderDeps) {
  const inFlight = new Map<string, Promise<HistoryOutcome>>();

  async function load(username: string, range: DateRange): Promise<HistoryOutcome> {
    const currentYear = new Date(now()).getUTCFullYear();
    const policyFor = (year: number) => (year < currentYear ? HISTORY_POLICY.completeYear : HISTORY_POLICY.currentYear);
    const years = yearsIn(range);

    const cached = new Map<number, StoredYear>();
    await Promise.all(
      years.map(async (year) => {
        try {
          const stored = asStoredYear(await store.get(historyKey(username, year)));
          if (stored) cached.set(year, stored);
        } catch (error) {
          console.error("[gitvis] history read failed (treating as a miss)", error);
        }
      }),
    );
    const due = years.filter((year) => {
      const stored = cached.get(year);
      return !stored || now() - Date.parse(stored.fetchedAt) > policyFor(year).refreshAfterMs;
    });

    const fresh = new Map<number, DailyCount[]>();
    let failure: AdapterError | null = null;
    for (let i = 0; i < due.length; i += MAX_HISTORY_YEARS_PER_REQUEST) {
      const batch = due.slice(i, i + MAX_HISTORY_YEARS_PER_REQUEST);
      if (!upstreamBudget.take()) {
        failure = { platform: "github", kind: "rate_limited", message: "GitVis is busy right now. Please try again." };
        break;
      }
      const result = await fetchYears(username, batch);
      if (!result.ok) {
        failure = result.error;
        break;
      }
      const fetchedAt = new Date(now()).toISOString();
      for (const { year, days } of result.years) {
        fresh.set(year, days);
        try {
          await store.set(historyKey(username, year), { days, fetchedAt }, policyFor(year).ttlSeconds);
        } catch (error) {
          console.error("[gitvis] history write failed (serving fresh data anyway)", error);
        }
      }
    }

    const days: DailyCount[] = [];
    for (const year of years) {
      const yearDays = fresh.get(year) ?? cached.get(year)?.days;
      if (!yearDays) {
        return {
          ok: false,
          error: failure ?? { platform: "github", kind: "upstream", message: "Couldn't load GitHub history." },
        };
      }
      days.push(...yearDays.filter((d) => isWithinRange(d.date, range)));
    }
    if (failure) console.warn("[gitvis] history refresh failed; serving cached years", failure.kind);
    return { ok: true, days };
  }

  return function loadHistory(username: string, range: DateRange): Promise<HistoryOutcome> {
    const key = `${username.toLowerCase()}:${range.start}:${range.end}`;
    const pending = inFlight.get(key) ?? load(username, range);
    inFlight.set(key, pending);
    return pending.finally(() => inFlight.delete(key));
  };
}
