import "server-only";
import type { ConnectRequest, ContributionsResponse, PlatformResult } from "@/adapters/connect";
import { type AdapterResult, isTransientError } from "@/adapters/types";
import { combineSources } from "@/domain/combine";
import { type DateRange, diffDays, type ISODate, isWithinRange, trailingYear } from "@/domain/dates";
import { PLATFORM_IDS, type PlatformContributions } from "@/domain/types";

export interface ContributionLoaders {
  github: (username: string, range: DateRange) => Promise<AdapterResult>;
  gitlab: (username: string) => Promise<AdapterResult>;
  /** Today's date in UTC. Injected for deterministic tests. */
  today: () => ISODate;
}

/**
 * Loads every requested platform independently (one failing never blocks the
 * other) and combines the successes into a `live` dataset.
 */
export async function loadContributions(
  request: ConnectRequest,
  loaders: ContributionLoaders,
): Promise<ContributionsResponse> {
  const today = loaders.today();
  const queryRange = trailingYear(today);

  const requested = PLATFORM_IDS.flatMap((platform) => {
    const username = request[platform];
    return username ? [{ platform, username }] : [];
  });
  const outcomes = await Promise.all(
    requested.map(({ platform, username }) =>
      platform === "github" ? loaders.github(username, queryRange) : loaders.gitlab(username),
    ),
  );

  const sources = outcomes.flatMap((o) => (o.ok ? [o.data] : []));
  const range = trailingYear(resolveEndDate(today, sources));
  const dataset = sources.length > 0 ? combineSources(sources, range, "live") : null;

  const results: PlatformResult[] = outcomes.map((outcome, i) => {
    const { platform, username } = requested[i]!;
    if (!outcome.ok) {
      const { kind, message } = outcome.error;
      return { platform, username, status: kind, message, retryable: isTransientError(kind) };
    }
    const total = outcome.data.days.reduce((sum, d) => (isWithinRange(d.date, range) ? sum + d.count : sum), 0);
    return { platform, username, status: "ok", total, privateCount: outcome.data.privateCount };
  });

  return { dataset, results };
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
