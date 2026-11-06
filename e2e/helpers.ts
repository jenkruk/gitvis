import AxeBuilder from "@axe-core/playwright";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { E2E_POLICY } from "../playwright.config";

export const UPSTREAM = "http://127.0.0.1:4010";
export const TTL_MS = E2E_POLICY.ttlSeconds * 1000;

export type UpstreamMode = "ok" | "fail" | "notfound";

/** Unique username per test so cache entries never collide (valid on both platforms). */
export function uniqueUser(label: string): string {
  return `e2e-${label}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
}

export async function upstream(
  request: APIRequestContext,
  user: string,
  settings: { mode?: UpstreamMode; count?: number },
) {
  const res = await request.post(`${UPSTREAM}/__control`, { data: { user, ...settings } });
  expect(res.ok()).toBe(true);
}

export async function hits(request: APIRequestContext, user: string): Promise<{ github: number; gitlab: number }> {
  return (await request.get(`${UPSTREAM}/__hits?user=${user}`)).json();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Waits until just after the next freshness-window boundary (windows are aligned to the epoch). */
export async function nextWindow(windows = 1) {
  const now = Date.now();
  const boundary = (Math.floor(now / TTL_MS) + windows) * TTL_MS;
  await sleep(boundary - now + 250);
}

/** Leaves at least `marginMs` before the current window ends, so paired requests share a window. */
export async function freshWindow(marginMs = 2_500) {
  const remaining = TTL_MS - (Date.now() % TTL_MS);
  if (remaining < marginMs) await nextWindow();
}

export async function getCard(request: APIRequestContext, query: string, headers: Record<string, string> = {}) {
  const res = await request.get(`/api/card?v=1&${query}`, {
    headers: { "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 250)}`, ...headers },
  });
  const svg = await res.text();
  return {
    res,
    svg,
    status: res.headers()["x-gitvis-status"],
    desc: /<desc[^>]*>([^<]*)<\/desc>/.exec(svg)?.[1] ?? "",
  };
}

/** WCAG 2.2 AA scan; fails on any violation and prints a readable summary. */
export async function expectAccessible(page: Page, context: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.impact} ${v.id}: ${v.help} → ${v.nodes
        .map((n) => n.target.join(" "))
        .slice(0, 3)
        .join(" | ")}`,
  );
  expect(summary, `axe violations (${context})`).toEqual([]);
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "page must not scroll horizontally").toBeLessThanOrEqual(0);
}
