import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { LINK_LABEL_INSET, LinkLabel } from "@/renderers/LinkLabel";
import { contrastRatio } from "@/theme/color";
import { renderSvgMarkup } from "@/publish/svg-markup";
import { GET } from "./route";

let ip = 0;
const get = (query: string) =>
  GET(new NextRequest(`http://localhost/api/label?${query}`, { headers: { "x-forwarded-for": `198.51.100.${++ip}` } }));
const textOf = (svg: string) => /<text ([^>]*)>([^<]*)<\/text>/.exec(svg)!;
const attr = (attrs: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(attrs)?.[1];
const width = (svg: string) => Number(/^<svg [^>]*width="(\d+)"/.exec(svg)![1]);

describe("GET /api/label", () => {
  it("draws the GitLab link: smaller, no underline, right-aligned, GitHub's link blue by default", async () => {
    const res = await get("gitlab=contactkruk&mode=dark");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml; charset=utf-8");
    const svg = await res.text();
    expect(svg).toMatch(
      /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*role="img" aria-label="GitLab @contactkruk"/,
    );
    const [, attrs, text] = textOf(svg);
    expect(text).toBe("GitLab @contactkruk");
    expect(attr(attrs!, "font-size")).toBe("13");
    expect(attr(attrs!, "fill")).toBe("#4493f8");
    expect(attr(attrs!, "text-decoration")).toBeUndefined();
    expect(attr(attrs!, "text-anchor")).toBe("end");
    expect(Number(attr(attrs!, "x"))).toBe(width(svg)); // flush with the right edge
    expect(svg).not.toMatch(/<a |<script|href=/);
  });

  it("draws 'Get Yours' larger than the GitLab link, left-aligned, in GitHub's light-theme link blue", async () => {
    const svg = await (await get("cta=1&mode=light")).text();
    const [, attrs, text] = textOf(svg);
    expect(text).toBe("Get Yours");
    expect(Number(attr(attrs!, "font-size"))).toBeGreaterThan(13);
    expect(attr(attrs!, "fill")).toBe("#0969da");
    expect(attr(attrs!, "text-anchor")).toBe("start");
    expect(attr(attrs!, "x")).toBe("0");
  });

  it("uses the requested color, adjusted to stay readable (4.5:1) on GitHub's page", async () => {
    const fill = async (query: string) => attr(textOf(await (await get(query)).text())[1]!, "fill")!;
    // Readable as given: used exactly.
    expect(await fill("cta=1&mode=dark&color=5bae9e")).toBe("#5bae9e");
    // Too dark for GitHub's dark page / too light for its light page: nudged until readable.
    for (const [query, background] of [
      ["cta=1&mode=dark&color=203040", "#0d1117"],
      ["gitlab=contactkruk&mode=light&color=a0d8ef", "#ffffff"],
    ] as const) {
      expect(contrastRatio(await fill(query), background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("draws 'Open source on GitHub' like the GitLab label: smaller, at the right edge", async () => {
    const svg = await (await get("repo=1&mode=dark")).text();
    const [, attrs, text] = textOf(svg);
    expect(text).toBe("Open source on GitHub");
    expect(attr(attrs!, "font-size")).toBe("13");
    expect(attr(attrs!, "text-anchor")).toBe("end");
  });

  it("draws the 'Get Yours · open source on GitHub' line: together exactly the card's width", async () => {
    const cta = await (await get("cta=1&mode=dark&line=1&v=2")).text();
    const repo = await (await get("repo=1&mode=dark&line=1&v=2")).text();
    expect(width(cta) + width(repo)).toBe(840);
    // "Get Yours" starts where the credit does (the card's padding); the second link follows right after it.
    expect(attr(textOf(cta)[1]!, "x")).toBe(String(LINK_LABEL_INSET));
    expect(width(cta)).toBeLessThan(LINK_LABEL_INSET + 90);
    const [, repoAttrs, repoText] = textOf(repo);
    expect(repoText).toBe("· open source on GitHub");
    expect(attr(repoAttrs!, "text-anchor")).toBe("start");
    expect(Number(attr(repoAttrs!, "x"))).toBeLessThan(10);
    expect(Number(attr(repoAttrs!, "font-size"))).toBeLessThan(16); // smaller than "Get Yours"
  });

  it("is half the card's width by default, and the full width with span=full", async () => {
    expect(width(await (await get("gitlab=contactkruk&mode=dark")).text())).toBe(420);
    expect(width(await (await get("cta=1&mode=dark")).text())).toBe(420);
    expect(width(await (await get("cta=1&mode=dark&span=full")).text())).toBe(840);
  });

  it("insets the text by the card's padding for transparent cards", async () => {
    const gitlab = await (await get("gitlab=contactkruk&mode=dark&inset=1")).text();
    expect(Number(attr(textOf(gitlab)[1]!, "x"))).toBe(width(gitlab) - LINK_LABEL_INSET);
    const cta = await (await get("cta=1&mode=dark&inset=1")).text();
    expect(Number(attr(textOf(cta)[1]!, "x"))).toBe(LINK_LABEL_INSET);
  });

  it("is cached for a long time and locked down", async () => {
    const res = await get("gitlab=contactkruk&mode=dark");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe("public, s-maxage=31536000");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Content-Security-Policy")).toContain("sandbox");
  });

  it.each([
    "",
    "gitlab=",
    "gitlab=bad..name&mode=dark",
    "gitlab=contactkruk&mode=sepia",
    "gitlab=%3Cscript%3E",
    "cta=1&gitlab=contactkruk",
    "cta=yes",
    "gitlab=contactkruk&inset=24",
    "text=anything",
    "cta=1&color=%23ff0000",
    "cta=1&color=red",
    "cta=1&span=quarter",
    "cta=1&repo=1",
    "repo=1&gitlab=contactkruk",
    "repo=yes",
    "gitlab=contactkruk&line=1",
    "cta=1&line=yes",
    "cta=1&v=latest",
  ])("rejects %s (no free text, one label per URL)", async (query) => {
    const res = await get(query);
    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("serializes the same markup as React", () => {
    for (const element of [
      <LinkLabel key="g" kind="gitlab" text="GitLab @a.b_c" mode="light" color="#5bae9e" inset />,
      <LinkLabel key="c" kind="cta" text="Get Yours" mode="dark" />,
    ]) {
      expect(renderSvgMarkup(element)).toBe(renderToStaticMarkup(element));
    }
  });
});
