import type { ConnectRequest } from "@/adapters/connect";
import { createDefaultConfig, type VisualizationConfig } from "@/config/config";
import { GITVIS_REPO_URL } from "@/config/site";
import { type ColorMode, resolveTheme } from "@/theme/palettes";
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

function variant(params: CardParams, mode: ColorMode): CardParams {
  return { ...params, config: { ...params.config, mode } };
}

export interface SnippetOptions {
  theme: ReadmeTheme;
}

/** Transparent graphics must follow the reader's theme, or light text would sit on a light page (and vice versa). */
export function effectiveSnippetOptions(options: SnippetOptions, config: VisualizationConfig): SnippetOptions {
  return config.background === "transparent" ? { theme: "auto" } : options;
}

/**
 * The README snippet: the card as an unlinked image, then its only links:
 * "Get Yours" right under the card's credit line and, on the same line,
 * "Open source on GitHub" (the GitVis repo).
 *
 * The image is always an HTML <picture>: GitHub links a plain Markdown image to
 * itself, but leaves a <picture> unlinked (verified November 2026). The graphic
 * itself contains no links either. GitHub strips `target`, so the links open in
 * the same tab.
 */
export function readmeSnippet(origin: string, params: CardParams, options: SnippetOptions): string {
  const image = imageSnippet(origin, params, effectiveSnippetOptions(options, params.config));
  // A blank line ends the card's HTML block; the links are their own block.
  return `${image}\n\n${linksSnippet(origin, params)}`;
}

export type LabelTarget = { cta: true } | { repo: true } | { gitlab: string };

/** GitVis's image of a link's text, in GitHub's dark or light theme (see /api/label). */
export function labelUrl(
  origin: string,
  target: LabelTarget,
  mode: ColorMode,
  { inset = false, color, span = "half" }: { inset?: boolean; color?: string; span?: "half" | "full" } = {},
): string {
  const query = new URLSearchParams(
    "cta" in target ? { cta: "1" } : "repo" in target ? { repo: "1" } : { gitlab: target.gitlab },
  );
  query.set("mode", mode);
  if (span !== "half") query.set("span", span);
  if (color) query.set("color", color.replace("#", "").toLowerCase());
  if (inset) query.set("inset", "1");
  return `${origin}/api/label?${query}`;
}

/** The design's GitLab color in each theme (the palette's, or the user's custom color). */
export function linkColor(config: VisualizationConfig, mode: ColorMode): string {
  const custom = config.platformColors.gitlab;
  return resolveTheme(config.palette, mode, custom ? { series: [undefined, custom] } : {}).series[1];
}

/**
 * One line under the card, exactly as wide as it: "Get Yours" starting right
 * under the card's "Made with GitVis" credit, and "Open source on GitHub" (the
 * GitVis repo) ending at the card's right content edge. GitHub keeps no widths,
 * colors or padding in READMEs, so both are images GitVis draws, each half the
 * card's width with its text inset by the card's padding, in the card's GitLab
 * color; side by side and centered (like the card) they span exactly the card.
 * README columns narrower than the card stack them. Alt text is each link's text.
 * No whitespace between or inside the links (it would render as gaps or
 * underlined spaces).
 */
function linksSnippet(origin: string, params: CardParams): string {
  const attr = escapeMarkup;
  // The links use the graphic's GitLab color, in the reader's theme.
  const url = (target: LabelTarget, mode: ColorMode) =>
    labelUrl(origin, target, mode, { inset: true, color: linkColor(params.config, mode) });
  const label = (href: string, target: LabelTarget, alt: string) =>
    `<a href="${attr(href)}"><picture>` +
    `<source media="(prefers-color-scheme: dark)" srcset="${attr(url(target, "dark"))}">` +
    `<img alt="${attr(alt)}" src="${attr(url(target, "light"))}">` +
    `</picture></a>`;
  const links =
    label(origin, { cta: true }, "Get Yours") + label(GITVIS_REPO_URL, { repo: true }, "Open source on GitHub");
  return ['<p align="center">', `  ${links}`, "</p>"].join("\n");
}

/**
 * Always the full 840px image, centered (GitHub scales it to fit narrow screens). Phone
 * images aren't offered: GitHub's <themed-picture> rewrites theme media queries
 * for signed-in readers and drops width conditions, which served the phone image
 * on desktops (verified Nov 2026). `size=compact` URLs still render for old links.
 */
function imageSnippet(origin: string, params: CardParams, { theme }: SnippetOptions): string {
  const alt = altText(params.request);
  const sources: [media: string, params: CardParams][] =
    theme === "auto"
      ? [
          ["(prefers-color-scheme: dark)", variant(params, "dark")],
          ["(prefers-color-scheme: light)", variant(params, "light")],
        ]
      : [];

  const attr = escapeMarkup;
  // Centered, like the links line below it, so the two always line up.
  return [
    '<p align="center">',
    "  <picture>",
    ...sources.map(([media, p]) => `    <source media="${media}" srcset="${attr(cardUrl(origin, p))}">`),
    `    <img alt="${attr(alt)}" src="${attr(cardUrl(origin, params))}">`,
    "  </picture>",
    "</p>",
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
