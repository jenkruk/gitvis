import { describe, expect, it } from "vitest";
import { createDefaultConfig } from "@/config/config";
import { decodeCardParams } from "./card-params";
import { altText, cardUrl, downloadName, editUrl, readmeSnippet } from "./snippets";

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
