import { describe, expect, it, vi } from "vitest";
import { AVATAR_MAX_BYTES, avatarKey, createAvatarLoader, fetchAvatar } from "./avatars";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

function image(bytes = PNG, type = "image/png", extra: Record<string, string> = {}) {
  return new Response(bytes, { status: 200, headers: { "content-type": type, ...extra } });
}

describe("fetchAvatar", () => {
  it("embeds a GitHub avatar as a small data: URI from the fixed avatar host", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => image());
    const uri = await fetchAvatar("github", "jenkruk", { fetchImpl });
    expect(uri).toBe(`data:image/png;base64,${Buffer.from(PNG).toString("base64")}`);
    expect(String(fetchImpl.mock.calls[0]![0])).toBe("https://avatars.githubusercontent.com/jenkruk?s=96");
  });

  it("resolves GitLab avatars through the public users API and sizes gravatar URLs", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("/api/v4/users")) {
        return Response.json([{ avatar_url: "https://secure.gravatar.com/avatar/abc?s=80&d=identicon" }]);
      }
      return image(PNG, "image/jpeg");
    });
    const uri = await fetchAvatar("gitlab", "contactkruk", { fetchImpl });
    expect(uri?.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(String(fetchImpl.mock.calls[1]![0])).toContain("s=96");
  });

  it.each([
    ["a non-image content type", image(PNG, "text/html")],
    ["an SVG (scriptable)", image(PNG, "image/svg+xml")],
    ["an oversized image", image(new Uint8Array(AVATAR_MAX_BYTES + 1))],
    ["an oversized Content-Length", image(PNG, "image/png", { "content-length": String(AVATAR_MAX_BYTES * 2) })],
    ["an HTTP error", new Response(null, { status: 404 })],
  ])("returns null (→ monogram) for %s", async (_label, response) => {
    expect(await fetchAvatar("github", "u", { fetchImpl: async () => response })).toBeNull();
  });

  it("treats only gravatar.com and its subdomains as Gravatar, never lookalike hosts", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) =>
      String(input).includes("/api/v4/users")
        ? Response.json([{ avatar_url: "https://evilgravatar.com/avatar/abc" }])
        : image(),
    );
    expect(await fetchAvatar("gitlab", "u", { fetchImpl })).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("refuses redirects and API-provided URLs outside the host allowlist (no SSRF)", async () => {
    const redirect = new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest" } });
    expect(await fetchAvatar("github", "u", { fetchImpl: async () => redirect })).toBeNull();

    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json([{ avatar_url: "https://evil.example/a.png" }]));
    expect(await fetchAvatar("gitlab", "u", { fetchImpl })).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("follows a redirect that stays within the allowlist", async () => {
    let calls = 0;
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      calls++ === 0
        ? new Response(null, { status: 302, headers: { location: "https://avatars.githubusercontent.com/u/1?v=4" } })
        : image(),
    );
    expect(await fetchAvatar("github", "u", { fetchImpl })).not.toBeNull();
  });

  it("never throws on network failures", async () => {
    expect(
      await fetchAvatar("gitlab", "u", {
        fetchImpl: async () => {
          throw new Error("ECONNRESET");
        },
      }),
    ).toBeNull();
  });
});

describe("createAvatarLoader", () => {
  const DAY = 24 * 3_600_000;
  const T0 = Date.parse("2026-11-17T10:00:00.000Z");
  const OLD = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString("base64")}`;
  const NEW = `data:image/png;base64,${Buffer.from(PNG).toString("base64")}`;
  const key = avatarKey("github", "jenkruk");

  function store() {
    const map = new Map<string, unknown>();
    return {
      map,
      get: vi.fn(async (k: string) => map.get(k) ?? null),
      set: vi.fn(async (k: string, v: unknown) => void map.set(k, v)),
    };
  }

  function setup({ fetchImpl = vi.fn<typeof fetch>(async () => image()), now = T0, withSchedule = true } = {}) {
    const s = store();
    const tasks: (() => Promise<void>)[] = [];
    const clock = { now };
    const schedule = vi.fn((task: () => Promise<void>) => void tasks.push(task));
    const load = createAvatarLoader(s, () => ({ fetchImpl }), {
      now: () => clock.now,
      ...(withSchedule ? { schedule } : {}),
    });
    const runScheduled = async () => {
      for (const task of tasks.splice(0)) await task();
    };
    return { s, load, fetchImpl, schedule, runScheduled, clock };
  }

  it("fetches only requested, connected platforms and keeps a fetched avatar for 7 days", async () => {
    const { s, load, fetchImpl } = setup();
    const result = await load({ github: "jenkruk", gitlab: "contactkruk" }, ["github"]);
    expect(Object.keys(result)).toEqual(["github"]);
    expect(s.set).toHaveBeenCalledWith(key, { dataUri: NEW, fetchedAt: new Date(T0).toISOString() }, 7 * 86_400);
    await load({ github: "jenkruk" }, ["github"]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("serves a stored avatar under a day old without fetching or scheduling anything", async () => {
    const { s, load, fetchImpl, schedule } = setup({ now: T0 + DAY - 1 });
    s.map.set(key, { dataUri: OLD, fetchedAt: new Date(T0).toISOString() });
    expect(await load({ github: "jenkruk" }, ["github"])).toEqual({ github: OLD });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(schedule).not.toHaveBeenCalled();
  });

  it("serves a day-old avatar immediately and refreshes it once in the background", async () => {
    const { s, load, fetchImpl, schedule, runScheduled } = setup({ now: T0 + DAY + 1 });
    s.map.set(key, { dataUri: OLD, fetchedAt: new Date(T0).toISOString() });
    const [a, b] = await Promise.all([
      load({ github: "jenkruk" }, ["github"]),
      load({ github: "jenkruk" }, ["github"]),
    ]);
    expect(a).toEqual({ github: OLD });
    expect(b).toEqual({ github: OLD });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(schedule).toHaveBeenCalledTimes(1);

    await runScheduled();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(s.map.get(key)).toEqual({ dataUri: NEW, fetchedAt: new Date(T0 + DAY + 1).toISOString() });
    expect(await load({ github: "jenkruk" }, ["github"])).toEqual({ github: NEW });
  });

  it("keeps the last good avatar, without extending it, when a background refresh fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { s, load, runScheduled } = setup({
      now: T0 + 2 * DAY,
      fetchImpl: vi.fn<typeof fetch>(async () => new Response(null, { status: 503 })),
    });
    const stored = { dataUri: OLD, fetchedAt: new Date(T0).toISOString() };
    s.map.set(key, stored);
    expect(await load({ github: "jenkruk" }, ["github"])).toEqual({ github: OLD });
    await runScheduled();
    expect(s.set).not.toHaveBeenCalled();
    expect(s.map.get(key)).toEqual(stored);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("background github avatar refresh failed"));
    warn.mockRestore();
  });

  it("still serves the stored avatar without blocking when a refresh can't be scheduled, or there's no scheduler", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const throwing = setup({ now: T0 + 2 * DAY });
    throwing.schedule.mockImplementation(() => {
      throw new Error("after() called outside a request");
    });
    throwing.s.map.set(key, { dataUri: OLD, fetchedAt: new Date(T0).toISOString() });
    expect(await throwing.load({ github: "jenkruk" }, ["github"])).toEqual({ github: OLD });
    expect(throwing.fetchImpl).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();

    const unscheduled = setup({ now: T0 + 2 * DAY, withSchedule: false });
    unscheduled.s.map.set(key, { dataUri: OLD, fetchedAt: new Date(T0).toISOString() });
    expect(await unscheduled.load({ github: "jenkruk" }, ["github"])).toEqual({ github: OLD });
    expect(unscheduled.fetchImpl).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("waits for a fetch only when nothing is stored, such as after the 7-day expiry", async () => {
    const { s, load, fetchImpl, schedule } = setup({ now: T0 + 8 * DAY });
    expect(await load({ github: "jenkruk" }, ["github"])).toEqual({ github: NEW });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(schedule).not.toHaveBeenCalled();
    expect(s.set).toHaveBeenCalledTimes(1);
  });

  it("remembers missing avatars for an hour and never refreshes them in the background", async () => {
    const { s, load, schedule, clock } = setup({
      fetchImpl: vi.fn<typeof fetch>(async () => new Response(null, { status: 404 })),
    });
    expect(await load({ github: "ghost" }, ["github"])).toEqual({});
    expect(s.set).toHaveBeenCalledWith(
      avatarKey("github", "ghost"),
      { dataUri: null, fetchedAt: new Date(T0).toISOString() },
      3600,
    );
    clock.now = T0 + 2 * DAY;
    expect(await load({ github: "ghost" }, ["github"])).toEqual({});
    expect(schedule).not.toHaveBeenCalled();
  });

  it.each([
    [
      "a tampered entry that isn't an image data URI",
      { dataUri: "javascript:alert(1)", fetchedAt: "2026-11-17T09:00:00.000Z" },
    ],
    ["an entry without a fetch time (the old format)", { dataUri: "data:image/png;base64,AQID" }],
  ])("never serves %s, and fetches a fresh avatar instead", async (_label, entry) => {
    const { s, load, fetchImpl } = setup();
    s.map.set(key, entry);
    expect(await load({ github: "jenkruk" }, ["github"])).toEqual({ github: NEW });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
