import "server-only";
import { type AdapterError, type AdapterResult, isTransientError } from "@/adapters/types";

export interface FreshnessPolicy {
  ttlMs: number;
  maxStaleMs: number;
}

const HOUR = 3_600_000;
export const DEFAULT_POLICY: FreshnessPolicy = { ttlMs: 12 * HOUR, maxStaleMs: 7 * 24 * HOUR };

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
  fetchedAt: string;
}

export type SnapshotOutcome =
  { kind: "snapshot"; snapshot: Snapshot } | { kind: "missing" } | { kind: "failed"; error: AdapterError };

export interface SnapshotSource {
  stored: (epoch: number) => Promise<SnapshotOutcome>;
  fetch: (epoch: number) => Promise<SnapshotOutcome>;
  refreshLater?: (epoch: number) => boolean;
}

function allowsFallback(error: AdapterError): boolean {
  return isTransientError(error.kind) || error.kind === "not_configured";
}

function withFreshness(snapshot: Snapshot, stale: boolean): AdapterResult {
  if (!snapshot.result.ok) return snapshot.result;
  return { ok: true, data: { ...snapshot.result.data, fetchedAt: snapshot.fetchedAt, ...(stale ? { stale } : {}) } };
}

export async function loadWithFreshness(
  source: SnapshotSource,
  recover: (error: unknown) => AdapterResult,
  policy: FreshnessPolicy,
  platform: AdapterError["platform"],
  now: () => number = Date.now,
): Promise<AdapterResult> {
  const safely = async (attempt: () => Promise<SnapshotOutcome>): Promise<SnapshotOutcome> => {
    try {
      return await attempt();
    } catch (error) {
      const recovered = recover(error);
      return recovered.ok ? { kind: "missing" } : { kind: "failed", error: recovered.error };
    }
  };

  const lastKnownGood = async (current: number): Promise<Snapshot | null> => {
    const oldestAllowed = now() - policy.maxStaleMs;
    const epochs: number[] = [];
    for (let past = current - 1; past >= epochOf(oldestAllowed, policy); past--) epochs.push(past);
    const outcomes = await Promise.all(epochs.map((epoch) => safely(() => source.stored(epoch))));
    for (const outcome of outcomes) {
      if (
        outcome.kind === "snapshot" &&
        outcome.snapshot.result.ok &&
        Date.parse(outcome.snapshot.fetchedAt) >= oldestAllowed
      ) {
        return outcome.snapshot;
      }
    }
    return null;
  };

  let epoch = epochOf(now(), policy);
  const stored = await safely(() => source.stored(epoch));
  if (stored.kind === "snapshot") return withFreshness(stored.snapshot, false);

  let previous: Snapshot | null | undefined;
  if (source.refreshLater) {
    previous = await lastKnownGood(epoch);
    if (previous && source.refreshLater(epoch)) return withFreshness(previous, true);
  }

  let outcome = await safely(() => source.fetch(epoch));
  if (outcome.kind === "missing") {
    epoch = epochOf(now(), policy);
    outcome = await safely(() => source.fetch(epoch));
  }
  if (outcome.kind === "snapshot") return withFreshness(outcome.snapshot, false);

  const error: AdapterError =
    outcome.kind === "failed"
      ? outcome.error
      : { platform, kind: "upstream", message: "Couldn't load contributions right now. Please try again." };
  if (!allowsFallback(error)) return { ok: false, error };
  previous ??= await lastKnownGood(epoch);
  return previous ? withFreshness(previous, true) : { ok: false, error };
}
