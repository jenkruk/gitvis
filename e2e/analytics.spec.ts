import { expect, type Page, test } from "@playwright/test";

// Vercel serves the real collector only on its platform. This stand-in follows the same protocol as the
// package's queue: it applies the registered beforeSend to each pageview and posts what survives, with the
// referrer, the way the real collector does.
const STAND_IN = `(() => {
  let beforeSend = (event) => event;
  const handle = (name, options) => {
    if (name === "beforeSend") beforeSend = options;
    if (name !== "pageview") return;
    const event = beforeSend({ type: "pageview", url: location.href });
    if (event) {
      fetch("/_vercel/insights/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ o: event.url, r: document.referrer }),
      });
    }
    window.__gitvisPageviews = (window.__gitvisPageviews ?? 0) + 1;
  };
  const queued = window.vaq ?? [];
  window.va = handle;
  for (const [name, options] of queued) handle(name, options);
})();`;

async function collect(page: Page) {
  const sent: { o: string; r: string }[] = [];
  await page.route("**/_vercel/insights/script.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: STAND_IN }),
  );
  await page.route("**/_vercel/insights/view", async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, body: "" });
  });
  const handled = async (count: number) =>
    expect
      .poll(() => page.evaluate(() => (window as { __gitvisPageviews?: number }).__gitvisPageviews ?? 0))
      .toBe(count);
  return { sent, handled };
}

test.describe("analytics pageviews", () => {
  for (const [label, referer] of [
    ["a GitHub repository", "https://github.com/jenkruk/jenkruk"],
    ["a GitHub profile URL", "https://github.com/jenkruk"],
    ["a page with query parameters", "https://example.com/?user=jenkruk"],
  ] as const) {
    test(`a visit from ${label} sends nothing, even after moving to the studio`, async ({ page }) => {
      const { sent, handled } = await collect(page);
      await page.goto("/", { referer });
      expect(await page.evaluate(() => document.referrer)).toBe(referer);
      await handled(1);
      await page.getByRole("link", { name: "Create your graphic" }).click();
      await expect(page).toHaveURL(/\/studio/);
      await handled(2);
      expect(sent).toEqual([]);
    });
  }

  test("an origin-only referrer is kept, with the page URL stripped to its path", async ({ page }) => {
    const { sent, handled } = await collect(page);
    await page.goto("/studio?v=1&github=e2e-user#design", { referer: "https://github.com/" });
    await handled(1);
    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]).toEqual({ o: expect.stringMatching(/^http:\/\/localhost:\d+\/studio$/), r: "https://github.com/" });
  });

  test("a direct visit is counted, and nothing identifying reaches the request", async ({ page }) => {
    const { sent, handled } = await collect(page);
    await page.goto("/#how-heading");
    await handled(1);
    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]).toEqual({ o: expect.stringMatching(/^http:\/\/localhost:\d+\/$/), r: "" });
  });
});
