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
  function store() {
    const map = new Map<string, unknown>();
    return {
      map,
      get: vi.fn(async (k: string) => map.get(k) ?? null),
      set: vi.fn(async (k: string, v: unknown) => void map.set(k, v)),
    };
  }

  it("fetches only requested, connected platforms and caches results for a day", async () => {
    const s = store();
    const deps = { fetchImpl: vi.fn<typeof fetch>(async () => image()) };
    const load = createAvatarLoader(s, () => deps);
    const result = await load({ github: "jenkruk", gitlab: "contactkruk" }, ["github"]);
    expect(Object.keys(result)).toEqual(["github"]);
    expect(s.set).toHaveBeenCalledWith(avatarKey("github", "jenkruk"), expect.any(Object), 24 * 3600);

    await load({ github: "jenkruk" }, ["github"]);
    expect(deps.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("remembers missing avatars for an hour and returns nothing for them", async () => {
    const s = store();
    const load = createAvatarLoader(s, () => ({ fetchImpl: async () => new Response(null, { status: 404 }) }));
    expect(await load({ github: "ghost" }, ["github"])).toEqual({});
    expect(s.set).toHaveBeenCalledWith(avatarKey("github", "ghost"), { dataUri: null }, 3600);
  });

  it("ignores tampered cache entries that aren't image data URIs", async () => {
    const s = store();
    s.map.set(avatarKey("github", "jenkruk"), { dataUri: "javascript:alert(1)" });
    const load = createAvatarLoader(s, () => ({ fetchImpl: async () => image() }));
    expect(await load({ github: "jenkruk" }, ["github"])).toEqual({});
  });
});
