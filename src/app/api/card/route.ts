import type { NextRequest } from "next/server";
import { etagMatches, renderCard, svgEtag } from "@/server/card";
import { serverAvatarLoader } from "@/server/avatars";
import { serverLoaders } from "@/server/cached";
import { resolvePublicOrigin } from "@/server/origin";
import { cardLimiter, clientKey, tooManyRequests } from "@/server/rate-limit";

/**
 * GET /api/card?v=1&github=…&gitlab=…&layout=…&palette=…&mode=…&f=…
 * The published README image. Always SVG; errors render as explanatory cards.
 */
export async function GET(request: NextRequest) {
  const limit = cardLimiter.hit(clientKey(request.headers));
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  // "Get yours!" in the card links to the production site, never the request host (src/server/origin.ts).
  const { origin } = resolvePublicOrigin(process.env, {
    host: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    proto: request.headers.get("x-forwarded-proto"),
  });
  const card = await renderCard(request.nextUrl.searchParams, serverLoaders, serverAvatarLoader, origin);
  const etag = await svgEtag(card.svg);

  const headers = new Headers({
    "Content-Type": "image/svg+xml; charset=utf-8",
    // GitHub camo + browsers: always revalidate (GitHub's advice for changing images); ETag makes it a 304.
    "Cache-Control": "no-cache, max-age=0",
    // Edge cache: Vercel-only targeted header. Vercel consumes and strips it, so GitHub camo and other
    // downstream caches only ever see `no-cache` + ETag (plain CDN-Cache-Control would be forwarded to them).
    // SWR bounded to 10 min: after a long idle the edge must refetch rather than replay a day-old image.
    "Vercel-CDN-Cache-Control": `public, s-maxage=${card.edgeMaxAge}, stale-while-revalidate=600`,
    ETag: etag,
    "X-GitVis-Status": card.status,
    // Data age, for operators verifying freshness after idle periods and redeploys (public data only).
    ...(card.asOf ? { "X-GitVis-Data-As-Of": card.asOf } : {}),
    "X-Content-Type-Options": "nosniff",
    // The SVG contains no scripts or external resources; lock it down when opened directly.
    // img-src data: lets embedded avatar images render when the SVG is opened directly.
    // The sandbox still blocks scripts and forms; popups are allowed only so its profile and
    // "Get yours!" links (target="_blank") can open in a new tab.
    "Content-Security-Policy":
      "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox allow-popups allow-popups-to-escape-sandbox",
  });

  if (etagMatches(request.headers.get("if-none-match"), etag)) return new Response(null, { status: 304, headers });
  return new Response(card.svg, { status: 200, headers });
}
