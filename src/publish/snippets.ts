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

/** Transparent graphics must follow the reader's theme, or light text would sit on a light page (and vice versa). */
export function effectiveSnippetOptions(options: SnippetOptions, config: VisualizationConfig): SnippetOptions {
  return config.background === "transparent" ? { ...options, theme: "auto" } : options;
}

/** Below this viewport width readers get the compact image (GitHub's mobile layout). */
export const NARROW_MEDIA = "(max-width: 600px)";

/**
 * The README snippet: the card as an unlinked image, then the only two links —
 * "Get yours!" (left) and the user's GitLab profile (right, when a GitLab
 * account is connected). The README lives on GitHub, so there's no GitHub link.
 *
 * The image is always an HTML <picture>: GitHub links a plain Markdown image to
 * itself, but leaves a <picture> unlinked (verified November 2026). The first
 * matching <source> wins, so narrow-screen sources come first. The graphic itself
 * contains no links either. GitHub strips link colors and `target`, so these links
 * use GitHub's own style and open in the same tab.
 */
export function readmeSnippet(origin: string, params: CardParams, options: SnippetOptions): string {
  const image = imageSnippet(origin, params, effectiveSnippetOptions(options, params.config));
  // A blank line ends the <picture> HTML block; the links are their own block.
  return `${image}\n\n${linksSnippet(origin, params.request)}`;
}

/** "Get yours!" on the left; the GitLab profile link right-aligned below it, when there is one. */
function linksSnippet(origin: string, request: ConnectRequest): string {
  const attr = escapeMarkup;
  const lines = [`<p align="left"><a href="${attr(origin)}">Get yours!</a></p>`];
  if (request.gitlab) {
    const label = `${PLATFORMS.gitlab.label} @${request.gitlab}`;
    lines.push(
      `<p align="right"><a href="${attr(PLATFORMS.gitlab.profileUrl(request.gitlab))}">${attr(label)}</a></p>`,
    );
  }
  return lines.join("\n");
}

function imageSnippet(origin: string, params: CardParams, { theme, responsive }: SnippetOptions): string {
  const alt = altText(params.request);
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
    "<picture>",
    ...sources.map(([media, p]) => `  <source media="${media}" srcset="${attr(cardUrl(origin, p))}">`),
    `  <img alt="${attr(alt)}" src="${attr(cardUrl(origin, params))}">`,
    "</picture>",
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
