import "server-only";
import { createElement } from "react";
import type { PlatformResult } from "@/adapters/connect";
import type { VisualizationConfig } from "@/config/config";
import { decodeCardParams } from "@/publish/card-params";
import { renderSvgMarkup } from "@/publish/svg-markup";
import type { PlatformId } from "@/domain/types";
import { ErrorCard } from "@/renderers/ErrorCard";
import type { AvatarImages } from "@/renderers/IdentityHeader";
import { CANVAS_WIDTHS, type CardSize } from "@/renderers/primitives";
import { Visualization } from "@/renderers/Visualization";
import { resolveTheme } from "@/theme/palettes";
import { type ContributionLoaders, loadContributions } from "./contributions";

export type CardStatus = "ok" | "stale" | "invalid_config" | "not_found" | "unavailable" | "internal_error";

export interface CardResult {
  svg: string;
  status: CardStatus;
  edgeMaxAge: number;
  asOf?: string;
}

const HOUR = 3_600;
const MINUTE = 60;

function errorCard(
  look: Look,
  status: Exclude<CardStatus, "ok" | "stale">,
  edgeMaxAge: number,
  copy: { title: string; message: string; hint?: string },
): CardResult {
  const theme = resolveTheme(look.config.palette, look.config.mode);
  const width = CANVAS_WIDTHS[look.size];
  return { svg: renderSvgMarkup(createElement(ErrorCard, { theme, width, ...copy })), status, edgeMaxAge };
}

interface Look {
  config: VisualizationConfig;
  size: CardSize;
}

type FailedResult = Exclude<PlatformResult, { status: "ok" }>;

function failureCard(look: Look, failure: FailedResult): CardResult {
  if (failure.status === "not_found") {
    return errorCard(look, "not_found", HOUR, {
      title: "Account not found",
      message: failure.message,
      hint: "Check the username in the image URL, or make the profile public.",
    });
  }
  return errorCard(look, "unavailable", MINUTE, {
    title: "Contributions temporarily unavailable",
    message: failure.message,
    hint: "This usually resolves on its own within a few minutes.",
  });
}

export type AvatarLoader = (
  request: Partial<Record<PlatformId, string>>,
  platforms: readonly PlatformId[],
) => Promise<AvatarImages>;

export async function renderCard(
  search: URLSearchParams,
  loaders: ContributionLoaders,
  loadAvatars?: AvatarLoader,
): Promise<CardResult> {
  const { request, config, issues, size = "full" } = decodeCardParams(search);
  const look: Look = { config, size };

  try {
    if (issues.length > 0 || !request) {
      const [first, ...rest] = issues;
      return errorCard(look, "invalid_config", HOUR, {
        title: "Invalid GitVis image URL",
        message: `${first?.message ?? "Missing usernames."}${rest.length ? ` (+${rest.length} more)` : ""}`,
        hint: "Copy a fresh snippet from GitVis to fix this image.",
      });
    }

    const wantsAvatars = config.identity.style !== "none" && config.identity.avatars.length > 0 && loadAvatars;
    const [response, avatars] = await Promise.all([
      loadContributions(request, loaders, { years: config.years }),
      wantsAvatars ? loadAvatars(request, config.identity.avatars).catch(() => ({})) : Promise.resolve({}),
    ]);
    const failure = response.results.find((r): r is FailedResult => r.status !== "ok");
    if (failure) return failureCard(look, failure);
    if (response.history && response.history.status !== "ok") {
      return failureCard(look, {
        platform: "github",
        username: request.github ?? "",
        status: response.history.status,
        message: "Earlier GitHub history couldn't be loaded right now.",
        retryable: response.history.retryable,
      });
    }
    if (!response.dataset) throw new Error("No dataset despite successful results");

    const svg = renderSvgMarkup(createElement(Visualization, { dataset: response.dataset, config, size, avatars }));
    return response.dataset.freshness?.stale
      ? { svg, status: "stale", edgeMaxAge: MINUTE, asOf: response.dataset.freshness.asOf }
      : { svg, status: "ok", edgeMaxAge: HOUR, asOf: response.dataset.freshness?.asOf };
  } catch (error) {
    console.error("[gitvis] card render failed", error);
    return errorCard(look, "internal_error", MINUTE, {
      title: "Something went wrong",
      message: "GitVis couldn't render this image right now.",
      hint: "Please try again later.",
    });
  }
}

export async function svgEtag(svg: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(svg));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return `"${hex}"`;
}

export function etagMatches(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false;
  return ifNoneMatch.split(",").some((tag) => {
    const value = tag.trim();
    return value === "*" || value === etag || value === `W/${etag}`;
  });
}
