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
    expect(readmeSnippet(origin, params, "selected")).toBe(
      `[![${altText(params.request)}](${cardUrl(origin, params)})](${editUrl(origin, params)})`,
    );
  });

  it("produces a theme-matching <picture> with escaped URLs", () => {
    const html = readmeSnippet(origin, params, "auto");
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
