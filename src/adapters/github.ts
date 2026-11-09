import { normalizeDailyCounts } from "@/domain/combine";
import { type DailyCount, PLATFORMS } from "@/domain/types";
import { type AdapterError, type AdapterResult, displayUsername } from "./types";

export const GITHUB_CONTRIBUTIONS_QUERY = `
  query GitVisContributions(
    $login: String!
    $from: DateTime
    $to: DateTime
    $leadFrom: DateTime
    $leadTo: DateTime
    $hasLead: Boolean!
  ) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        ...GitVisCollection
      }
      lead: contributionsCollection(from: $leadFrom, to: $leadTo) @include(if: $hasLead) {
        ...GitVisCollection
      }
    }
  }

  fragment GitVisCollection on ContributionsCollection {
    restrictedContributionsCount
    contributionCalendar {
      totalContributions
      weeks {
        contributionDays {
          date
          contributionCount
        }
      }
    }
  }
`;

interface GitHubCollection {
  restrictedContributionsCount: number;
  contributionCalendar: {
    totalContributions: number;
    weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
  };
}

export interface GitHubContributionsResponse {
  data?: {
    user: {
      contributionsCollection: GitHubCollection;
      lead?: GitHubCollection | null;
    } | null;
  } | null;
  errors?: { type?: string; message: string }[];
}

export function normalizeGitHubContributions(username: string, response: GitHubContributionsResponse): AdapterResult {
  if (response.errors?.some((e) => e.type === "NOT_FOUND") || response.data?.user === null) {
    return {
      ok: false,
      error: { platform: "github", kind: "not_found", message: `No GitHub user named "${displayUsername(username)}".` },
    };
  }
  if (response.errors?.some((e) => e.type === "RATE_LIMITED")) {
    return {
      ok: false,
      error: { platform: "github", kind: "rate_limited", message: "GitHub rate limit reached. Try again shortly." },
    };
  }
  const collection = response.data?.user?.contributionsCollection;
  if (!collection) {
    return {
      ok: false,
      error: { platform: "github", kind: "invalid_response", message: "Unexpected response from GitHub." },
    };
  }

  const collections = [response.data?.user?.lead, collection].filter((c): c is GitHubCollection => !!c);
  const restricted = collections.reduce((n, c) => n + c.restrictedContributionsCount, 0);
  return {
    ok: true,
    data: {
      platform: "github",
      username,
      profileUrl: PLATFORMS.github.profileUrl(username),
      days: normalizeDailyCounts(
        collections.flatMap((c) =>
          c.contributionCalendar.weeks.flatMap((w) =>
            w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount })),
          ),
        ),
      ),
      reportedTotal: collections.reduce((n, c) => n + c.contributionCalendar.totalContributions, 0),
      privateCount: restricted > 0 ? restricted : undefined,
    },
  };
}

export const MAX_HISTORY_YEARS_PER_REQUEST = 4;

export function githubYearsQuery(count: number): string {
  const n = Math.max(1, Math.min(MAX_HISTORY_YEARS_PER_REQUEST, Math.floor(count)));
  const indexes = Array.from({ length: n }, (_, i) => i);
  const vars = indexes.map((i) => `$from${i}: DateTime!, $to${i}: DateTime!`).join(", ");
  const fields = indexes
    .map(
      (i) =>
        `y${i}: contributionsCollection(from: $from${i}, to: $to${i}) { contributionCalendar { weeks { contributionDays { date contributionCount } } } }`,
    )
    .join("\n      ");
  return `query GitVisHistory($login: String!, ${vars}) {\n    user(login: $login) {\n      ${fields}\n    }\n  }`;
}

export function githubYearsVariables(username: string, years: readonly number[]): Record<string, string> {
  const variables: Record<string, string> = { login: username };
  years.forEach((year, i) => {
    variables[`from${i}`] = `${year}-01-01T00:00:00Z`;
    variables[`to${i}`] = `${year}-12-31T23:59:59Z`;
  });
  return variables;
}

export interface GitHubYearsResponse {
  data?: {
    user: Record<
      string,
      { contributionCalendar: { weeks: { contributionDays: { date: string; contributionCount: number }[] }[] } } | null
    > | null;
  } | null;
  errors?: { type?: string; message: string }[];
}

export type HistoryResult =
  { ok: true; years: { year: number; days: DailyCount[] }[] } | { ok: false; error: AdapterError };

export function normalizeGitHubYears(
  username: string,
  years: readonly number[],
  response: GitHubYearsResponse,
): HistoryResult {
  if (response.errors?.some((e) => e.type === "NOT_FOUND") || response.data?.user === null) {
    return {
      ok: false,
      error: { platform: "github", kind: "not_found", message: `No GitHub user named "${displayUsername(username)}".` },
    };
  }
  if (response.errors?.some((e) => e.type === "RATE_LIMITED")) {
    return {
      ok: false,
      error: { platform: "github", kind: "rate_limited", message: "GitHub rate limit reached. Try again shortly." },
    };
  }
  const user = response.data?.user;
  const result: { year: number; days: DailyCount[] }[] = [];
  for (const [i, year] of years.entries()) {
    const calendar = user?.[`y${i}`]?.contributionCalendar;
    if (!calendar || !Array.isArray(calendar.weeks)) {
      return {
        ok: false,
        error: { platform: "github", kind: "invalid_response", message: "Unexpected response from GitHub." },
      };
    }
    const days = normalizeDailyCounts(
      calendar.weeks.flatMap((w) => w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount }))),
    ).filter((d) => d.date.startsWith(`${year}-`));
    result.push({ year, days });
  }
  return { ok: true, years: result };
}
