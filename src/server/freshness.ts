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

export type SnapshotReader = (epoch: number) => Promise<SnapshotOutcome>;

function allowsFallback(error: AdapterError): boolean {
  return isTransientError(error.kind) || error.kind === "not_configured";
}

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
