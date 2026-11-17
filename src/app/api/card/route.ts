import type { NextRequest } from "next/server";
import { cacheHeaders, etagMatches, renderCard, svgEtag } from "@/server/card";
import { serverAvatarLoader } from "@/server/avatars";
import { cardLoaders } from "@/server/cached";
import { livePolicy } from "@/server/freshness";
import { cardLimiter, clientKey, tooManyRequests } from "@/server/rate-limit";

export async function GET(request: NextRequest) {
  const limit = cardLimiter.hit(clientKey(request.headers));
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const card = await renderCard(request.nextUrl.searchParams, cardLoaders, serverAvatarLoader, {
    policy: livePolicy(),
  });
  const etag = await svgEtag(card.svg);

  const headers = new Headers({
    "Content-Type": "image/svg+xml; charset=utf-8",
    ...cacheHeaders(card, Date.now()),
    ETag: etag,
    "X-GitVis-Status": card.status,
    ...(card.asOf ? { "X-GitVis-Data-As-Of": card.asOf } : {}),
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
  });

  if (etagMatches(request.headers.get("if-none-match"), etag)) return new Response(null, { status: 304, headers });
  return new Response(card.svg, { status: 200, headers });
}
