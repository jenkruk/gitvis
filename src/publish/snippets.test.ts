import { describe, expect, it } from "vitest";
import { createDefaultConfig } from "@/config/config";
import { decodeCardParams } from "./card-params";
import { GITVIS_REPO_URL } from "@/config/site";
import { resolveTheme } from "@/theme/palettes";
import {
  altText,
  cardUrl,
  downloadName,
  editUrl,
  effectiveSnippetOptions,
  LABEL_VERSION,
  labelUrl,
  linkColor,
  readmeSnippet,
  type SnippetOptions,
} from "./snippets";

const origin = "https://gitvis.example";
const params = { request: { github: "jenkruk", gitlab: "contactkruk" }, config: createDefaultConfig() };
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
    expect(html).not.toMatch(/&(?!amp;)/);
    expect(html.startsWith('<p align="center">\n  <picture>')).toBe(true);
  });

  it("names downloads after the accounts", () => {
    expect(downloadName(params.request, "png")).toBe("gitvis-jenkruk-contactkruk.png");
    expect(downloadName({ gitlab: "contactkruk" }, "svg")).toBe("gitvis-contactkruk.svg");
  });
});

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
    expect(block.tagName).toBe("P");
    expect(block.getAttribute("align")).toBe("center");
    const picture = block.firstElementChild!;
    expect(picture.tagName).toBe("PICTURE");
    const children = [...picture.children];
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
      expect(url.searchParams.has("size")).toBe(false);
    }

    const img = children.at(-1)!;
    const fallback = new URL(img.getAttribute("src")!);
    expect(fallback.searchParams.has("size")).toBe(false);
    expect(fallback.searchParams.get("mode")).toBe(params.config.mode);
    expect(img.getAttribute("alt")).toBe(altText(params.request));
  });
});

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
  const urls = (snippet: string) =>
    [...links(snippet).querySelectorAll("img, source")].map(
      (el) => new URL((el.getAttribute("src") ?? el.getAttribute("srcset"))!).searchParams,
    );

  it("has two links on one centered line: 'Get Yours' (left) and 'Open source on GitHub' (right)", () => {
    const snippet = readmeSnippet(origin, params, { theme: "selected" });
    const body = links(snippet);
    const line = body.firstElementChild!;
    expect(line.tagName).toBe("P");
    expect(line.getAttribute("align")).toBe("center");
    const anchors = [...line.querySelectorAll("a")].map((a) => ({
      href: a.getAttribute("href"),
      alt: a.querySelector("picture > img")!.getAttribute("alt"),
      media: a.querySelector("source")!.getAttribute("media"),
    }));
    expect(anchors).toEqual([
      { href: "https://gitvis.example", alt: "Get Yours", media: "(prefers-color-scheme: dark)" },
      { href: GITVIS_REPO_URL, alt: "Open source on GitHub", media: "(prefers-color-scheme: dark)" },
    ]);
    expect(snippet).not.toContain("gitlab.com");
    expect(snippet).not.toContain('github.com/jenkruk"');
    expect(snippet).toMatch(/<\/picture><\/a><a href="https:\/\/github\.com\/jenkruk\/gitvis">/);
    expect(snippet).not.toMatch(/<a [^>]*>\s+<|>\s+<\/a>/);
    for (const el of body.querySelectorAll("*")) {
      for (const attr of el.getAttributeNames()) expect(GITHUB_ALLOWED_LINKS[el.tagName]).toContain(attr);
    }
  });

  it("is the 'Get Yours · open source on GitHub' line under the credit, versioned, for every background", () => {
    for (const background of ["solid", "gradient", "transparent"] as const) {
      const design = { ...params, config: { ...params.config, background } };
      const all = urls(readmeSnippet(origin, design, { theme: "auto" }));
      expect(all.map((q) => (q.get("cta") ? "cta" : q.get("repo") ? "repo" : "?"))).toEqual([
        "cta",
        "cta",
        "repo",
        "repo",
      ]);
      for (const q of all) {
        expect(q.get("line")).toBe("1");
        expect(q.get("v")).toBe(LABEL_VERSION);
      }
    }
  });

  it("is separated from the image by a blank line", () => {
    const snippet = readmeSnippet(origin, params, { theme: "auto" });
    expect(snippet).toMatch(/<\/picture>\n<\/p>\n\n<p align="center">/);
    expect(snippet.match(/<a /g)).toHaveLength(2);
  });

  it("builds versioned label URLs for fixed text or a username only", () => {
    expect(labelUrl(origin, { gitlab: "a.b_c" }, "dark")).toBe(
      `https://gitvis.example/api/label?gitlab=a.b_c&mode=dark&v=${LABEL_VERSION}`,
    );
    expect(labelUrl(origin, { repo: true }, "light", { line: true, color: "#5BAE9E" })).toBe(
      `https://gitvis.example/api/label?repo=1&mode=light&color=5bae9e&line=1&v=${LABEL_VERSION}`,
    );
  });

  it("uses the graphic's GitLab color, per reader theme", () => {
    const custom = { ...params, config: { ...params.config, platformColors: { gitlab: "#5bae9e" } } };
    for (const q of urls(readmeSnippet(origin, custom, { theme: "auto" }))) {
      expect(q.get("color")).toBe(linkColor(custom.config, q.get("mode") as "dark" | "light").slice(1));
    }
    expect(linkColor(custom.config, "dark")).toBe("#5bae9e");
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
