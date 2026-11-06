import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll, uniqueUser, upstream } from "./helpers";

const VIEWPORTS = [
  { name: "320 (small phone)", width: 320, height: 720 },
  { name: "375 (phone)", width: 375, height: 812 },
  { name: "768 (tablet)", width: 768, height: 1024 },
  { name: "1280 (desktop)", width: 1280, height: 900 },
];

for (const viewport of VIEWPORTS) {
  test.describe(`at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("sample-data studio passes axe (WCAG 2.2 AA) without horizontal scrolling", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Design your contribution graphic" })).toBeVisible();
      await expectAccessible(page, `sample ${viewport.name}`);
      await expectNoHorizontalScroll(page);
    });

    test("connected studio with publish panel and data table passes axe", async ({ page, request }) => {
      const user = uniqueUser("a11y");
      await upstream(request, user, { count: 7 });
      await page.goto(`/?v=1&github=${user}&gitlab=${user}&layout=data-rich`);
      await expect(page.getByRole("textbox", { name: "README Markdown" })).toBeVisible();
      await page.getByText("View the data as text and a table").click();
      await expect(page.getByRole("table", { name: "Contributions by month" })).toBeVisible();
      await expectAccessible(page, `connected ${viewport.name}`);
      await expectNoHorizontalScroll(page);
    });
  });
}

test.describe("states", () => {
  test("validation errors are announced, linked to the field and pass axe", async ({ page }) => {
    await page.goto("/");
    const gitlab = page.getByRole("textbox", { name: /gitlab username/i });
    await gitlab.fill("bad..name");
    await page.getByRole("button", { name: "Load contributions" }).click();
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
    await page.getByRole("button", { name: "Load contributions" }).click();

    await expect(page.getByRole("status").filter({ hasText: /GitLab responded with an error/ })).toBeAttached();
    await expect(page.getByRole("button", { name: "Retry GitLab" })).toBeVisible();
    await expect(page.getByText(/couldn't be loaded\. The published image shows an explanatory error/)).toBeVisible();
    await expectAccessible(page, "partial failure");
  });

  test("respects reduced motion: no running animations while loading", async ({ page, request }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const user = uniqueUser("motion");
    await upstream(request, user, { count: 1 });
    await page.goto("/");
    await page.getByRole("textbox", { name: /gitlab username/i }).fill(user);
    await page.getByRole("button", { name: "Load contributions" }).click();
    const animated = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.playState === "running" && a.effect?.getTiming().iterations === Infinity),
    );
    expect(animated).toHaveLength(0);
  });
});
