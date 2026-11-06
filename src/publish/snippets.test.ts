import { describe, expect, it } from "vitest";
import { createDefaultConfig } from "@/config/config";
import { decodeCardParams } from "./card-params";
import { altText, cardUrl, downloadName, editUrl, readmeSnippet, type SnippetOptions } from "./snippets";

const origin = "https://gitvis.example";
const params = { request: { github: "jenkruk", gitlab: "contactkruk" }, config: createDefaultConfig() };

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

  it("produces a linked Markdown image for the selected mode", () => {
    expect(readmeSnippet(origin, params, { theme: "selected", responsive: false })).toBe(
      `[![${altText(params.request)}](${cardUrl(origin, params)})](${editUrl(origin, params)})`,
    );
  });

  it("serves the compact image to narrow screens first when responsive", () => {
    const html = readmeSnippet(origin, params, { theme: "selected", responsive: true });
    const sources = [...html.matchAll(/<source media="([^"]+)" srcset="([^"]+)"/g)];
    expect(sources.map((s) => s[1])).toEqual(["(max-width: 600px)"]);
    expect(sources[0]![2]).toContain("size=compact");
    expect(html).toMatch(/<img alt="[^"]+" src="[^"]*mode=dark[^"]*">/);
    expect(html).not.toMatch(/<img[^>]*size=compact/);
  });

  it("orders narrow + theme sources so the first match is always right", () => {
    const html = readmeSnippet(origin, params, { theme: "auto", responsive: true });
    expect([...html.matchAll(/<source media="([^"]+)"/g)].map((s) => s[1])).toEqual([
      "(max-width: 600px) and (prefers-color-scheme: dark)",
      "(max-width: 600px) and (prefers-color-scheme: light)",
      "(prefers-color-scheme: dark)",
      "(prefers-color-scheme: light)",
    ]);
  });

  it("produces a theme-matching <picture> with escaped URLs", () => {
    const html = readmeSnippet(origin, params, { theme: "auto", responsive: false });
    expect(html).toContain(
      '<source media="(prefers-color-scheme: dark)" srcset="https://gitvis.example/api/card?v=1&amp;',
    );
    expect(html).toMatch(/prefers-color-scheme: dark\)" srcset="[^"]*mode=dark/);
    expect(html).toMatch(/prefers-color-scheme: light\)" srcset="[^"]*mode=light/);
    expect(html).toContain(`<img alt="${altText(params.request)}"`);
    expect(html).not.toMatch(/&(?!amp;)/); // every & is escaped inside HTML attributes
    expect(html.startsWith('<a href="https://gitvis.example/?v=1&amp;')).toBe(true);
  });

  it("names downloads after the accounts", () => {
    expect(downloadName(params.request, "png")).toBe("gitvis-jenkruk-contactkruk.png");
    expect(downloadName({ gitlab: "contactkruk" }, "svg")).toBe("gitvis-contactkruk.svg");
  });
});

/** Attributes GitHub's README HTML sanitizer keeps on these elements (others are stripped). */
const GITHUB_ALLOWED: Record<string, string[]> = {
  A: ["href"],
  PICTURE: [],
  SOURCE: ["media", "srcset"],
  IMG: ["alt", "src"],
};

describe("README <picture> markup audit", () => {
  const variants: SnippetOptions[] = [
    { theme: "selected", responsive: true },
    { theme: "auto", responsive: false },
    { theme: "auto", responsive: true },
  ];

  it.each(variants)("is valid, GitHub-safe and accessible for %o", (options) => {
    const html = readmeSnippet(origin, params, options);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const link = doc.body.firstElementChild!;
    expect(link.tagName).toBe("A");
    expect(link.children).toHaveLength(1);

    const picture = link.firstElementChild!;
    expect(picture.tagName).toBe("PICTURE");
    const children = [...picture.children];
    // HTML content model: zero or more <source>, then exactly one <img>, last.
    expect(children.at(-1)!.tagName).toBe("IMG");
    expect(children.slice(0, -1).every((c) => c.tagName === "SOURCE")).toBe(true);
    expect(children.length).toBeGreaterThan(1);

    for (const el of [link, picture, ...children]) {
      for (const attr of el.getAttributeNames()) expect(GITHUB_ALLOWED[el.tagName]).toContain(attr);
    }

    for (const source of children.slice(0, -1)) {
      expect(source.getAttribute("media")).toMatch(/^\((max-width: 600px|prefers-color-scheme: (light|dark))\)/);
      const url = new URL(source.getAttribute("srcset")!);
      expect(url.origin).toBe(origin);
      expect(url.pathname).toBe("/api/card");
      expect(decodeCardParams(url.searchParams).issues).toEqual([]);
      // Narrow-screen sources serve the compact image; others the full image.
      expect(url.searchParams.get("size") === "compact").toBe(source.getAttribute("media")!.includes("max-width"));
    }

    // Fallback <img>: full-size image in the selected mode (for clients that ignore <source>).
    const img = children.at(-1)!;
    const fallback = new URL(img.getAttribute("src")!);
    expect(fallback.searchParams.has("size")).toBe(false);
    expect(fallback.searchParams.get("mode")).toBe(params.config.mode);
    expect(img.getAttribute("alt")).toBe(altText(params.request));
    expect(new URL(link.getAttribute("href")!).pathname).toBe("/");
  });

  it("makes every media query that could match a phone resolve to the compact image first", () => {
    const html = readmeSnippet(origin, params, { theme: "auto", responsive: true });
    const doc = new DOMParser().parseFromString(html, "text/html");
    const sources = [...doc.querySelectorAll("source")].map((s) => ({
      media: s.getAttribute("media")!,
      compact: new URL(s.getAttribute("srcset")!).searchParams.get("size") === "compact",
    }));
    const firstMatch = (narrow: boolean, dark: boolean) =>
      sources.find(
        ({ media }) =>
          (!media.includes("max-width") || narrow) &&
          (!media.includes("prefers-color-scheme") || media.includes(dark ? "dark" : "light")),
      )!;
    expect(firstMatch(true, true).compact).toBe(true);
    expect(firstMatch(true, false).compact).toBe(true);
    expect(firstMatch(false, true)).toMatchObject({ compact: false, media: "(prefers-color-scheme: dark)" });
    expect(firstMatch(false, false)).toMatchObject({ compact: false, media: "(prefers-color-scheme: light)" });
  });
});

describe("Phase 4 snippet options", () => {
  it("adds clickable Markdown profile links after the image", () => {
    const md = readmeSnippet(origin, params, { theme: "selected", responsive: false, profileLinks: true });
    expect(md.split("\n\n")[1]).toBe(
      "[GitHub @jenkruk](https://github.com/jenkruk) · [GitLab @contactkruk](https://gitlab.com/contactkruk)",
    );
  });

  it("separates the links from a <picture> block with a blank line so GitHub renders them as Markdown", () => {
    const html = readmeSnippet(origin, params, { theme: "auto", responsive: true, profileLinks: true });
    expect(html).toMatch(/<\/a>\n\n\[GitHub @jenkruk\]/);
  });

  it("forces theme matching for transparent backgrounds", () => {
    const transparent = { ...params, config: { ...params.config, background: "transparent" as const } };
    const html = readmeSnippet(origin, transparent, { theme: "selected", responsive: false });
    expect(html).toContain("prefers-color-scheme: dark");
    expect(html).toContain("prefers-color-scheme: light");
  });
});
