import { describe, expect, it, vi } from "vitest";
import { adapterError, type AdapterResult } from "@/adapters/types";
import { toISODate } from "@/domain/dates";
import {
  DEFAULT_POLICY,
  epochOf,
  type FreshnessPolicy,
  loadWithFreshness,
  policyFromEnv,
  type Snapshot,
  type SnapshotOutcome,
} from "./freshness";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Simulates the snapshot cache exactly as cached.ts uses it: one entry per
 * epoch, the current epoch fetches on a miss, past epochs are lookup-only, and
 * failures are never stored. `upstream` decides what a fetch returns.
 */
function harness(policy: FreshnessPolicy = DEFAULT_POLICY) {
  let now = Date.parse("2026-11-01T00:00:00Z");
  const store = new Map<number, Snapshot>();
  let upstream: () => AdapterResult = () => ok(1);
  const fetches = vi.fn();

  const read = async (epoch: number): Promise<SnapshotOutcome> => {
    const hit = store.get(epoch);
    if (hit) return { kind: "snapshot", snapshot: hit };
    if (epoch !== epochOf(now, policy)) return { kind: "missing" };
    fetches();
    const result = upstream();
    if (!result.ok && result.error.kind !== "not_found") return { kind: "failed", error: result.error }; // not stored
    const snapshot = { result, fetchedAt: new Date(now).toISOString() };
    store.set(epoch, snapshot);
    return { kind: "snapshot", snapshot };
  };
  const recover = (): AdapterResult => adapterError("gitlab", "upstream", "generic");

  return {
    load: () => loadWithFreshness(read, recover, policy, "gitlab", () => now),
    advance: (ms: number) => (now += ms),
    setUpstream: (fn: () => AdapterResult) => (upstream = fn),
    fetches,
  };
}

function ok(count: number): AdapterResult {
  return {
    ok: true,
    data: { platform: "gitlab", username: "u", days: [{ date: toISODate("2026-10-31"), count }] },
  };
}
const countOf = (r: AdapterResult) => (r.ok ? r.data.days[0]!.count : null);
const failing = () => adapterError("gitlab", "upstream", "GitLab responded with an error (503).");

describe("freshness policy", () => {
  it("serves cached data within the 12h window without refetching", async () => {
    const h = harness();
    expect(countOf(await h.load())).toBe(1);
    h.setUpstream(() => ok(2));
    h.advance(11 * HOUR);
    expect(countOf(await h.load())).toBe(1);
    expect(h.fetches).toHaveBeenCalledTimes(1);
  });

  it("refreshes synchronously on the first request after 12h (no stale-then-refresh)", async () => {
    const h = harness();
    await h.load();
    h.setUpstream(() => ok(2));
    h.advance(13 * HOUR);
    const result = await h.load();
    expect(countOf(result)).toBe(2);
    expect(result.ok && result.data.stale).toBeUndefined();
  });

  it("returns fresh data immediately after days without any requests", async () => {
    const h = harness();
    await h.load();
    h.setUpstream(() => ok(5));
    h.advance(4 * DAY);
    const result = await h.load();
    expect(countOf(result)).toBe(5);
    expect(result.ok && result.data.fetchedAt).toBe("2026-11-05T00:00:00.000Z");
  });

  it("serves last-known-good data, marked stale, when a refresh fails", async () => {
    const h = harness();
    await h.load(); // snapshot at day 0
    h.setUpstream(failing);
    h.advance(3 * DAY);
    const result = await h.load();
    expect(countOf(result)).toBe(1);
    expect(result.ok && result.data).toMatchObject({ stale: true, fetchedAt: "2026-11-01T00:00:00.000Z" });
  });

  it("prefers the newest snapshot and never fetches for past epochs", async () => {
    const h = harness();
    await h.load();
    h.advance(DAY);
    h.setUpstream(() => ok(7));
    await h.load(); // newer snapshot at day 1
    h.setUpstream(failing);
    h.advance(DAY);
    h.fetches.mockClear();
    const result = await h.load();
    expect(countOf(result)).toBe(7);
    expect(h.fetches).toHaveBeenCalledTimes(1); // only the current epoch attempted a fetch
  });

  it("reports the failure once last-known-good data is older than 7 days", async () => {
    const h = harness();
    await h.load();
    h.setUpstream(failing);
    h.advance(7 * DAY + HOUR);
    const result = await h.load();
    expect(result).toMatchObject({ ok: false, error: { kind: "upstream" } });
  });

  it("recovers to fresh data as soon as upstream works again", async () => {
    const h = harness();
    await h.load();
    h.setUpstream(failing);
    h.advance(DAY);
    expect((await h.load()).ok && "stale").toBe("stale");
    h.setUpstream(() => ok(9));
    h.advance(13 * HOUR);
    const result = await h.load();
    expect(countOf(result)).toBe(9);
    expect(result.ok && result.data.stale).toBeUndefined();
  });

  it("does not mask a missing account with old data", async () => {
    const h = harness();
    await h.load();
    h.setUpstream(() => adapterError("gitlab", "not_found", "No public GitLab profile found."));
    h.advance(DAY);
    expect(await h.load()).toMatchObject({ ok: false, error: { kind: "not_found" } });
  });

  it("keeps the specific upstream message (not a generic one) when nothing can be served", async () => {
    const h = harness();
    h.setUpstream(failing);
    expect(await h.load()).toMatchObject({ ok: false, error: { message: "GitLab responded with an error (503)." } });
  });

  it("degrades unexpected exceptions to a generic failure instead of crashing", async () => {
    const result = await loadWithFreshness(
      async () => {
        throw new Error("cache store unavailable");
      },
      () => adapterError("github", "upstream", "Couldn't load contributions right now."),
      DEFAULT_POLICY,
      "github",
    );
    expect(result).toMatchObject({ ok: false, error: { kind: "upstream" } });
  });

  it("reports failure when there is no earlier snapshot at all", async () => {
    const h = harness();
    h.setUpstream(failing);
    expect(await h.load()).toMatchObject({ ok: false, error: { kind: "upstream" } });
  });
});

describe("policyFromEnv", () => {
  it("defaults to 12h freshness and 7 days maximum staleness", () => {
    expect(policyFromEnv({})).toEqual({ ttlMs: 12 * HOUR, maxStaleMs: 7 * DAY });
  });

  it("accepts overrides in seconds, ignores invalid values, and never lets maxStale undercut the TTL", () => {
    expect(policyFromEnv({ GITVIS_DATA_TTL_SECONDS: "6", GITVIS_MAX_STALE_SECONDS: "20" })).toEqual({
      ttlMs: 6000,
      maxStaleMs: 20000,
    });
    expect(policyFromEnv({ GITVIS_DATA_TTL_SECONDS: "abc", GITVIS_MAX_STALE_SECONDS: "0" })).toEqual(DEFAULT_POLICY);
    expect(policyFromEnv({ GITVIS_DATA_TTL_SECONDS: "60", GITVIS_MAX_STALE_SECONDS: "10" })).toEqual({
      ttlMs: 60000,
      maxStaleMs: 60000,
    });
  });
});
