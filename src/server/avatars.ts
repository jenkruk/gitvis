import "server-only";
import { PLATFORM_IDS, type PlatformId } from "@/domain/types";
import type { AvatarImages } from "@/renderers/IdentityHeader";
import { type SnapshotStore, testOverridesAllowed, upstreamUrls, vercelRuntimeStore } from "./cached";
import { upstreamBudget } from "./rate-limit";

export const AVATAR_PIXELS = 96;
export const AVATAR_MAX_BYTES = 64 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const PRODUCTION_HOSTS = ["avatars.githubusercontent.com", "secure.gravatar.com", "www.gravatar.com", "gitlab.com"];
const GITHUB_AVATAR_ORIGIN = "https://avatars.githubusercontent.com";
const AVATAR_TTL_SECONDS = 24 * 3600;
const MISSING_TTL_SECONDS = 3600;
const AVATAR_SCHEMA = 1;

export interface AvatarDeps {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  gitlabOrigin?: string;
  githubAvatarOrigin?: string;
  extraHosts?: string[];
}

function allowedHosts(extra: string[] = []): Set<string> {
  return new Set([...PRODUCTION_HOSTS, ...extra]);
}

async function fetchImage(url: string, deps: AvatarDeps): Promise<string | null> {
  const { fetchImpl = fetch, timeoutMs = 3_000 } = deps;
  const hosts = allowedHosts(deps.extraHosts);
  let target = new URL(url);
  for (let hop = 0; hop < 3; hop++) {
    if (!hosts.has(target.host) || !/^https?:$/.test(target.protocol)) return null;
    const res = await fetchImpl(target, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return null;
      target = new URL(location, target);
      continue;
    }
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (!ALLOWED_TYPES.has(type)) return null;
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > AVATAR_MAX_BYTES) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > AVATAR_MAX_BYTES) return null;
    return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
  }
  return null;
}

export async function fetchAvatar(
  platform: PlatformId,
  username: string,
  deps: AvatarDeps = {},
): Promise<string | null> {
  try {
    if (platform === "github") {
      const origin = deps.githubAvatarOrigin ?? GITHUB_AVATAR_ORIGIN;
      return await fetchImage(`${origin}/${encodeURIComponent(username)}?s=${AVATAR_PIXELS}`, deps);
    }
    const origin = deps.gitlabOrigin ?? "https://gitlab.com";
    const { fetchImpl = fetch, timeoutMs = 3_000 } = deps;
    const res = await fetchImpl(`${origin}/api/v4/users?username=${encodeURIComponent(username)}`, {
      headers: { Accept: "application/json", "User-Agent": "GitVis" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const users = (await res.json()) as unknown;
    const avatarUrl = Array.isArray(users) ? (users[0] as { avatar_url?: unknown } | undefined)?.avatar_url : null;
    if (typeof avatarUrl !== "string") return null;
    const url = new URL(avatarUrl, origin);
    if (url.host.endsWith("gravatar.com")) url.searchParams.set("s", String(AVATAR_PIXELS));
    else url.searchParams.set("width", String(AVATAR_PIXELS));
    return await fetchImage(url.toString(), deps);
  } catch {
    return null;
  }
}

export function avatarKey(platform: PlatformId, username: string): string {
  return `v${AVATAR_SCHEMA}:avatar:${platform}:${username.toLowerCase()}`;
}

export function createAvatarLoader(store: SnapshotStore, deps: () => AvatarDeps = () => ({})) {
  const inFlight = new Map<string, Promise<string | null>>();

  async function load(platform: PlatformId, username: string): Promise<string | null> {
    const key = avatarKey(platform, username);
    try {
      const cached = (await store.get(key)) as { dataUri?: unknown } | null;
      if (cached && typeof cached === "object") {
        return typeof cached.dataUri === "string" && cached.dataUri.startsWith("data:image/") ? cached.dataUri : null;
      }
    } catch {}
    if (!upstreamBudget.take()) return null;
    const dataUri = await fetchAvatar(platform, username, deps());
    try {
      await store.set(key, { dataUri }, dataUri ? AVATAR_TTL_SECONDS : MISSING_TTL_SECONDS);
    } catch {}
    return dataUri;
  }

  return async function loadAvatars(
    request: Partial<Record<PlatformId, string>>,
    platforms: readonly PlatformId[],
  ): Promise<AvatarImages> {
    const wanted = PLATFORM_IDS.filter((p) => platforms.includes(p) && request[p]);
    const entries = await Promise.all(
      wanted.map(async (platform) => {
        const key = avatarKey(platform, request[platform]!);
        const pending = inFlight.get(key) ?? load(platform, request[platform]!);
        inFlight.set(key, pending);
        try {
          return [platform, await pending] as const;
        } finally {
          inFlight.delete(key);
        }
      }),
    );
    return Object.fromEntries(entries.filter(([, uri]) => uri)) as AvatarImages;
  };
}

function serverAvatarDeps(): AvatarDeps {
  if (!testOverridesAllowed()) return {};
  const githubAvatarOrigin = process.env.GITVIS_GITHUB_AVATAR_ORIGIN;
  const gitlabOrigin = upstreamUrls().gitlab;
  const extraHosts = [githubAvatarOrigin, gitlabOrigin]
    .filter((v): v is string => !!v && /^https?:\/\//.test(v))
    .map((v) => new URL(v).host);
  return {
    githubAvatarOrigin: githubAvatarOrigin && /^https?:\/\//.test(githubAvatarOrigin) ? githubAvatarOrigin : undefined,
    gitlabOrigin,
    extraHosts,
  };
}

export const serverAvatarLoader = createAvatarLoader(
  { get: (k) => vercelRuntimeStore().get(k), set: (k, v, t) => vercelRuntimeStore().set(k, v, t) },
  serverAvatarDeps,
);
