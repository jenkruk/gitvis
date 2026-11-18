import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll } from "./helpers";

const ORIGIN = "http://localhost:3100";

for (const viewport of [
  { width: 320, height: 720 },
  { width: 1280, height: 800 },
]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`privacy page passes axe at ${viewport.width}px in ${colorScheme} without horizontal scrolling`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme });
      await page.goto("/privacy");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy");
      await expectAccessible(page, `privacy ${viewport.width} ${colorScheme}`);
      await expectNoHorizontalScroll(page);
    });
  }
}

test("the footer's Privacy link opens the page in the same tab, from the home page and the studio", async ({
  page,
}) => {
  for (const start of ["/", "/studio"]) {
    await page.goto(start);
    await page.getByRole("contentinfo").getByRole("link", { name: "Privacy" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy");
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  }
  await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "Open studio" }).click();
  await expect(page).toHaveURL(/\/studio/);
});

test("privacy page links are keyboard reachable with a visible focus ring", async ({ page }) => {
  await page.goto("/privacy");
  const issues = page.getByRole("link", { name: /open an issue on GitHub/ });
  await issues.focus();
  await expect(issues).toBeFocused();
  const outline = await issues.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe("none");
});

test("privacy page has its own title, description and canonical URL", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page).toHaveTitle("Privacy · GitVis");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${ORIGIN}/privacy`);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", `${ORIGIN}/privacy`);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /cookieless/);

  await page.goto("/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", ORIGIN);
});

for (const path of ["/", "/studio", "/privacy"]) {
  test(`the footer on ${path} is one row on desktop and stacks on a narrow phone`, async ({ page }) => {
    const footer = page.getByRole("contentinfo");
    const copyright = footer.getByText("© 2026 GitVis · MIT licensed");
    const source = footer.getByRole("link", { name: "Source on GitHub (opens in a new tab)" });
    const privacy = footer.getByRole("link", { name: "Privacy" });
    const middle = async (locator: typeof source) => {
      const box = (await locator.boundingBox())!;
      return box.y + box.height / 2;
    };

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(path);
    await expect(source).toHaveAttribute("href", "https://github.com/jenkruk/gitvis");
    await expect(privacy).toHaveAttribute("href", "/privacy");
    expect(Math.abs((await middle(copyright)) - (await middle(privacy)))).toBeLessThan(4);
    expect(Math.abs((await middle(source)) - (await middle(privacy)))).toBeLessThan(4);

    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
    expect(await middle(privacy)).toBeGreaterThan((await copyright.boundingBox())!.y + 8);
    await expectNoHorizontalScroll(page);

    await privacy.focus();
    await page.keyboard.press("Shift+Tab");
    await expect(source).toBeFocused();
    expect(await source.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
  });
}
