import "server-only";
import type { ConnectRequest, ContributionsResponse, HistoryStatus, PlatformResult } from "@/adapters/connect";
import { type AdapterResult, isTransientError } from "@/adapters/types";
import { combineSources } from "@/domain/combine";
import { type DateRange, diffDays, type ISODate, isWithinRange } from "@/domain/dates";
import { historyRange, newestPeriod, platformYear } from "@/domain/history";
import type { HistoryOutcome } from "./history";
import { type ContributionDataset, PLATFORM_IDS, type PlatformContributions } from "@/domain/types";

export interface ContributionLoaders {
  /** Each loader returns the platform's own year (see `platformYear`) as of its (possibly cached) fetch. */
  github: (username: string) => Promise<AdapterResult>;
  gitlab: (username: string) => Promise<AdapterResult>;
  /** Today's date in UTC. Injected for deterministic tests. */
  today: () => ISODate;
  /** Earlier GitHub days (complete-year cache). Absent → multi-year requests stay at 12 months. */
  githubHistory?: (username: string, range: DateRange) => Promise<HistoryOutcome>;
}

export interface LoadOptions {
  /** 12-month periods wanted (1–3). Only GitHub can supply more than one. */
  years?: number;
}

/**
 * Loads every requested platform independently (one failing never blocks the
 * other) and combines the successes into a `live` dataset.
 */
export async function loadContributions(
  request: ConnectRequest,
  loaders: ContributionLoaders,
  { years = 1 }: LoadOptions = {},
): Promise<ContributionsResponse> {
  const today = loaders.today();
  // History is fetched in parallel with the trailing year: image proxies are latency-sensitive.
  // The range is anchored on today; the rare one-day timezone extension is trimmed below.
  const wantsHistory = years > 1 && !!request.github && !!loaders.githubHistory;
  const githubYear = platformYear("github", today);
  const pendingHistory = wantsHistory
    ? loaders.githubHistory!(request.github!, {
        start: historyRange(githubYear, years).start,
        // Inclusive of the newest year's first day: if the end shifts a day for timezones, no day is left uncovered.
        end: githubYear.start,
      })
    : null;

  const requested = PLATFORM_IDS.flatMap((platform) => {
    const username = request[platform];
    return username ? [{ platform, username }] : [];
  });
  const outcomes = await Promise.all(
    requested.map(({ platform, username }) =>
      platform === "github" ? loaders.github(username) : loaders.gitlab(username),
    ),
  );

  const end = resolveEndDate(
    today,
    outcomes.flatMap((o) => (o.ok ? [o.data] : [])),
  );
  // Each platform covers its own published year, so its numbers match its profile: GitHub's
  // starts on a Sunday, a few days before GitLab's. Earlier days are unknown for GitLab.
  let sources = outcomes.flatMap((o) => (o.ok ? [{ ...o.data, coverage: platformYear(o.data.platform, end) }] : []));
  const range = newestPeriod(
    sources.map((s) => s.platform),
    end,
  );
  let datasetRange = range;
  let history: HistoryStatus | undefined;

  if (pendingHistory) {
    const outcome = await pendingHistory;
    const github = sources.find((s) => s.platform === "github");
    if (!outcome.ok) {
      const { kind, message } = outcome.error;
      history = { years, status: kind, message, retryable: isTransientError(kind) };
    } else if (github) {
      history = { years, status: "ok" };
      datasetRange = historyRange(range, years);
      const earlier = outcome.days.filter((d) => d.date >= datasetRange.start && d.date < range.start);
      // GitHub covers the whole span; GitLab publishes only its last 12 months — beyond that it's unknown.
      sources = sources.map((s) =>
        s.platform === "github" ? { ...s, days: [...earlier, ...s.days], coverage: datasetRange } : s,
      );
    }
  }

  const dataset =
    sources.length > 0 ? { ...combineSources(sources, datasetRange, "live"), ...freshnessOf(sources) } : null;

  const results: PlatformResult[] = outcomes.map((outcome, i) => {
    const { platform, username } = requested[i]!;
    if (!outcome.ok) {
      const { kind, message } = outcome.error;
      return { platform, username, status: kind, message, retryable: isTransientError(kind) };
    }
    // The platform's own yearly total, as its profile shows it.
    const own = platformYear(platform, end);
    const total = outcome.data.days.reduce((sum, d) => (isWithinRange(d.date, own) ? sum + d.count : sum), 0);
    const { privateCount, stale, fetchedAt } = outcome.data;
    return { platform, username, status: "ok", total, privateCount, stale, fetchedAt };
  });

  return history ? { dataset, results, history } : { dataset, results };
}

/** Dataset freshness = its oldest source; stale if any source is last-known-good. */
function freshnessOf(sources: PlatformContributions[]): Pick<ContributionDataset, "freshness"> {
  const times = sources.flatMap((s) => s.fetchedAt ?? []).sort();
  if (times.length === 0) return {};
  return { freshness: { asOf: times[0]!, stale: sources.some((s) => s.stale === true) } };
}

/**
 * Platforms bucket days in their own timezones, so users east of UTC can have
 * activity dated "tomorrow" relative to UTC. Extend by that one day rather
 * than silently dropping it; ignore anything further out.
 */
function resolveEndDate(today: ISODate, sources: PlatformContributions[]): ISODate {
  const latest = sources
    .flatMap((s) => s.days.at(-1)?.date ?? [])
    .sort()
    .at(-1);
  return latest && latest > today && diffDays(today, latest) === 1 ? latest : today;
}
