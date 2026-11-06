import "server-only";
import { createElement } from "react";
import type { PlatformResult } from "@/adapters/connect";
import type { VisualizationConfig } from "@/config/config";
import { decodeCardParams } from "@/publish/card-params";
import { renderSvgMarkup } from "@/publish/svg-markup";
import { ErrorCard } from "@/renderers/ErrorCard";
import { Visualization } from "@/renderers/Visualization";
import { resolveTheme } from "@/theme/palettes";
import { type ContributionLoaders, loadContributions } from "./contributions";

export type CardStatus = "ok" | "invalid_config" | "not_found" | "unavailable" | "internal_error";

export interface CardResult {
  svg: string;
  status: CardStatus;
  /** Edge cache lifetime in seconds (CDN-Cache-Control s-maxage). */
  edgeMaxAge: number;
}

const HOUR = 3_600;
const MINUTE = 60;

function errorCard(
  config: VisualizationConfig,
  status: Exclude<CardStatus, "ok">,
  edgeMaxAge: number,
  copy: { title: string; message: string; hint?: string },
): CardResult {
  const theme = resolveTheme(config.palette, config.mode);
  return { svg: renderSvgMarkup(createElement(ErrorCard, { theme, ...copy })), status, edgeMaxAge };
}

type FailedResult = Exclude<PlatformResult, { status: "ok" }>;

function failureCard(config: VisualizationConfig, failure: FailedResult): CardResult {
  if (failure.status === "not_found") {
    return errorCard(config, "not_found", HOUR, {
      title: "Account not found",
      message: failure.message,
      hint: "Check the username in the image URL, or make the profile public.",
    });
  }
  return errorCard(config, "unavailable", MINUTE, {
    title: "Contributions temporarily unavailable",
    message: failure.message,
    hint: "This usually resolves on its own within a few minutes.",
  });
}

/**
 * Renders the published SVG for a card URL. Never throws, never exposes
 * internals: every failure becomes an explanatory error card built only from
 * fixed, user-safe strings.
 */
export async function renderCard(search: URLSearchParams, loaders: ContributionLoaders): Promise<CardResult> {
  const { request, config, issues } = decodeCardParams(search);

  try {
    if (issues.length > 0 || !request) {
      const [first, ...rest] = issues;
      return errorCard(config, "invalid_config", HOUR, {
        title: "Invalid GitVis image URL",
        message: `${first?.message ?? "Missing usernames."}${rest.length ? ` (+${rest.length} more)` : ""}`,
        hint: "Copy a fresh snippet from GitVis to fix this image.",
      });
    }

    const response = await loadContributions(request, loaders);
    // Any failed platform → explain it, rather than publishing a misleadingly partial total.
    const failure = response.results.find((r): r is FailedResult => r.status !== "ok");
    if (failure) return failureCard(config, failure);
    if (!response.dataset) throw new Error("No dataset despite successful results");

    const svg = renderSvgMarkup(createElement(Visualization, { dataset: response.dataset, config }));
    return { svg, status: "ok", edgeMaxAge: HOUR };
  } catch (error) {
    console.error("[gitvis] card render failed", error);
    return errorCard(config, "internal_error", MINUTE, {
      title: "Something went wrong",
      message: "GitVis couldn't render this image right now.",
      hint: "Please try again later.",
    });
  }
}

/** Strong ETag over the SVG bytes, so camo/browsers revalidate with a cheap 304. */
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
