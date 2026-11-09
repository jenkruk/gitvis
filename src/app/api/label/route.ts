import { createElement } from "react";
import type { NextRequest } from "next/server";
import { isValidGitLabUsername } from "@/adapters/types";
import { PLATFORMS } from "@/domain/types";
import { renderSvgMarkup } from "@/publish/svg-markup";
import { LINK_LABEL_MODES, LinkLabel, type LinkLabelKind, type LinkLabelMode } from "@/renderers/LinkLabel";
import { cardLimiter, clientKey, tooManyRequests } from "@/server/rate-limit";

/**
 * GET /api/label?cta=1|gitlab=<username>&mode=dark|light[&color=rrggbb][&inset=1]
 * The README snippet's links drawn as tiny SVGs ("Get Yours", "GitLab @user"),
 * so they share one line under the card and line up with it (see
 * src/publish/snippets.ts). Text is fixed or a validated username, never free
 * text, and the output depends only on the URL, so it's cached for a long time.
 */
export function GET(request: NextRequest) {
  const limit = cardLimiter.hit(clientKey(request.headers));
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const params = request.nextUrl.searchParams;
  const mode = (params.get("mode") ?? "dark") as LinkLabelMode;
  const gitlab = params.get("gitlab")?.trim();
  const cta = params.get("cta") === "1";
  const inset = params.get("inset");
  const color = params.get("color");
  const valid =
    LINK_LABEL_MODES.includes(mode) &&
    (inset === null || inset === "1") &&
    (color === null || /^[0-9a-f]{6}$/i.test(color)) &&
    (cta ? gitlab === undefined : gitlab !== undefined && isValidGitLabUsername(gitlab));
  if (!valid) {
    return new Response(
      "Provide cta=1 or a valid gitlab username, mode=dark or light, and optionally color=rrggbb and inset=1.",
      {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      },
    );
  }

  const kind: LinkLabelKind = cta ? "cta" : "gitlab";
  const text = cta ? "Get Yours" : `${PLATFORMS.gitlab.label} @${gitlab}`;
  const svg = renderSvgMarkup(
    createElement(LinkLabel, { kind, text, mode, color: color ? `#${color}` : undefined, inset: inset === "1" }),
  );
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
      "Vercel-CDN-Cache-Control": "public, s-maxage=31536000",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
