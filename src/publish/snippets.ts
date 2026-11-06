import type { ConnectRequest } from "@/adapters/connect";
import { createDefaultConfig, type VisualizationConfig } from "@/config/config";
import type { CardSize } from "@/renderers/primitives";
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

function variant(params: CardParams, mode?: ColorMode, size?: CardSize): CardParams {
  return { ...params, config: mode ? { ...params.config, mode } : params.config, ...(size ? { size } : {}) };
}

export interface SnippetOptions {
  theme: ReadmeTheme;
  /** Serve the reflowed compact image on narrow screens (phones). */
  responsive: boolean;
}

/** Below this viewport width readers get the compact image (GitHub's mobile layout). */
export const NARROW_MEDIA = "(max-width: 600px)";

/**
 * The README snippet. Without options it is a plain linked Markdown image.
 * Theme matching and/or a mobile image need an HTML <picture>; the first
 * matching <source> wins, so narrow-screen sources come first. Always links
 * to the Edit configuration URL.
 */
export function readmeSnippet(origin: string, params: CardParams, { theme, responsive }: SnippetOptions): string {
  const alt = altText(params.request);
  const edit = editUrl(origin, params);
  if (theme === "selected" && !responsive) return `[![${alt}](${cardUrl(origin, params)})](${edit})`;

  const sources: [media: string, params: CardParams][] = [];
  if (responsive) {
    if (theme === "auto") {
      sources.push([`${NARROW_MEDIA} and (prefers-color-scheme: dark)`, variant(params, "dark", "compact")]);
      sources.push([`${NARROW_MEDIA} and (prefers-color-scheme: light)`, variant(params, "light", "compact")]);
    } else {
      sources.push([NARROW_MEDIA, variant(params, undefined, "compact")]);
    }
  }
  if (theme === "auto") {
    sources.push(["(prefers-color-scheme: dark)", variant(params, "dark")]);
    sources.push(["(prefers-color-scheme: light)", variant(params, "light")]);
  }

  const attr = escapeMarkup;
  return [
    `<a href="${attr(edit)}">`,
    "  <picture>",
    ...sources.map(([media, p]) => `    <source media="${media}" srcset="${attr(cardUrl(origin, p))}">`),
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
