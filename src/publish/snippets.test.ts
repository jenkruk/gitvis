import { describe, expect, it } from "vitest";
import { createDefaultConfig } from "@/config/config";
import { decodeCardParams } from "./card-params";
import { resolveTheme } from "@/theme/palettes";
import {
  altText,
  cardUrl,
  downloadName,
  editUrl,
  effectiveSnippetOptions,
  labelUrl,
  linkColor,
  readmeSnippet,
  type SnippetOptions,
} from "./snippets";

const origin = "https://gitvis.example";
const params = { request: { github: "jenkruk", gitlab: "contactkruk" }, config: createDefaultConfig() };
/** The card image block (the snippet's first paragraph; the links follow after a blank line). */
const card = (snippet: string) => snippet.split("\n\n")[0]!;

describe("publish snippets", () => {
  it("builds card and edit URLs that decode back to the same design", () => {
    const card = new URL(cardUrl(origin, params));
    const edit = new URL(editUrl(origin, params));
    expect(card.pathname).toBe("/api/card");
    expect(edit.pathname).toBe("/");
    for (const url of [card, edit]) {
      expect(decodeCardParams(url.searchParams)).toEqual({ ...params, issues: [] });
    }
  });

  it("writes descriptive alt text for each platform combination", () => {
    expect(altText({ github: "jenkruk" })).toBe("GitVis contribution activity for GitHub @jenkruk");
    expect(altText({ gitlab: "contactkruk" })).toBe("GitVis contribution activity for GitLab @contactkruk");
    expect(altText(params.request)).toBe("GitVis contribution activity for GitHub @jenkruk and GitLab @contactkruk");
  });

  it("always uses an unlinked <picture>, even without variants (GitHub would link a Markdown image)", () => {
    const md = readmeSnippet(origin, params, { theme: "selected" });
    expect(md.split("\n\n")[0]).toBe(
      `<p align="center">\n  <picture>\n    <img alt="${altText(params.request)}" src="${cardUrl(origin, params).replaceAll("&", "&amp;")}">\n  </picture>\n</p>`,
    );
    expect(md).not.toContain("![");
    expect(md).not.toContain(editUrl(origin, params).replaceAll("&", "&amp;"));
  });

  it("always serves the full image: no phone or tablet variants, in either theme option", () => {
    for (const theme of ["selected", "auto"] as const) {
      const html = card(readmeSnippet(origin, params, { theme }));
      expect(html).not.toContain("size=compact");
      expect(html).not.toContain("max-width");
    }
    // Transparent cards always match the reader's theme.
    const transparent = { ...params.config, background: "transparent" as const };
    expect(effectiveSnippetOptions({ theme: "selected" }, transparent)).toEqual({ theme: "auto" });
  });

  it("produces a theme-matching <picture> with escaped URLs", () => {
    const html = readmeSnippet(origin, params, { theme: "auto" });
    expect(html).toContain(
      '<source media="(prefers-color-scheme: dark)" srcset="https://gitvis.example/api/card?v=1&amp;',
    );
    expect(html).toMatch(/prefers-color-scheme: dark\)" srcset="[^"]*mode=dark/);
    expect(html).toMatch(/prefers-color-scheme: light\)" srcset="[^"]*mode=light/);
    expect(html).toContain(`<img alt="${altText(params.request)}"`);
    expect(html).not.toMatch(/&(?!amp;)/); // every & is escaped inside HTML attributes
    expect(html.startsWith('<p align="center">\n  <picture>')).toBe(true); // centered, not wrapped in a link
  });

  it("names downloads after the accounts", () => {
    expect(downloadName(params.request, "png")).toBe("gitvis-jenkruk-contactkruk.png");
    expect(downloadName({ gitlab: "contactkruk" }, "svg")).toBe("gitvis-contactkruk.svg");
  });
});

/** Attributes GitHub's README HTML sanitizer keeps on these elements (others are stripped). */
const GITHUB_ALLOWED: Record<string, string[]> = {
  P: ["align"],
  A: ["href"],
  PICTURE: [],
  SOURCE: ["media", "srcset"],
  IMG: ["alt", "src"],
};

describe("README <picture> markup audit", () => {
  const variants: SnippetOptions[] = [{ theme: "selected" }, { theme: "auto" }];

  it.each(variants)("is valid, GitHub-safe and accessible for %o", (options) => {
    const html = readmeSnippet(origin, params, options);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const block = doc.body.firstElementChild!;
    expect(block.tagName).toBe("P"); // centered, like the links line
    expect(block.getAttribute("align")).toBe("center");
    const picture = block.firstElementChild!;
    expect(picture.tagName).toBe("PICTURE"); // unlinked: clicking the image does nothing
    const children = [...picture.children];
    // HTML content model: zero or more <source>, then exactly one <img>, last.
    expect(children.at(-1)!.tagName).toBe("IMG");
    expect(children.slice(0, -1).every((c) => c.tagName === "SOURCE")).toBe(true);

    for (const el of [block, picture, ...children]) {
      for (const attr of el.getAttributeNames()) expect(GITHUB_ALLOWED[el.tagName]).toContain(attr);
    }

    for (const source of children.slice(0, -1)) {
      expect(source.getAttribute("media")).toMatch(/^\(prefers-color-scheme: (light|dark)\)$/);
      const url = new URL(source.getAttribute("srcset")!);
      expect(url.origin).toBe(origin);
      expect(url.pathname).toBe("/api/card");
      expect(decodeCardParams(url.searchParams).issues).toEqual([]);
      expect(url.searchParams.has("size")).toBe(false); // always the full image
    }

    // Fallback <img>: full-size image in the selected mode (for clients that ignore <source>).
    const img = children.at(-1)!;
    const fallback = new URL(img.getAttribute("src")!);
    expect(fallback.searchParams.has("size")).toBe(false);
    expect(fallback.searchParams.get("mode")).toBe(params.config.mode);
    expect(img.getAttribute("alt")).toBe(altText(params.request));
  });
});

/** Attributes GitHub keeps on the link block's elements. */
const GITHUB_ALLOWED_LINKS: Record<string, string[]> = {
  P: ["align"],
  A: ["href"],
  PICTURE: [],
  SOURCE: ["media", "srcset"],
  IMG: ["alt", "src"],
};

describe("links under the image", () => {
  const links = (snippet: string) => {
    const [, block] = snippet.split("\n\n");
    return new DOMParser().parseFromString(block!, "text/html").body;
  };

  const labelLink = (a: Element) => ({
    href: a.getAttribute("href"),
    alt: a.querySelector("picture > img")!.getAttribute("alt"),
    light: a.querySelector("picture > img")!.getAttribute("src"),
    dark: a.querySelector("source")!.getAttribute("srcset"),
    media: a.querySelector("source")!.getAttribute("media"),
  });

  it("spans exactly the card: 'Get Yours' and the GitLab profile as half-width labels, centered like the card", () => {
    const snippet = readmeSnippet(origin, params, { theme: "selected" });
    const body = links(snippet);
    expect([...body.children].map((p) => p.tagName)).toEqual(["P"]); // one line
    const line = body.firstElementChild!;
    expect(line.getAttribute("align")).toBe("center");
    const [getYours, gitlab] = [...line.querySelectorAll(":scope > a")].map(labelLink);
    const color = (mode: "dark" | "light") => ({ color: linkColor(params.config, mode) });
    expect(getYours).toEqual({
      href: "https://gitvis.example",
      alt: "Get Yours",
      light: labelUrl(origin, { cta: true }, "light", color("light")),
      dark: labelUrl(origin, { cta: true }, "dark", color("dark")),
      media: "(prefers-color-scheme: dark)",
    });
    expect(gitlab).toEqual({
      href: "https://gitlab.com/contactkruk",
      alt: "GitLab @contactkruk",
      light: labelUrl(origin, { gitlab: "contactkruk" }, "light", color("light")),
      dark: labelUrl(origin, { gitlab: "contactkruk" }, "dark", color("dark")),
      media: "(prefers-color-scheme: dark)",
    });
    // Half-width labels (the default span); no whitespace between or inside the links (it would render as gaps).
    expect(snippet).not.toContain("span=");
    expect(snippet).toMatch(/<\/picture><\/a><a href="https:\/\/gitlab\.com/);
    expect(snippet).not.toMatch(/<a [^>]*>\s+<|>\s+<\/a>/);
    for (const el of body.querySelectorAll("*")) {
      for (const attr of el.getAttributeNames()) expect(GITHUB_ALLOWED_LINKS[el.tagName]).toContain(attr);
    }
  });

  it("lets 'Get Yours' span the whole card when there's no GitLab link", () => {
    const githubOnly = { ...params, request: { github: "jenkruk" } };
    const urls = [...links(readmeSnippet(origin, githubOnly, { theme: "auto" })).querySelectorAll("img, source")];
    expect(
      urls.map((el) => new URL((el.getAttribute("src") ?? el.getAttribute("srcset"))!).searchParams.get("span")),
    ).toEqual(["full", "full"]);
  });

  it("insets the labels to line up with a transparent card's content", () => {
    const transparent = { ...params, config: { ...params.config, background: "transparent" as const } };
    const srcs = [...links(readmeSnippet(origin, transparent, { theme: "auto" })).querySelectorAll("img, source")].map(
      (el) => el.getAttribute("src") ?? el.getAttribute("srcset"),
    );
    expect(srcs).toHaveLength(4);
    expect(srcs.every((url) => new URL(url!).searchParams.get("inset") === "1")).toBe(true);
    // Visible backgrounds: the card's border is at the image edge, so no inset.
    expect(readmeSnippet(origin, params, { theme: "auto" })).not.toContain("inset=1");
  });

  it("has no GitHub link (the README is on GitHub) and only 'Get Yours' without GitLab", () => {
    const githubOnly = { ...params, request: { github: "jenkruk" } };
    const snippet = readmeSnippet(origin, githubOnly, { theme: "auto" });
    expect(snippet).not.toContain("github.com");
    expect(snippet).not.toContain("gitlab");
    expect([...links(snippet).querySelectorAll("a")].map((a) => a.querySelector("img")!.getAttribute("alt"))).toEqual([
      "Get Yours",
    ]);
  });

  it("are the snippet's only links, separated from the image by a blank line", () => {
    const snippet = readmeSnippet(origin, params, { theme: "auto" });
    expect(snippet).toMatch(/<\/picture>\n<\/p>\n\n<p align="center">/);
    expect(snippet.match(/<a /g)).toHaveLength(2);
  });

  it("builds label URLs for fixed text or a username only", () => {
    expect(labelUrl(origin, { gitlab: "a.b_c" }, "dark")).toBe(
      "https://gitvis.example/api/label?gitlab=a.b_c&mode=dark",
    );
    expect(labelUrl(origin, { cta: true }, "light", { inset: true, color: "#5BAE9E" })).toBe(
      "https://gitvis.example/api/label?cta=1&mode=light&color=5bae9e&inset=1",
    );
  });

  it("colors both links with the graphic's GitLab color, per reader theme", () => {
    const custom = { ...params, config: { ...params.config, platformColors: { gitlab: "#5bae9e" } } };
    const urls = [...links(readmeSnippet(origin, custom, { theme: "auto" })).querySelectorAll("img, source")].map(
      (el) => new URL((el.getAttribute("src") ?? el.getAttribute("srcset"))!).searchParams,
    );
    expect(urls).toHaveLength(4);
    for (const q of urls) {
      expect(q.get("color")).toBe(linkColor(custom.config, q.get("mode") as "dark" | "light").slice(1));
    }
    // A custom GitLab color is used as given where it's readable on the card.
    expect(linkColor(custom.config, "dark")).toBe("#5bae9e");
    // Otherwise the palette's own GitLab color.
    expect(linkColor(params.config, "dark")).toBe(resolveTheme(params.config.palette, "dark").series[1]);
  });
});

describe("transparent backgrounds", () => {
  it("forces theme matching for transparent backgrounds", () => {
    const transparent = { ...params, config: { ...params.config, background: "transparent" as const } };
    const html = readmeSnippet(origin, transparent, { theme: "selected" });
    expect(html).toContain("prefers-color-scheme: dark");
    expect(html).toContain("prefers-color-scheme: light");
  });
});
