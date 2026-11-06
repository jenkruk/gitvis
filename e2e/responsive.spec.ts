import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, uniqueUser, upstream } from "./helpers";

test.describe("mobile editing (375px)", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test("controls stay usable, readable and in sync with the preview", async ({ page }) => {
    await page.goto("/");
    // Interactive targets meet WCAG 2.5.8 (≥ 24×24 CSS px).
    const tooSmall = await page.evaluate(() =>
      [...document.querySelectorAll("button, a[href], summary, label:has(input)")]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        // Ignore visually hidden (1px) elements such as the skip link before it receives focus.
        .filter(({ r }) => r.width > 1 && r.height > 1 && (r.width < 24 || r.height < 24))
        .map(({ el, r }) => `${Math.round(r.width)}×${Math.round(r.height)} ${el.outerHTML.slice(0, 120)}`),
    );
    expect(tooSmall).toEqual([]);

    // Text outside the graphic is never smaller than 11px.
    const smallestText = await page.evaluate(() => {
      const sizes = [...document.body.querySelectorAll("*")]
        .filter((el) => !el.closest("svg") && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim()))
        .map((el) => parseFloat(getComputedStyle(el).fontSize));
      return Math.min(...sizes);
    });
    expect(smallestText).toBeGreaterThanOrEqual(11);

    await page.locator('label[for="feature-longestStreak"]').tap(); // the visible switch row
    await expect(page.getByRole("switch", { name: /longest streak/i })).not.toBeChecked();
    await expect(
      page.getByRole("img", { name: "Contribution activity" }).getByText("Longest streak", { exact: true }),
    ).toHaveCount(0); // the card label (the <desc> still summarizes it)
    await expectNoHorizontalScroll(page);
  });

  test("the mobile preview shows the reflowed compact image, not a shrunken desktop graphic", async ({ page }) => {
    await page.goto("/");
    // Radios are visually hidden; users tap the visible label.
    await page.locator("label", { has: page.getByRole("radio", { name: "Mobile" }) }).click();
    await expect(page.getByRole("radio", { name: "Mobile" })).toBeChecked();
    const graphic = page.getByRole("img", { name: "Contribution activity" });
    await expect(graphic).toHaveAttribute("width", "400");
    await expect(graphic.getByText("Last 20 weeks")).toBeAttached();
    await expect(page.getByText(/mobile-optimized image · smallest labels/)).toBeVisible();
  });
});

test.describe("published compact image", () => {
  test("is served at 400px and labelled for phones", async ({ request }) => {
    const user = uniqueUser("compact");
    await upstream(request, user, { count: 3 });
    const res = await request.get(`/api/card?v=1&gitlab=${user}&layout=data-rich&size=compact`);
    const svg = await res.text();
    expect(res.headers()["x-gitvis-status"]).toBe("ok");
    expect(svg).toMatch(/^<svg[^>]+width="400"/);
    expect(svg).toContain("Last 20 weeks");
  });
});

for (const width of [320, 375, 768, 1280]) {
  test(`no horizontal scrolling with every panel open at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 900 });
    const user = uniqueUser(`wide${width}`);
    await upstream(request, user, { count: 2 });
    await page.goto(`/?v=1&github=${user}&gitlab=${user}`);
    await page.getByText("How contributions are counted").click();
    await page.getByText("View the data as text and a table").click();
    await expect(page.getByRole("textbox", { name: "README Markdown" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
}
