import AxeBuilder from "@axe-core/playwright";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { E2E_POLICY } from "../playwright.config";

export const UPSTREAM = "http://127.0.0.1:4010";
export const TTL_MS = E2E_POLICY.ttlSeconds * 1000;

export type UpstreamMode = "ok" | "fail" | "notfound";

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

export async function hits(
  request: APIRequestContext,
  user: string,
): Promise<{ github: number; gitlab: number; history: number }> {
  return (await request.get(`${UPSTREAM}/__hits?user=${user}`)).json();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function nextWindow(windows = 1) {
  const now = Date.now();
  const boundary = (Math.floor(now / TTL_MS) + windows) * TTL_MS;
  await sleep(boundary - now + 250);
}

export async function freshWindow(marginMs = 2_500) {
  const remaining = TTL_MS - (Date.now() % TTL_MS);
  if (remaining < marginMs) await nextWindow();
}

export async function getCard(request: APIRequestContext, query: string, headers: Record<string, string> = {}) {
  const res = await request.get(`/api/card?${query.startsWith("v=") ? query : `v=1&${query}`}`, {
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

export async function expectAccessible(page: Page, context: string) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
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

export async function expandStandaloneDisclosures(page: Page) {
  await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
  const closed = page.locator("details:not([open]):not([name]) > summary:visible");
  for (let guard = 0; guard < 20 && (await closed.count()) > 0; guard++) await closed.first().click();
}

export const SECTIONS = ["Identity", "Colors & Background", "Metrics & Charts", "Display"] as const;
export type SectionTitle = (typeof SECTIONS)[number];

const section = (page: Page, title: SectionTitle) =>
  page.locator("details[name]", { has: page.locator("summary", { hasText: title }) });

export async function openSection(page: Page, title: SectionTitle) {
  await expandStandaloneDisclosures(page);
  const details = section(page, title);
  if (!(await details.evaluate((el) => (el as HTMLDetailsElement).open))) {
    await details.locator("summary").click();
  }
  await expect(details).toHaveAttribute("open", "");
}

export async function forEachSection(page: Page, check: (title: SectionTitle) => Promise<void>) {
  for (const title of SECTIONS) {
    await openSection(page, title);
    await check(title);
  }
}

export function stepHeading(page: Page) {
  return page.getByRole("heading", { level: 2 });
}
