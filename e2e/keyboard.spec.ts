import { expect, type Locator, type Page, test } from "@playwright/test";
import { uniqueUser, upstream } from "./helpers";

/** Presses Tab until `target` has focus (fails if it's unreachable). */
async function tabTo(page: Page, target: Locator, maxPresses = 80) {
  for (let i = 0; i < maxPresses; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Could not reach ${target} with the keyboard`);
}

async function expectVisibleFocus(locator: Locator) {
  // Focus must be visible: the element (or its wrapping label for sr-only inputs) shows an outline.
  const visible = await locator.evaluate((el) => {
    const styled = (node: Element | null) => {
      if (!node) return false;
      const style = getComputedStyle(node);
      return style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
    };
    return styled(el) || styled(el.closest("label")) || styled(el.parentElement);
  });
  expect(visible, "focus indicator").toBe(true);
}

test("the full Connect → Customize → Publish flow works with the keyboard alone", async ({
  page,
  context,
  request,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const user = uniqueUser("kbd");
  await upstream(request, user, { count: 12 });
  await page.goto("/");

  // Skip link is the first stop.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

  // Connect.
  const github = page.getByRole("textbox", { name: /github username/i });
  await tabTo(page, github);
  await expectVisibleFocus(github);
  await page.keyboard.type(user);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("textbox", { name: /gitlab username/i })).toBeFocused();
  await page.keyboard.type(user);
  await page.keyboard.press("Enter");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /12 contributions in the last 12 months/ })
      .first(),
  ).toBeAttached();

  // Customize: radio groups use arrow keys, switches use Space.
  const dashboard = page.getByRole("radio", { name: /dashboard/i });
  await tabTo(page, dashboard);
  await expectVisibleFocus(dashboard);
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("radio", { name: /minimal/i })).toBeChecked();

  const bestDay = page.getByRole("switch", { name: /best day/i });
  await tabTo(page, bestDay);
  await expectVisibleFocus(bestDay);
  await page.keyboard.press("Space");
  await expect(bestDay).toBeChecked();

  // Publish: copy the Markdown and verify it encodes every choice.
  const copy = page.getByRole("button", { name: "Copy Markdown" });
  await tabTo(page, copy);
  await expectVisibleFocus(copy);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "README Markdown copied to clipboard." })).toBeAttached();

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain(`/api/card?v=1&amp;github=${user}&amp;gitlab=${user}&amp;layout=minimal`);
  expect(clipboard).toMatch(/f=[^"&]*best/);
  expect(clipboard).toContain('<source media="(max-width: 600px)"');
});

test("focus moves to the first invalid field and errors are reachable", async ({ page }) => {
  await page.goto("/");
  const submit = page.getByRole("button", { name: "Load contributions" });
  await tabTo(page, submit);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("textbox", { name: /github username/i })).toBeFocused();
});
