import "server-only";
import { cacheLife } from "next/cache";
import { GITLAB_ORIGIN } from "@/adapters/gitlab";
import { type AdapterError, adapterError, type AdapterResult, isTransientError } from "@/adapters/types";
import { todayInTimeZone, trailingYear } from "@/domain/dates";
import type { PlatformId } from "@/domain/types";
import type { ContributionLoaders } from "./contributions";
import { epochOf, type FreshnessPolicy, loadWithFreshness, policyFromEnv, type SnapshotOutcome } from "./freshness";
import { fetchGitHubContributions, GITHUB_GRAPHQL_URL } from "./github";
import { fetchGitLabContributions } from "./gitlab";
import { upstreamBudget } from "./rate-limit";

/*
 * Snapshot cache: one immutable entry per (platform, username, epoch), stored
 * with "use cache: remote" so all instances share it where the platform
 * provides a shared remote handler. The freshness / last-known-good policy is
 * in ./freshness.ts and does NOT rely on the handler's revalidation semantics:
 * entries are only ever created and expired, never refreshed in place.
 */

/** Failed fetches are cached for seconds only, so the next request retries upstream. */
const FAILURE_LIFE = { stale: 0, revalidate: 1, expire: 2 };

/** Snapshots (and "nothing stored" answers for past epochs) live until data is too old to serve. */
function snapshotLife(policy: FreshnessPolicy) {
  const seconds = Math.ceil(policy.maxStaleMs / 1000);
  return { stale: 60, revalidate: seconds, expire: seconds + Math.ceil(policy.ttlMs / 1000) };
}

function isUncacheable(error: AdapterError): boolean {
  return isTransientError(error.kind) || error.kind === "not_configured";
}

/** Upstream endpoints. Overrides exist only so E2E tests can point at a local fake upstream. */
function upstreamUrls() {
  const override = (value: string | undefined) => (value && /^https?:\/\//.test(value) ? value : undefined);
  return {
    github: override(process.env.GITVIS_GITHUB_GRAPHQL_URL) ?? GITHUB_GRAPHQL_URL,
    gitlab: override(process.env.GITVIS_GITLAB_ORIGIN) ?? GITLAB_ORIGIN,
  };
}

async function snapshot(platform: PlatformId, username: string, epoch: number): Promise<SnapshotOutcome> {
  "use cache: remote";
  const policy = policyFromEnv();

  // Past epochs are lookup-only: fetching now would mislabel new data as old. A past epoch
  // can never gain a snapshot later, so caching "missing" is safe and makes fallback scans cheap.
  if (epoch !== epochOf(Date.now(), policy)) {
    cacheLife(snapshotLife(policy));
    return { kind: "missing" };
  }

  if (!upstreamBudget.take()) {
    cacheLife(FAILURE_LIFE);
    return {
      kind: "failed",
      error: { platform, kind: "rate_limited", message: "GitVis is busy right now. Please try again in a minute." },
    };
  }

  const urls = upstreamUrls();
  const result =
    platform === "github"
      ? await fetchGitHubContributions(username, trailingYear(todayInTimeZone("UTC")), process.env.GITHUB_TOKEN, {
          url: urls.github,
        })
      : await fetchGitLabContributions(username, { url: urls.gitlab });

  if (!result.ok && isUncacheable(result.error)) {
    cacheLife(FAILURE_LIFE);
    return { kind: "failed", error: result.error };
  }
  cacheLife(snapshotLife(policy));
  return { kind: "snapshot", snapshot: { result, fetchedAt: new Date().toISOString() } };
}

/** Unexpected exceptions (bugs, cache-store outages) become a generic, user-safe error. */
export function recoverLoaderError(platform: PlatformId, error: unknown): AdapterResult {
  console.error(`[gitvis] unexpected ${platform} loader failure`, error);
  return adapterError(platform, "upstream", "Couldn't load contributions right now. Please try again.");
}

function load(platform: PlatformId, username: string): Promise<AdapterResult> {
  return loadWithFreshness(
    (epoch) => snapshot(platform, username, epoch),
    (error) => recoverLoaderError(platform, error),
    policyFromEnv(),
    platform,
  );
}

export const serverLoaders: ContributionLoaders = {
  github: (username) => load("github", username),
  gitlab: (username) => load("gitlab", username),
  today: () => todayInTimeZone("UTC"),
};
