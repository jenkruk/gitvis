import "server-only";
import { type AdapterError, type AdapterResult, isTransientError } from "@/adapters/types";

/**
 * Explicit freshness policy for contribution data — independent of how the
 * underlying cache handler implements revalidation (see docs/ARCHITECTURE.md
 * "Freshness policy").
 *
 * Time is divided into fixed windows ("epochs") of `ttlMs` (default 12h). Data
 * is cached as one immutable snapshot per (platform, username, epoch):
 *
 * - The first request in a new epoch does a BLOCKING upstream fetch, so a
 *   graphic that hasn't been viewed for days still shows fresh data
 *   (max age = one epoch), with no reliance on background revalidation.
 * - If that fetch fails transiently, we look up snapshots from earlier epochs
 *   (lookup only — a past epoch never triggers a fetch) and serve the newest
 *   successful one, marked stale, as long as it is younger than `maxStaleMs`.
 * - Beyond `maxStaleMs` the failure is reported honestly instead.
 *
 * Cached functions never throw for expected outcomes: production builds
 * redact messages of errors thrown from "use cache" scopes, so outcomes are
 * returned as data (with short cache lifetimes for failures).
 */
export interface FreshnessPolicy {
  ttlMs: number;
  maxStaleMs: number;
}

const HOUR = 3_600_000;
export const DEFAULT_POLICY: FreshnessPolicy = { ttlMs: 12 * HOUR, maxStaleMs: 7 * 24 * HOUR };

/** Test/ops overrides via env (seconds). Invalid values fall back to defaults. */
export function policyFromEnv(env: Record<string, string | undefined> = process.env): FreshnessPolicy {
  const seconds = (value: string | undefined) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 ? n * 1000 : undefined;
  };
  const ttlMs = seconds(env.GITVIS_DATA_TTL_SECONDS) ?? DEFAULT_POLICY.ttlMs;
  const maxStaleMs = seconds(env.GITVIS_MAX_STALE_SECONDS) ?? DEFAULT_POLICY.maxStaleMs;
  return { ttlMs, maxStaleMs: Math.max(maxStaleMs, ttlMs) };
}

export function epochOf(nowMs: number, policy: FreshnessPolicy): number {
  return Math.floor(nowMs / policy.ttlMs);
}

export interface Snapshot {
  result: AdapterResult;
  /** ISO timestamp of the upstream fetch. */
  fetchedAt: string;
}

export type SnapshotOutcome =
  /** Data (or a stable answer such as not_found) fetched during that epoch. */
  | { kind: "snapshot"; snapshot: Snapshot }
  /** Nothing was stored for a past epoch (or the epoch rolled over mid-request). */
  | { kind: "missing" }
  /** The current epoch's fetch failed; cached only for seconds. */
  | { kind: "failed"; error: AdapterError };

/**
 * Reads the outcome for an epoch. For the current epoch it may fetch upstream;
 * for past epochs it only looks up.
 */
export type SnapshotReader = (epoch: number) => Promise<SnapshotOutcome>;

/** Failures where last-known-good data is preferable to an error. */
function allowsFallback(error: AdapterError): boolean {
  return isTransientError(error.kind) || error.kind === "not_configured";
}

/** Attaches freshness metadata to successful results. */
function withFreshness(snapshot: Snapshot, stale: boolean): AdapterResult {
  if (!snapshot.result.ok) return snapshot.result;
  return { ok: true, data: { ...snapshot.result.data, fetchedAt: snapshot.fetchedAt, ...(stale ? { stale } : {}) } };
}

export async function loadWithFreshness(
  read: SnapshotReader,
  recover: (error: unknown) => AdapterResult,
  policy: FreshnessPolicy,
  platform: AdapterError["platform"],
  now: () => number = Date.now,
): Promise<AdapterResult> {
  // Unexpected exceptions (bugs, cache-store outages) degrade to a generic failure.
  const safeRead = async (epoch: number): Promise<SnapshotOutcome> => {
    try {
      return await read(epoch);
    } catch (error) {
      const recovered = recover(error);
      return recovered.ok ? { kind: "missing" } : { kind: "failed", error: recovered.error };
    }
  };

  let epoch = epochOf(now(), policy);
  let outcome = await safeRead(epoch);
  if (outcome.kind === "missing") {
    // The epoch rolled over between computing the key and running the fetch: retry once.
    epoch = epochOf(now(), policy);
    outcome = await safeRead(epoch);
  }
  if (outcome.kind === "snapshot") return withFreshness(outcome.snapshot, false);

  const error: AdapterError =
    outcome.kind === "failed"
      ? outcome.error
      : { platform, kind: "upstream", message: "Couldn't load contributions right now. Please try again." };
  const failure: AdapterResult = { ok: false, error };
  if (!allowsFallback(error)) return failure;

  const oldestAllowed = now() - policy.maxStaleMs;
  for (let past = epoch - 1; past >= epochOf(oldestAllowed, policy); past--) {
    const previous = await safeRead(past);
    if (
      previous.kind === "snapshot" &&
      previous.snapshot.result.ok &&
      Date.parse(previous.snapshot.fetchedAt) >= oldestAllowed
    ) {
      return withFreshness(previous.snapshot, true);
    }
  }
  return failure;
}
