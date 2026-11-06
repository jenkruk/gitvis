import "server-only";
import { cacheLife } from "next/cache";
import { isTransientError } from "@/adapters/types";
import { todayInTimeZone, toISODate } from "@/domain/dates";
import type { ContributionLoaders } from "./contributions";
import { fetchGitHubContributions } from "./github";
import { fetchGitLabContributions } from "./gitlab";

/*
 * Remote ("use cache: remote") because serverless instances don't share
 * in-memory caches and both upstreams are rate-limited. Stable answers
 * (data, not found) live for hours; transient failures for seconds so a
 * Retry can succeed. Arguments are the cache key.
 */

async function cachedGitHub(username: string, start: string, end: string) {
  "use cache: remote";
  const range = { start: toISODate(start), end: toISODate(end) };
  const result = await fetchGitHubContributions(username, range, process.env.GITHUB_TOKEN);
  // "not_configured" is short-lived too, so adding a token takes effect promptly.
  if (!result.ok && (isTransientError(result.error.kind) || result.error.kind === "not_configured")) {
    cacheLife("seconds");
  } else {
    cacheLife("hours");
  }
  return result;
}

async function cachedGitLab(username: string) {
  "use cache: remote";
  const result = await fetchGitLabContributions(username);
  if (!result.ok && isTransientError(result.error.kind)) cacheLife("seconds");
  else cacheLife("hours");
  return result;
}

export const serverLoaders: ContributionLoaders = {
  github: (username, range) => cachedGitHub(username, range.start, range.end),
  gitlab: (username) => cachedGitLab(username),
  today: () => todayInTimeZone("UTC"),
};
