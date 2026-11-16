import { afterEach, describe, expect, it, vi } from "vitest";
import { adapterError, type AdapterResult } from "@/adapters/types";
import { toISODate } from "@/domain/dates";
import { createLoaders, type Fetcher, recoverLoaderError, snapshotKey, testOverridesAllowed } from "./cached";
import { DEFAULT_POLICY, epochOf, type Snapshot } from "./freshness";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function fakeStore() {
  const entries = new Map<string, { json: string; expires: number }>();
  let clock = 0;
  return {
    entries,
    setClock: (ms: number) => (clock = ms),
    store: {
      get: vi.fn(async (key: string) => {
        const e = entries.get(key);
        return e && e.expires > clock ? JSON.parse(e.json) : null;
      }),
      set: vi.fn(async (key: string, value: Snapshot, ttl: number) => {
        entries.set(key, { json: JSON.stringify(value), expires: clock + ttl * 1000 });
      }),
    },
  };
}

const ok = (count: number): AdapterResult => ({
  ok: true,
  data: { platform: "gitlab", username: "u", days: [{ date: toISODate("2026-11-01"), count }] },
});

function setup(fetcher: Fetcher) {
  let now = Date.parse("2026-11-06T01:00:00Z");
  const s = fakeStore();
  s.setClock(now);
  const fetch = vi.fn(fetcher);
  const loaders = createLoaders({ store: s.store, fetcher: fetch, policy: () => DEFAULT_POLICY, now: () => now });
  return {
    ...s,
    fetch,
    loaders,
    advance: (ms: number) => {
      now += ms;
      s.setClock(now);
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("createLoaders (Runtime Cache snapshots)", () => {
  it("stores successful fetches under a versioned, deployment-independent key with a 7.5-day TTL", async () => {
    const t = setup(async () => ok(3));
    await t.loaders.gitlab("u");
    const epoch = epochOf(Date.parse("2026-11-06T01:00:00Z"), DEFAULT_POLICY);
    expect(t.store.set).toHaveBeenCalledWith(
      snapshotKey("gitlab", "u", epoch),
      expect.any(Object),
      7 * 24 * 3600 + 12 * 3600,
    );
    expect(snapshotKey("gitlab", "u", epoch)).toBe(`v2:gitlab:u:${epoch}`);
  });

  it("survives a 'deployment' (new loader instance, same store) and keeps serving last-known-good", async () => {
    const t = setup(async () => ok(3));
    await t.loaders.gitlab("u");
    const redeployed = createLoaders({
      store: t.store,
      fetcher: async () => adapterError("gitlab", "upstream", "GitLab responded with an error (503)."),
      policy: () => DEFAULT_POLICY,
      now: () => Date.parse("2026-11-06T01:00:00Z") + 30 * HOUR,
    });
    t.setClock(Date.parse("2026-11-06T01:00:00Z") + 30 * HOUR);
    const result = await redeployed.gitlab("u");
    expect(result.ok && result.data).toMatchObject({ stale: true, days: [{ count: 3 }] });
  });

  it("never writes failures and never fetches for past windows", async () => {
    const t = setup(async () => adapterError("gitlab", "upstream", "GitLab responded with an error (503)."));
    const result = await t.loaders.gitlab("u");
    expect(result).toMatchObject({ ok: false, error: { message: "GitLab responded with an error (503)." } });
    expect(t.store.set).not.toHaveBeenCalled();
    expect(t.fetch).toHaveBeenCalledTimes(1);
    expect(t.store.get.mock.calls.length).toBeGreaterThan(1);
  });

  it("re-checks not-found answers after an hour", async () => {
    let mode: "missing" | "exists" = "missing";
    const t = setup(async () =>
      mode === "missing" ? adapterError("gitlab", "not_found", "No public GitLab profile found.") : ok(2),
    );
    expect((await t.loaders.gitlab("u")).ok).toBe(false);
    mode = "exists";
    t.advance(30 * 60_000);
    expect((await t.loaders.gitlab("u")).ok).toBe(false);
    t.advance(31 * 60_000);
    expect((await t.loaders.gitlab("u")).ok).toBe(true);
  });

  it("degrades gracefully when the cache store itself fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const t = setup(async () => ok(4));
    t.store.get.mockRejectedValue(new Error("cache unavailable"));
    t.store.set.mockRejectedValue(new Error("cache unavailable"));
    const result = await t.loaders.gitlab("u");
    expect(result.ok && result.data.days[0]!.count).toBe(4);
  });

  it("ignores malformed stored values instead of rendering them", async () => {
    const t = setup(async () => ok(5));
    const epoch = epochOf(Date.parse("2026-11-06T01:00:00Z"), DEFAULT_POLICY);
    t.entries.set(snapshotKey("gitlab", "u", epoch), { json: JSON.stringify({ bogus: true }), expires: Infinity });
    const result = await t.loaders.gitlab("u");
    expect(result.ok && result.data.days[0]!.count).toBe(5);
  });

  it("shares one upstream fetch between concurrent requests for the same snapshot", async () => {
    const t = setup(async () => ok(6));
    await Promise.all([t.loaders.gitlab("u"), t.loaders.gitlab("u"), t.loaders.gitlab("u")]);
    expect(t.fetch).toHaveBeenCalledTimes(1);
  });
});

function backgroundSetup(fetcher: Fetcher) {
  const t = setup(fetcher);
  const tasks: (() => Promise<void>)[] = [];
  const schedule = vi.fn((task: () => Promise<void>) => void tasks.push(task));
  let now = Date.parse("2026-11-06T01:00:00Z");
  const instance = () =>
    createLoaders({ store: t.store, fetcher: t.fetch, policy: () => DEFAULT_POLICY, now: () => now, schedule });
  const loaders = instance();
  return {
    ...t,
    loaders,
    instance,
    schedule,
    tasks,
    advance: (ms: number) => {
      now += ms;
      t.setClock(now);
    },
    runTasks: async () => {
      for (const task of tasks.splice(0)) await task();
    },
  };
}

describe("createLoaders with background refresh (published cards)", () => {
  it("answers the first request of a new window from the previous snapshot and refreshes once afterwards", async () => {
    let count = 1;
    const t = backgroundSetup(async () => ok(count));
    await t.loaders.gitlab("u");
    count = 2;
    t.advance(13 * HOUR);

    const views = await Promise.all([t.loaders.gitlab("u"), t.loaders.gitlab("u"), t.loaders.gitlab("u")]);
    expect(views.map((v) => v.ok && v.data.stale)).toEqual([true, true, true]);
    expect(views.map((v) => v.ok && v.data.days[0]!.count)).toEqual([1, 1, 1]);
    expect(t.fetch).toHaveBeenCalledTimes(1);
    expect(t.tasks).toHaveLength(1);

    await t.runTasks();
    expect(t.fetch).toHaveBeenCalledTimes(2);
    const fresh = await t.loaders.gitlab("u");
    expect(fresh.ok && fresh.data).toMatchObject({ days: [{ count: 2 }] });
    expect(fresh.ok && fresh.data.stale).toBeUndefined();
    expect(t.tasks).toHaveLength(0);
  });

  it("skips the upstream call when another instance already stored the new window", async () => {
    const t = backgroundSetup(async () => ok(3));
    await t.loaders.gitlab("u");
    t.advance(13 * HOUR);
    const other = t.instance();
    await Promise.all([t.loaders.gitlab("u"), other.gitlab("u")]);
    expect(t.tasks).toHaveLength(2);
    await t.runTasks();
    expect(t.fetch).toHaveBeenCalledTimes(2);
  });

  it("writes nothing when the background refresh fails, schedules again on the next view, and recovers", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let mode: "ok" | "fail" = "ok";
    const t = backgroundSetup(async () =>
      mode === "ok" ? ok(4) : adapterError("gitlab", "upstream", "GitLab responded with an error (503)."),
    );
    await t.loaders.gitlab("u");
    mode = "fail";
    t.advance(DAY);
    await t.loaders.gitlab("u");
    const writes = t.store.set.mock.calls.length;
    await t.runTasks();
    expect(t.store.set.mock.calls.length).toBe(writes);
    expect(console.warn).toHaveBeenCalledWith("[gitvis] background gitlab refresh failed", "upstream");

    const retry = await t.loaders.gitlab("u");
    expect(retry.ok && retry.data.stale).toBe(true);
    expect(t.tasks).toHaveLength(1);
    mode = "ok";
    await t.runTasks();
    const recovered = await t.loaders.gitlab("u");
    expect(recovered.ok && recovered.data.stale).toBeUndefined();
  });

  it("fetches before answering when the cache was evicted", async () => {
    const t = backgroundSetup(async () => ok(5));
    await t.loaders.gitlab("u");
    t.advance(DAY);
    t.entries.clear();
    const result = await t.loaders.gitlab("u");
    expect(result.ok && result.data.stale).toBeUndefined();
    expect(t.fetch).toHaveBeenCalledTimes(2);
    expect(t.tasks).toHaveLength(0);
  });

  it("fetches before answering when scheduling itself fails (e.g. outside a request)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const t = backgroundSetup(async () => ok(6));
    await t.loaders.gitlab("u");
    t.advance(DAY);
    t.schedule.mockImplementationOnce(() => {
      throw new Error("after() called outside a request scope");
    });
    const result = await t.loaders.gitlab("u");
    expect(result.ok && result.data.stale).toBeUndefined();
    expect(t.fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps each platform's freshness independent", async () => {
    const t = backgroundSetup(async (platform) => ({
      ok: true,
      data: { platform, username: "u", days: [{ date: toISODate("2026-11-01"), count: 1 }] },
    }));
    await t.loaders.github("u");
    t.advance(13 * HOUR);
    await t.loaders.gitlab("u");
    const [github, gitlab] = await Promise.all([t.loaders.github("u"), t.loaders.gitlab("u")]);
    expect(github.ok && github.data.stale).toBe(true);
    expect(gitlab.ok && gitlab.data.stale).toBeUndefined();
    expect(t.tasks).toHaveLength(1);
  });
});

describe("testOverridesAllowed", () => {
  it("ignores test-only overrides in Vercel production", () => {
    expect(testOverridesAllowed({ VERCEL_ENV: "production" })).toBe(false);
    expect(testOverridesAllowed({ VERCEL_ENV: "preview" })).toBe(true);
    expect(testOverridesAllowed({})).toBe(true);
  });
});

describe("recoverLoaderError", () => {
  it("turns unexpected exceptions into a generic error without leaking details", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = recoverLoaderError("gitlab", new Error("socket hang up: Bearer ghp_secret"));
    expect(result).toEqual({
      ok: false,
      error: {
        platform: "gitlab",
        kind: "upstream",
        message: "Couldn't load contributions right now. Please try again.",
      },
    });
    expect(JSON.stringify(result)).not.toContain("ghp_secret");
    expect(log).toHaveBeenCalled();
  });
});
