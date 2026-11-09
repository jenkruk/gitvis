import { createElement } from "react";
import type { NextRequest } from "next/server";
import { isValidGitLabUsername } from "@/adapters/types";
import { PLATFORMS } from "@/domain/types";
import { renderSvgMarkup } from "@/publish/svg-markup";
import {
  LINK_LABEL_MODES,
  LINK_LABEL_SPANS,
  LinkLabel,
  type LinkLabelKind,
  type LinkLabelMode,
  type LinkLabelSpan,
} from "@/renderers/LinkLabel";
import { cardLimiter, clientKey, tooManyRequests } from "@/server/rate-limit";

export function GET(request: NextRequest) {
  const limit = cardLimiter.hit(clientKey(request.headers));
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const params = request.nextUrl.searchParams;
  const mode = (params.get("mode") ?? "dark") as LinkLabelMode;
  const gitlab = params.get("gitlab")?.trim();
  const cta = params.get("cta") === "1";
  const repo = params.get("repo") === "1";
  const inset = params.get("inset");
  const color = params.get("color");
  const span = (params.get("span") ?? "half") as LinkLabelSpan;
  const line = params.get("line");
  const version = params.get("v");
  const valid =
    LINK_LABEL_MODES.includes(mode) &&
    (inset === null || inset === "1") &&
    (color === null || /^[0-9a-f]{6}$/i.test(color)) &&
    span in LINK_LABEL_SPANS &&
    (line === null || (line === "1" && (cta || repo))) &&
    (version === null || /^[1-9]\d{0,2}$/.test(version)) &&
    (cta || repo ? !(cta && repo) && gitlab === undefined : gitlab !== undefined && isValidGitLabUsername(gitlab));
  if (!valid) {
    return new Response(
      "Provide cta=1, repo=1 or a valid gitlab username, mode=dark or light, and optionally span=half|full, color=rrggbb and inset=1.",
      {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      },
    );
  }

  const onLine = line === "1";
  const kind: LinkLabelKind = cta ? "cta" : repo ? (onLine ? "repoLine" : "repo") : "gitlab";
  const text = cta
    ? "Get Yours"
    : repo
      ? onLine
        ? "· open source on GitHub"
        : "Open source on GitHub"
      : `${PLATFORMS.gitlab.label} @${gitlab}`;
  const svg = renderSvgMarkup(
    createElement(LinkLabel, {
      kind,
      text,
      mode,
      span,
      color: color ? `#${color}` : undefined,
      inset: inset === "1",
      line: onLine,
    }),
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
