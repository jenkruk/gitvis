import "server-only";
import {
  GITHUB_CONTRIBUTIONS_QUERY,
  type GitHubContributionsResponse,
  type GitHubYearsResponse,
  githubYearsQuery,
  githubYearsVariables,
  type HistoryResult,
  normalizeGitHubContributions,
  normalizeGitHubYears,
} from "@/adapters/github";
import { type AdapterError, adapterError, type AdapterResult } from "@/adapters/types";
import { addDays, type DateRange } from "@/domain/dates";

export const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

export interface FetchOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  url?: string;
}

type PostResult = { ok: true; body: unknown } | { ok: false; error: AdapterError };

const fail = (kind: AdapterError["kind"], message: string): PostResult => ({
  ok: false,
  error: { platform: "github", kind, message },
});

async function postGraphQL(
  query: string,
  variables: Record<string, string | boolean>,
  token: string | undefined,
  { fetchImpl = fetch, timeoutMs = 5_000, url = GITHUB_GRAPHQL_URL }: FetchOptions,
): Promise<PostResult> {
  if (!token) return fail("not_configured", "GitHub lookups aren't set up on this server yet.");

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "GitVis" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return fail("upstream", "Couldn't reach GitHub. Please try again.");
  }

  if (response.status === 401) {
    console.error("[gitvis] GitHub rejected GITHUB_TOKEN (401). Check that it is valid and not expired.");
    return fail("not_configured", "GitHub lookups are temporarily unavailable.");
  }
  if (response.status === 403 || response.status === 429) {
    return fail("rate_limited", "GitHub is rate-limiting requests. Try again in a minute.");
  }
  if (!response.ok) return fail("upstream", `GitHub responded with an error (${response.status}). Please try again.`);

  try {
    return { ok: true, body: await response.json() };
  } catch {
    return fail("invalid_response", "Unexpected response from GitHub. Please try again.");
  }
}

export async function fetchGitHubContributions(
  username: string,
  range: DateRange,
  token: string | undefined,
  options: FetchOptions = {},
): Promise<AdapterResult> {
  const yearStart = addDays(range.end, -364);
  const mainStart = range.start > yearStart ? range.start : yearStart;
  const hasLead = range.start < mainStart;
  const result = await postGraphQL(
    GITHUB_CONTRIBUTIONS_QUERY,
    {
      login: username,
      from: `${mainStart}T00:00:00Z`,
      to: `${range.end}T23:59:59Z`,
      leadFrom: `${range.start}T00:00:00Z`,
      leadTo: `${addDays(mainStart, -1)}T23:59:59Z`,
      hasLead,
    },
    token,
    options,
  );
  if (!result.ok) return adapterError("github", result.error.kind, result.error.message);
  return normalizeGitHubContributions(username, result.body as GitHubContributionsResponse);
}

export async function fetchGitHubYears(
  username: string,
  years: readonly number[],
  token: string | undefined,
  options: FetchOptions = {},
): Promise<HistoryResult> {
  const result = await postGraphQL(githubYearsQuery(years.length), githubYearsVariables(username, years), token, {
    timeoutMs: 8_000,
    ...options,
  });
  if (!result.ok) return result;
  return normalizeGitHubYears(username, years, result.body as GitHubYearsResponse);
}
