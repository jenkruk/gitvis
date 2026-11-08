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
  /**
   * Add real Markdown profile links under the image. Links drawn inside an SVG
   * don't work when GitHub shows it as an <img>; these do.
   */
  profileLinks?: boolean;
}

/** Transparent graphics must follow the reader's theme, or light text would sit on a light page (and vice versa). */
export function effectiveSnippetOptions(options: SnippetOptions, config: VisualizationConfig): SnippetOptions {
  return config.background === "transparent" ? { ...options, theme: "auto" } : options;
}

/** "[GitHub @user](https://github.com/user) · [GitLab @user](…)" for connected platforms. */
export function profileLinksLine(request: ConnectRequest): string {
  return PLATFORM_IDS.filter((p) => request[p])
    .map((p) => `[${PLATFORMS[p].label} @${request[p]}](${PLATFORMS[p].profileUrl(request[p]!)})`)
    .join(" · ");
}

/** Below this viewport width readers get the compact image (GitHub's mobile layout). */
export const NARROW_MEDIA = "(max-width: 600px)";

/**
 * The README snippet. Without options it is a plain Markdown image, which GitHub
 * itself links to the image (opening in a new tab). Theme matching and/or a
 * mobile image need an HTML <picture>; the first matching <source> wins, so
 * narrow-screen sources come first. GitHub doesn't link a <picture>, so it is
 * wrapped in a link to the card image.
 *
 * Never links to the studio: readers clicking a card want the accounts, not our
 * editor. Opened on its own, the card's GitHub/GitLab labels and avatars are
 * real links to the profiles (GitHub's image proxy serves SVGs without a
 * sandbox, verified November 2026); `profileLinks` adds README text links too.
 */
export function readmeSnippet(origin: string, params: CardParams, options: SnippetOptions): string {
  const image = imageSnippet(origin, params, effectiveSnippetOptions(options, params.config));
  // A blank line ends an HTML block in GitHub Markdown, so the links line renders as Markdown.
  // "Get yours!" here is the README's clickable way to GitVis (links inside the image can't be clicked there).
  return options.profileLinks ? `${image}\n\n${profileLinksLine(params.request)} · [Get yours!](${origin})` : image;
}

function imageSnippet(origin: string, params: CardParams, { theme, responsive }: SnippetOptions): string {
  const alt = altText(params.request);
  if (theme === "selected" && !responsive) return `![${alt}](${cardUrl(origin, params)})`;

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
    `<a href="${attr(cardUrl(origin, params))}">`,
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
