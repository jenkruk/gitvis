import "server-only";
import { cacheLife } from "next/cache";
import { type AdapterError, adapterError, type AdapterResult, isTransientError } from "@/adapters/types";
import { todayInTimeZone, trailingYear } from "@/domain/dates";
import type { PlatformId } from "@/domain/types";
import type { ContributionLoaders } from "./contributions";
import { fetchGitHubContributions } from "./github";
import { fetchGitLabContributions } from "./gitlab";
import { upstreamBudget } from "./rate-limit";

/*
 * One remote cache entry per platform + username, shared by the studio and
 * every embed. "use cache: remote" because serverless instances don't share
 * memory and both upstreams are rate-limited.
 *
 * - Data refreshes every 12h (target: README images update once or twice a day).
 * - Stale data is served while refreshing; entries expire after 7 days.
 * - Transient failures THROW so they are never cached: a failed background
 *   refresh keeps serving the last good data instead of an error.
 * - Not-found answers are cached for an hour so new/renamed accounts recover.
 */
const CONTRIBUTIONS_PROFILE = { stale: 3_600, revalidate: 43_200, expire: 604_800 };
const MARKER = "gitvis-uncacheable:";

function isUncacheable(error: AdapterError): boolean {
  return isTransientError(error.kind) || error.kind === "not_configured";
}

function uncacheable(error: AdapterError): Error {
  return new Error(MARKER + JSON.stringify(error));
}

function busy(platform: PlatformId): AdapterError {
  return { platform, kind: "rate_limited", message: "GitVis is busy right now. Please try again in a minute." };
}

async function cachedGitHub(username: string): Promise<AdapterResult> {
  "use cache: remote";
  if (!upstreamBudget.take()) throw uncacheable(busy("github"));
  // Range computed inside the cache scope so the key is the username alone (no daily rollover).
  const range = trailingYear(todayInTimeZone("UTC"));
  const result = await fetchGitHubContributions(username, range, process.env.GITHUB_TOKEN);
  if (!result.ok && isUncacheable(result.error)) throw uncacheable(result.error);
  if (result.ok) cacheLife(CONTRIBUTIONS_PROFILE);
  else cacheLife("hours");
  return result;
}

async function cachedGitLab(username: string): Promise<AdapterResult> {
  "use cache: remote";
  if (!upstreamBudget.take()) throw uncacheable(busy("gitlab"));
  const result = await fetchGitLabContributions(username);
  if (!result.ok && isUncacheable(result.error)) throw uncacheable(result.error);
  if (result.ok) cacheLife(CONTRIBUTIONS_PROFILE);
  else cacheLife("hours");
  return result;
}

/** Turns a thrown (uncached) failure back into a result; anything unexpected becomes a generic error. */
export function recoverLoaderError(platform: PlatformId, error: unknown): AdapterResult {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith(MARKER)) {
    try {
      const parsed = JSON.parse(message.slice(MARKER.length)) as AdapterError;
      return { ok: false, error: parsed };
    } catch {
      // fall through to the generic error
    }
  }
  console.error(`[gitvis] unexpected ${platform} loader failure`, error);
  return adapterError(platform, "upstream", "Couldn't load contributions right now. Please try again.");
}

export const serverLoaders: ContributionLoaders = {
  github: (username) => cachedGitHub(username).catch((e: unknown) => recoverLoaderError("github", e)),
  gitlab: (username) => cachedGitLab(username).catch((e: unknown) => recoverLoaderError("gitlab", e)),
  today: () => todayInTimeZone("UTC"),
};
