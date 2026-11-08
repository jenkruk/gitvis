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
  /** Kept short: the first view in a new freshness window waits on this fetch (image proxies time out). */
  timeoutMs?: number;
  /** Upstream endpoint override (tests only; see upstreamUrls in cached.ts). */
  url?: string;
}

type PostResult = { ok: true; body: unknown } | { ok: false; error: AdapterError };

const fail = (kind: AdapterError["kind"], message: string): PostResult => ({
  ok: false,
  error: { platform: "github", kind, message },
});

/** One GraphQL POST with the shared, user-safe error mapping. Variables only — never string interpolation. */
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
    // Operator problem, not the user's: log for us, keep the message generic.
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

/**
 * Fetches a user's contribution calendar. `token` needs no scopes: a
 * fine-grained PAT with public-repository read access is sufficient.
 * `range` may exceed a year by up to a week (GitHub's "last year" starts on a
 * Sunday): GitHub's calendar returns at most 365 days, so the earliest days are
 * fetched as a second collection in the same request.
 */
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

/**
 * Fetches complete calendar years of history in ONE request (aliased
 * contributionsCollection per year; GitHub limits each collection to a year).
 */
export async function fetchGitHubYears(
  username: string,
  years: readonly number[],
  token: string | undefined,
  options: FetchOptions = {},
): Promise<HistoryResult> {
  const result = await postGraphQL(
    githubYearsQuery(years.length),
    githubYearsVariables(username, years),
    token,
    // History is never on the critical path of a cached card, but keep it bounded.
    { timeoutMs: 8_000, ...options },
  );
  if (!result.ok) return result;
  return normalizeGitHubYears(username, years, result.body as GitHubYearsResponse);
}
