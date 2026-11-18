import "server-only";
import { getCache } from "@vercel/functions";
import { after } from "next/server";
import { GITLAB_ORIGIN } from "@/adapters/gitlab";
import { type AdapterError, adapterError, type AdapterResult, isTransientError } from "@/adapters/types";
import { todayInTimeZone } from "@/domain/dates";
import { platformYear } from "@/domain/history";
import type { PlatformId } from "@/domain/types";
import type { ContributionLoaders } from "./contributions";
import {
  epochOf,
  type FreshnessPolicy,
  livePolicy,
  loadWithFreshness,
  type Snapshot,
  type SnapshotOutcome,
} from "./freshness";
import { fetchGitHubContributions, fetchGitHubYears, GITHUB_GRAPHQL_URL } from "./github";
import { createHistoryLoader } from "./history";
import { fetchGitLabContributions } from "./gitlab";
import { upstreamBudget } from "./rate-limit";

export const SNAPSHOT_SCHEMA = 2;

export const NOT_FOUND_TTL_SECONDS = 3_600;

export interface SnapshotStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
}

export type Fetcher = (platform: PlatformId, username: string) => Promise<AdapterResult>;

export function snapshotKey(platform: PlatformId, username: string, epoch: number): string {
  return `v${SNAPSHOT_SCHEMA}:${platform}:${username}:${epoch}`;
}

function asSnapshot(value: unknown): Snapshot | null {
  if (!value || typeof value !== "object") return null;
  const { result, fetchedAt } = value as Partial<Snapshot>;
  if (typeof fetchedAt !== "string" || Number.isNaN(Date.parse(fetchedAt))) return null;
  if (!result || typeof result !== "object" || typeof (result as AdapterResult).ok !== "boolean") return null;
  return value as Snapshot;
}

function isUncacheable(error: AdapterError): boolean {
  return isTransientError(error.kind) || error.kind === "not_configured";
}

function snapshotTtlSeconds(policy: FreshnessPolicy): number {
  return Math.ceil((policy.maxStaleMs + policy.ttlMs) / 1000);
}

export type Schedule = (task: () => Promise<void>) => void;

export interface LoaderDeps {
  store: SnapshotStore;
  fetcher: Fetcher;
  policy: () => FreshnessPolicy;
  now?: () => number;
  schedule?: Schedule;
}

export function createLoaders({ store, fetcher, policy, now = Date.now, schedule }: LoaderDeps): ContributionLoaders {
  const inFlight = new Map<string, Promise<SnapshotOutcome>>();
  const refreshing = new Set<string>();

  async function fetchAndStore(platform: PlatformId, username: string, key: string): Promise<SnapshotOutcome> {
    if (!upstreamBudget.take()) {
      return {
        kind: "failed",
        error: { platform, kind: "rate_limited", message: "GitVis is busy right now. Please try again in a minute." },
      };
    }
    const result = await fetcher(platform, username);
    if (!result.ok && isUncacheable(result.error)) return { kind: "failed", error: result.error };

    const snapshot: Snapshot = { result, fetchedAt: new Date(now()).toISOString() };
    const ttl = result.ok ? snapshotTtlSeconds(policy()) : NOT_FOUND_TTL_SECONDS;
    try {
      await store.set(key, snapshot, ttl);
    } catch (error) {
      console.error("[gitvis] snapshot write failed (serving fresh data anyway)", error);
    }
    return { kind: "snapshot", snapshot };
  }

  async function stored(key: string): Promise<SnapshotOutcome> {
    let snapshot: Snapshot | null = null;
    try {
      snapshot = asSnapshot(await store.get(key));
    } catch (error) {
      console.error("[gitvis] snapshot read failed (treating as a miss)", error);
    }
    return snapshot ? { kind: "snapshot", snapshot } : { kind: "missing" };
  }

  async function fetch(platform: PlatformId, username: string, epoch: number): Promise<SnapshotOutcome> {
    const key = snapshotKey(platform, username, epoch);
    const hit = await stored(key);
    if (hit.kind === "snapshot" || epoch !== epochOf(now(), policy())) return hit;

    const pending = inFlight.get(key) ?? fetchAndStore(platform, username, key);
    inFlight.set(key, pending);
    try {
      return await pending;
    } finally {
      inFlight.delete(key);
    }
  }

  function refreshLater(platform: PlatformId, username: string, epoch: number): boolean {
    if (!schedule) return false;
    const key = snapshotKey(platform, username, epoch);
    if (refreshing.has(key)) return true;
    refreshing.add(key);
    try {
      schedule(async () => {
        try {
          const outcome = await fetch(platform, username, epoch);
          if (outcome.kind === "failed")
            console.warn(`[gitvis] background ${platform} refresh failed`, outcome.error.kind);
        } catch (error) {
          console.error(`[gitvis] background ${platform} refresh failed`, error);
        } finally {
          refreshing.delete(key);
        }
      });
      return true;
    } catch (error) {
      refreshing.delete(key);
      console.error("[gitvis] couldn't schedule a background refresh (fetching now)", error);
      return false;
    }
  }

  const load = (platform: PlatformId, username: string) =>
    loadWithFreshness(
      {
        stored: (epoch) => stored(snapshotKey(platform, username, epoch)),
        fetch: (epoch) => fetch(platform, username, epoch),
        ...(schedule ? { refreshLater: (epoch: number) => refreshLater(platform, username, epoch) } : {}),
      },
      (error) => recoverLoaderError(platform, error),
      policy(),
      platform,
      now,
    );

  return {
    github: (username) => load("github", username),
    gitlab: (username) => load("gitlab", username),
    today: () => todayInTimeZone("UTC", new Date(now())),
  };
}

export function recoverLoaderError(platform: PlatformId, error: unknown): AdapterResult {
  console.error(`[gitvis] unexpected ${platform} loader failure`, error);
  return adapterError(platform, "upstream", "Couldn't load contributions right now. Please try again.");
}

export function testOverridesAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV !== "production";
}

export function upstreamUrls() {
  const allowed = testOverridesAllowed();
  const override = (value: string | undefined) => (allowed && value && /^https?:\/\//.test(value) ? value : undefined);
  return {
    github: override(process.env.GITVIS_GITHUB_GRAPHQL_URL) ?? GITHUB_GRAPHQL_URL,
    gitlab: override(process.env.GITVIS_GITLAB_ORIGIN) ?? GITLAB_ORIGIN,
  };
}

const liveFetcher: Fetcher = (platform, username) => {
  const urls = upstreamUrls();
  return platform === "github"
    ? fetchGitHubContributions(username, platformYear("github", todayInTimeZone("UTC")), process.env.GITHUB_TOKEN, {
        url: urls.github,
      })
    : fetchGitLabContributions(username, { url: urls.gitlab });
};

let runtimeStore: SnapshotStore | undefined;
export function vercelRuntimeStore(): SnapshotStore {
  if (!runtimeStore) {
    const cache = getCache({ namespace: "gitvis" });
    runtimeStore = {
      get: (key) => cache.get(key),
      set: (key, value, ttl) => cache.set(key, value, { ttl, name: key.split(":")[1] ?? "gitvis" }),
    };
  }
  return runtimeStore;
}

const sharedStore: SnapshotStore = {
  get: (key) => vercelRuntimeStore().get(key),
  set: (key, value, ttl) => vercelRuntimeStore().set(key, value, ttl),
};

function liveLoaders(schedule?: Schedule): ContributionLoaders {
  return {
    ...createLoaders({
      store: sharedStore,
      fetcher: liveFetcher,
      policy: () => livePolicy(),
      schedule,
    }),
    githubHistory: createHistoryLoader({
      store: sharedStore,
      fetchYears: (username, years) =>
        fetchGitHubYears(username, years, process.env.GITHUB_TOKEN, { url: upstreamUrls().github }),
      schedule,
    }),
  };
}

export const serverLoaders: ContributionLoaders = liveLoaders();

export const cardLoaders: ContributionLoaders = liveLoaders(after);
