import { createElement } from "react";
import type { NextRequest } from "next/server";
import { isValidGitLabUsername } from "@/adapters/types";
import { PLATFORMS } from "@/domain/types";
import { renderSvgMarkup } from "@/publish/svg-markup";
import {
  LINK_LABEL_MODES,
  LINK_LABEL_SPANS,
  LineLabel,
  LineSpacer,
  type LineStyle,
  LinkLabel,
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
  const spacer = params.get("spacer") === "1";
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
    (spacer
      ? !cta && !repo && gitlab === undefined && Number(version) >= 4
      : cta || repo
        ? !(cta && repo) && gitlab === undefined
        : gitlab !== undefined && isValidGitLabUsername(gitlab));
  if (!valid) {
    return new Response(
      "Provide cta=1, repo=1, spacer=1 or a valid gitlab username, mode=dark or light, and optionally span=half|full, color=rrggbb and inset=1.",
      {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      },
    );
  }

  const fill = color ? `#${color}` : undefined;
  const v = Number(version);
  const style: LineStyle = v >= 4 ? "small" : v >= 3 ? "fitted" : "card";
  const element = spacer
    ? createElement(LineSpacer)
    : line === "1"
      ? createElement(LineLabel, {
          part: cta ? "cta" : "repo",
          style,
          text: cta ? "Get Yours" : "· open source on GitHub",
          mode,
          color: fill,
        })
      : createElement(LinkLabel, {
          kind: cta ? "cta" : repo ? "repo" : "gitlab",
          text: cta ? "Get Yours" : repo ? "Open source on GitHub" : `${PLATFORMS.gitlab.label} @${gitlab}`,
          mode,
          span,
          color: fill,
          inset: inset === "1",
        });
  return new Response(renderSvgMarkup(element), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
      "Vercel-CDN-Cache-Control": "public, s-maxage=31536000",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
