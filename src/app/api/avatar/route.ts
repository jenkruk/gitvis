import type { NextRequest } from "next/server";
import { USERNAME_VALIDATORS } from "@/adapters/connect";
import { PLATFORM_IDS, type PlatformId } from "@/domain/types";
import { serverAvatarLoader } from "@/server/avatars";
import { avatarLimiter, clientKey, tooManyRequests } from "@/server/rate-limit";

export async function GET(request: NextRequest) {
  const limit = avatarLimiter.hit(clientKey(request.headers));
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const params = request.nextUrl.searchParams;
  const platform = params.get("platform") as PlatformId | null;
  const username = params.get("username")?.trim() ?? "";
  if (!platform || !PLATFORM_IDS.includes(platform) || !USERNAME_VALIDATORS[platform](username)) {
    return Response.json({ error: "Provide a valid platform and username." }, { status: 400 });
  }

  const avatars = await serverAvatarLoader({ [platform]: username }, [platform]);
  return Response.json(
    { dataUri: avatars[platform] ?? null },
    { headers: { "Cache-Control": "no-cache", "Vercel-CDN-Cache-Control": "public, s-maxage=86400" } },
  );
}
