import "server-only";
import type { ConnectRequest, ContributionsResponse, HistoryStatus, PlatformResult } from "@/adapters/connect";
import { type AdapterResult, isTransientError } from "@/adapters/types";
import { combineSources } from "@/domain/combine";
import { type DateRange, diffDays, type ISODate, isWithinRange } from "@/domain/dates";
import { historyRange, newestPeriod, platformYear } from "@/domain/history";
import type { HistoryOutcome } from "./history";
import { type ContributionDataset, PLATFORM_IDS, type PlatformContributions } from "@/domain/types";

export interface ContributionLoaders {
  github: (username: string) => Promise<AdapterResult>;
  gitlab: (username: string) => Promise<AdapterResult>;
  today: () => ISODate;
  githubHistory?: (username: string, range: DateRange) => Promise<HistoryOutcome>;
}

export interface LoadOptions {
  years?: number;
}

export async function loadContributions(
  request: ConnectRequest,
  loaders: ContributionLoaders,
  { years = 1 }: LoadOptions = {},
): Promise<ContributionsResponse> {
  const today = loaders.today();
  const wantsHistory = years > 1 && !!request.github && !!loaders.githubHistory;
  const githubYear = platformYear("github", today);
  const pendingHistory = wantsHistory
    ? loaders.githubHistory!(request.github!, {
        start: historyRange(githubYear, years).start,
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
    const own = platformYear(platform, end);
    const total = outcome.data.days.reduce((sum, d) => (isWithinRange(d.date, own) ? sum + d.count : sum), 0);
    const { privateCount, stale, fetchedAt } = outcome.data;
    return { platform, username, status: "ok", total, privateCount, stale, fetchedAt };
  });

  return history ? { dataset, results, history } : { dataset, results };
}

function freshnessOf(sources: PlatformContributions[]): Pick<ContributionDataset, "freshness"> {
  const times = sources.flatMap((s) => s.fetchedAt ?? []).sort();
  if (times.length === 0) return {};
  return { freshness: { asOf: times[0]!, stale: sources.some((s) => s.stale === true) } };
}

function resolveEndDate(today: ISODate, sources: PlatformContributions[]): ISODate {
  const latest = sources
    .flatMap((s) => s.days.at(-1)?.date ?? [])
    .sort()
    .at(-1);
  return latest && latest > today && diffDays(today, latest) === 1 ? latest : today;
}
