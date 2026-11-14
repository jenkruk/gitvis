import type { ConnectRequest } from "@/adapters/connect";
import { createDefaultConfig, type VisualizationConfig } from "@/config/config";
import { GITVIS_REPO_URL } from "@/config/site";
import { type ColorMode, resolveTheme } from "@/theme/palettes";
import { PLATFORM_IDS, PLATFORMS } from "@/domain/types";
import { type CardParams, encodeCardParams } from "./card-params";
import { STUDIO_PATH } from "./studio-url";
import { escapeMarkup } from "./svg-markup";

export type ReadmeTheme = "selected" | "auto";

export function cardUrl(origin: string, params: CardParams): string {
  return `${origin}/api/card?${encodeCardParams(params)}`;
}

export function editUrl(origin: string, params: CardParams): string {
  return `${origin}${STUDIO_PATH}?${encodeCardParams(params)}`;
}

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

export function effectiveSnippetOptions(options: SnippetOptions, config: VisualizationConfig): SnippetOptions {
  return config.background === "transparent" ? { theme: "auto" } : options;
}

export function readmeSnippet(origin: string, params: CardParams, options: SnippetOptions): string {
  const image = imageSnippet(origin, params, effectiveSnippetOptions(options, params.config));
  return `${image}\n\n${linksSnippet(origin, params)}`;
}

export type LabelTarget = { cta: true } | { repo: true } | { gitlab: string };

export const LABEL_VERSION = "2";

export function labelUrl(
  origin: string,
  target: LabelTarget,
  mode: ColorMode,
  {
    inset = false,
    color,
    span = "half",
    line = false,
  }: { inset?: boolean; color?: string; span?: "half" | "full"; line?: boolean } = {},
): string {
  const query = new URLSearchParams(
    "cta" in target ? { cta: "1" } : "repo" in target ? { repo: "1" } : { gitlab: target.gitlab },
  );
  query.set("mode", mode);
  if (span !== "half") query.set("span", span);
  if (color) query.set("color", color.replace("#", "").toLowerCase());
  if (inset) query.set("inset", "1");
  if (line) query.set("line", "1");
  query.set("v", LABEL_VERSION);
  return `${origin}/api/label?${query}`;
}

export function linkColor(config: VisualizationConfig, mode: ColorMode): string {
  const custom = config.platformColors.gitlab;
  return resolveTheme(config.palette, mode, custom ? { series: [undefined, custom] } : {}).series[1];
}

function linksSnippet(origin: string, params: CardParams): string {
  const attr = escapeMarkup;
  const url = (target: LabelTarget, mode: ColorMode) =>
    labelUrl(origin, target, mode, { line: true, color: linkColor(params.config, mode) });
  const label = (href: string, target: LabelTarget, alt: string) =>
    `<a href="${attr(href)}"><picture>` +
    `<source media="(prefers-color-scheme: dark)" srcset="${attr(url(target, "dark"))}">` +
    `<img alt="${attr(alt)}" src="${attr(url(target, "light"))}">` +
    `</picture></a>`;
  const links =
    label(origin, { cta: true }, "Get Yours") + label(GITVIS_REPO_URL, { repo: true }, "Open source on GitHub");
  return ['<p align="center">', `  ${links}`, "</p>"].join("\n");
}

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

export function studioSearch(request: ConnectRequest | null, config: VisualizationConfig): string {
  if (request) return encodeCardParams({ request, config }).toString();
  const design = encodeCardParams({ request: {}, config }).toString();
  return design === encodeCardParams({ request: {}, config: createDefaultConfig() }).toString() ? "" : design;
}
