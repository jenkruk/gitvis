import type { ConnectRequest } from "@/adapters/connect";
import { createDefaultConfig, type VisualizationConfig } from "@/config/config";
import type { ColorMode } from "@/theme/palettes";
import { PLATFORM_IDS, PLATFORMS } from "@/domain/types";
import { type CardParams, encodeCardParams } from "./card-params";
import { escapeMarkup } from "./svg-markup";

export type ReadmeTheme = "selected" | "auto";

export function cardUrl(origin: string, params: CardParams): string {
  return `${origin}/api/card?${encodeCardParams(params)}`;
}

/** Studio URL that restores usernames and every design choice. */
export function editUrl(origin: string, params: CardParams): string {
  return `${origin}/?${encodeCardParams(params)}`;
}

/** Image alt text. Names platforms and accounts; numbers change, so they live in the SVG's own description. */
export function altText(request: ConnectRequest): string {
  const accounts = PLATFORM_IDS.filter((p) => request[p]).map((p) => `${PLATFORMS[p].label} @${request[p]}`);
  return `GitVis contribution activity for ${accounts.join(" and ")}`;
}

function withMode(params: CardParams, mode: ColorMode): CardParams {
  return { ...params, config: { ...params.config, mode } };
}

/**
 * The README snippet. "selected" is a plain Markdown image; "auto" uses a
 * <picture> with prefers-color-scheme sources so the graphic follows the
 * reader's GitHub theme. Both link to the Edit configuration URL.
 */
export function readmeSnippet(origin: string, params: CardParams, theme: ReadmeTheme): string {
  const alt = altText(params.request);
  const edit = editUrl(origin, params);
  if (theme === "selected") return `[![${alt}](${cardUrl(origin, params)})](${edit})`;

  const attr = escapeMarkup;
  return [
    `<a href="${attr(edit)}">`,
    "  <picture>",
    `    <source media="(prefers-color-scheme: dark)" srcset="${attr(cardUrl(origin, withMode(params, "dark")))}">`,
    `    <source media="(prefers-color-scheme: light)" srcset="${attr(cardUrl(origin, withMode(params, "light")))}">`,
    `    <img alt="${attr(alt)}" src="${attr(cardUrl(origin, params))}">`,
    "  </picture>",
    "</a>",
  ].join("\n");
}

export function downloadName(request: ConnectRequest, extension: "svg" | "png"): string {
  const names = PLATFORM_IDS.flatMap((p) => request[p] ?? []);
  return `gitvis-${names.join("-") || "graphic"}.${extension}`;
}

/**
 * Query string for the studio address bar: the full Edit link when connected,
 * just the design when it differs from defaults, otherwise empty.
 */
export function studioSearch(request: ConnectRequest | null, config: VisualizationConfig): string {
  if (request) return encodeCardParams({ request, config }).toString();
  const design = encodeCardParams({ request: {}, config }).toString();
  return design === encodeCardParams({ request: {}, config: createDefaultConfig() }).toString() ? "" : design;
}
