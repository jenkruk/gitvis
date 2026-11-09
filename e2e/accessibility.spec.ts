import { expect, test } from "@playwright/test";
import { expandAll, expectAccessible, expectNoHorizontalScroll, stepHeading, uniqueUser, upstream } from "./helpers";

const VIEWPORTS = [
  { name: "320 (small phone)", width: 320, height: 720 },
  { name: "375 (phone)", width: 375, height: 812 },
  { name: "768 (tablet)", width: 768, height: 1024 },
  { name: "1280 (desktop)", width: 1280, height: 900 },
];

for (const viewport of VIEWPORTS) {
  test.describe(`at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("Connect and sample-data Design pass axe (WCAG 2.2 AA) without horizontal scrolling", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Create your contribution graphic" })).toBeVisible();
      await expandAll(page);
      await expectAccessible(page, `connect ${viewport.name}`);
      await expectNoHorizontalScroll(page);

      await page.getByRole("button", { name: /try it with sample data/i }).click();
      await expect(stepHeading(page)).toHaveText(/design your graphic/i);
      await expandAll(page);
      await expectAccessible(page, `sample design ${viewport.name}`);
      await expectNoHorizontalScroll(page);
    });

    test("connected Design (every section open) and Publish pass axe", async ({ page, request }) => {
      const user = uniqueUser("a11y");
      await upstream(request, user, { count: 7 });
      await page.goto(`/?v=1&github=${user}&gitlab=${user}&layout=data-rich&hdr=full&name=Avery`);
      await expect(stepHeading(page)).toHaveText(/design your graphic/i);
      await expandAll(page);
      await expect(page.getByRole("table", { name: "Contributions by month" })).toBeVisible();
      await expectAccessible(page, `connected design ${viewport.name}`);
      await expectNoHorizontalScroll(page);

      await page.getByRole("button", { name: "Continue to publish" }).click();
      await expect(stepHeading(page)).toHaveText(/publish to your readme/i);
      await expandAll(page);
      await expect(page.getByRole("textbox", { name: "README Markdown" })).toBeVisible();
      await expectAccessible(page, `publish ${viewport.name}`);
      await expectNoHorizontalScroll(page);
    });
  });
}

test.describe("states", () => {
  test("validation errors are announced, linked to the field and pass axe", async ({ page }) => {
    await page.goto("/");
    const gitlab = page.getByRole("textbox", { name: /gitlab username/i });
    await gitlab.fill("bad..name");
    await page.getByRole("button", { name: "See my contributions" }).click();
    await expect(gitlab).toBeFocused();
    await expect(gitlab).toHaveAttribute("aria-invalid", "true");
    await expect(gitlab).toHaveAccessibleDescription(/isn't a valid gitlab username/i);
    await expectAccessible(page, "validation error");
  });

  test("partial failure explains itself in text, offers retry and passes axe", async ({ page, request }) => {
    const ok = uniqueUser("partial-ok");
    const down = uniqueUser("partial-down");
    await upstream(request, ok, { count: 4 });
    await upstream(request, down, { mode: "fail" });
    await page.goto("/");
    await page.getByRole("textbox", { name: /github username/i }).fill(ok);
    await page.getByRole("textbox", { name: /gitlab username/i }).fill(down);
    await page.getByRole("button", { name: "See my contributions" }).click();

    await expect(page.getByRole("status").filter({ hasText: /GitLab responded with an error/ })).toBeAttached();
    await expect(page.getByRole("button", { name: "Retry GitLab" })).toBeVisible();
    await expect(stepHeading(page)).toHaveText(/connect your accounts/i);
    await expectAccessible(page, "partial failure");

    await page.getByRole("button", { name: "Continue with available data" }).click();
    await page.getByRole("button", { name: "Continue to publish" }).click();
    await expect(page.getByText(/couldn't be loaded\. The published image shows an explanatory error/)).toBeVisible();
    await expectAccessible(page, "partial failure publish");
  });

  test("respects reduced motion: no running animations while loading", async ({ page, request }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const user = uniqueUser("motion");
    await upstream(request, user, { count: 1 });
    await page.goto("/");
    await page.getByRole("textbox", { name: /gitlab username/i }).fill(user);
    await page.getByRole("button", { name: "See my contributions" }).click();
    const running = () => page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length);
    expect(await running()).toBe(0);
    await expect(stepHeading(page)).toHaveText(/design your graphic/i);
    expect(await running()).toBe(0);
  });
});
