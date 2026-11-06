import "server-only";
import {
  GITHUB_CONTRIBUTIONS_QUERY,
  type GitHubContributionsResponse,
  normalizeGitHubContributions,
} from "@/adapters/github";
import { adapterError, type AdapterResult } from "@/adapters/types";
import type { DateRange } from "@/domain/dates";

export const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

export interface FetchOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Fetches a user's contribution calendar. `token` needs no scopes: a
 * fine-grained PAT with public-repository read access is sufficient.
 * `range` must span at most one year (GitHub API limit).
 */
export async function fetchGitHubContributions(
  username: string,
  range: DateRange,
  token: string | undefined,
  { fetchImpl = fetch, timeoutMs = 8_000 }: FetchOptions = {},
): Promise<AdapterResult> {
  if (!token) return adapterError("github", "not_configured", "GitHub lookups aren't set up on this server yet.");

  let response: Response;
  try {
    response = await fetchImpl(GITHUB_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "GitVis",
      },
      body: JSON.stringify({
        query: GITHUB_CONTRIBUTIONS_QUERY,
        variables: { login: username, from: `${range.start}T00:00:00Z`, to: `${range.end}T23:59:59Z` },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return adapterError("github", "upstream", "Couldn't reach GitHub. Please try again.");
  }

  if (response.status === 401) {
    // Operator problem, not the user's: log for us, keep the message generic.
    console.error("[gitvis] GitHub rejected GITHUB_TOKEN (401). Check that it is valid and not expired.");
    return adapterError("github", "not_configured", "GitHub lookups are temporarily unavailable.");
  }
  if (response.status === 403 || response.status === 429) {
    return adapterError("github", "rate_limited", "GitHub is rate-limiting requests. Try again in a minute.");
  }
  if (!response.ok) {
    return adapterError("github", "upstream", `GitHub responded with an error (${response.status}). Please try again.`);
  }

  let body: GitHubContributionsResponse;
  try {
    body = (await response.json()) as GitHubContributionsResponse;
  } catch {
    return adapterError("github", "invalid_response", "Unexpected response from GitHub. Please try again.");
  }
  return normalizeGitHubContributions(username, body);
}
