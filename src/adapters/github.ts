import { normalizeDailyCounts } from "@/domain/combine";
import { PLATFORMS } from "@/domain/types";
import { type AdapterResult, displayUsername } from "./types";

/**
 * Requires a server-side token (GitHub GraphQL rejects anonymous requests).
 * A fine-grained PAT with public read-only access and no extra permissions is
 * sufficient. Always pass the username as a variable, never by interpolation.
 */
export const GITHUB_CONTRIBUTIONS_QUERY = /* GraphQL */ `
  query GitVisContributions($login: String!, $from: DateTime, $to: DateTime) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
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
    }
  }
`;

export interface GitHubContributionsResponse {
  data?: {
    user: {
      contributionsCollection: {
        restrictedContributionsCount: number;
        contributionCalendar: {
          totalContributions: number;
          weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
        };
      };
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

  const { contributionCalendar: calendar, restrictedContributionsCount } = collection;
  return {
    ok: true,
    data: {
      platform: "github",
      username,
      profileUrl: PLATFORMS.github.profileUrl(username),
      days: normalizeDailyCounts(
        calendar.weeks.flatMap((w) => w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount }))),
      ),
      reportedTotal: calendar.totalContributions,
      // 0 is ambiguous (none, or the user hasn't opted in); only surface a positive count.
      privateCount: restrictedContributionsCount > 0 ? restrictedContributionsCount : undefined,
    },
  };
}
