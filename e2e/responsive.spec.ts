import { expect, type Page, test } from "@playwright/test";
import { expandAll, expectNoHorizontalScroll, stepHeading, uniqueUser, upstream } from "./helpers";

async function undersizedTargets(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("button, a[href], summary, label:has(input)")]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 1 && r.height > 1 && (r.width < 24 || r.height < 24))
      .map(({ el, r }) => `${Math.round(r.width)}×${Math.round(r.height)} ${el.outerHTML.slice(0, 120)}`),
  );
}

test.describe("mobile editing (375px)", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test("controls stay usable, readable and in sync with the preview", async ({ page }) => {
    await page.goto("/");
    expect(await undersizedTargets(page)).toEqual([]);

    await page.getByRole("button", { name: /try it with sample data/i }).tap();
    await expect(stepHeading(page)).toHaveText(/design your graphic/i);
    await expandAll(page);
    expect(await undersizedTargets(page)).toEqual([]);

    const smallestText = await page.evaluate(() => {
      const sizes = [...document.body.querySelectorAll("*")]
        .filter((el) => !el.closest("svg") && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim()))
        .map((el) => parseFloat(getComputedStyle(el).fontSize));
      return Math.min(...sizes);
    });
    expect(smallestText).toBeGreaterThanOrEqual(11);

    await page.locator('label[for="feature-longestStreak"]').tap();
    await expect(page.getByRole("switch", { name: /longest streak/i })).not.toBeChecked();
    await expect(
      page.getByRole("img", { name: "Contribution activity" }).getByText("Longest streak", { exact: true }),
    ).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });

  test("the preview starts compact and expands on demand", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /try it with sample data/i }).tap();
    const region = page.locator("#preview-region");
    const collapsed = (await region.boundingBox())!.height;
    expect(collapsed).toBeLessThanOrEqual(812 * 0.6 + 1);
    expect(await region.evaluate((el) => getComputedStyle(el.closest("section")!).position)).toBe("static");

    await page.getByRole("button", { name: "Expand preview" }).tap();
    await expect(page.getByRole("button", { name: "Collapse preview" })).toHaveAttribute("aria-expanded", "true");
    expect((await region.boundingBox())!.height).toBeGreaterThanOrEqual(collapsed - 0.5);
  });

  test("the preview shows the full README image, scaled to fit the phone, with no device switcher", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /try it with sample data/i }).tap();
    await expect(page.getByRole("radio", { name: "Mobile" })).toHaveCount(0);
    const graphic = page.getByRole("img", { name: "Contribution activity" });
    await expect(graphic).toHaveAttribute("width", "840");
    expect((await graphic.boundingBox())!.width).toBeLessThanOrEqual(375);
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
    await page.goto(`/?v=1&github=${user}&gitlab=${user}&hdr=full&name=Avery%20Example`);

    await expect(stepHeading(page)).toHaveText(/design your graphic/i);
    await expandAll(page);
    if (width < 1024) await page.getByRole("button", { name: "Expand preview" }).click();
    await expectNoHorizontalScroll(page);

    await page.getByRole("button", { name: "Change accounts" }).click();
    await expandAll(page);
    await expectNoHorizontalScroll(page);

    await page.getByRole("button", { name: /step 3: publish/i }).click();
    await expandAll(page);
    await expect(page.getByRole("textbox", { name: "README Markdown" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
}
