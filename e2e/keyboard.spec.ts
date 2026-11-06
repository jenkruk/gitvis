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

test("the full Connect → Design → Publish flow works with the keyboard alone", async ({ page, context, request }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const user = uniqueUser("kbd");
  await upstream(request, user, { count: 12 });
  await page.goto("/");

  // Skip link is the first stop.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

  // Step 1 — Connect. Enter submits; success moves focus to the Design heading.
  const github = page.getByRole("textbox", { name: /github username/i });
  await tabTo(page, github);
  await expectVisibleFocus(github);
  await page.keyboard.type(user);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("textbox", { name: /gitlab username/i })).toBeFocused();
  await page.keyboard.type(user);
  await page.keyboard.press("Enter");
  const design = page.getByRole("heading", { name: /design your graphic/i });
  await expect(design).toBeFocused();
  await expect(design).toHaveAccessibleDescription(`Showing contributions for GitHub @${user} and GitLab @${user}.`);
  await expect(page.getByRole("button", { name: /step 2: design/i })).toHaveAttribute("aria-current", "step");

  // Step 2 — Design. Radio groups use arrow keys; collapsed sections open with Enter; switches use Space.
  const dashboard = page.getByRole("radio", { name: /dashboard/i });
  await tabTo(page, dashboard);
  await expectVisibleFocus(dashboard);
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("radio", { name: /minimal/i })).toBeChecked();

  const metrics = page.locator("summary", { hasText: "Metrics & Charts" });
  await tabTo(page, metrics);
  await expectVisibleFocus(metrics);
  await page.keyboard.press("Enter");
  const bestDay = page.getByRole("switch", { name: /best day/i });
  await tabTo(page, bestDay);
  await expectVisibleFocus(bestDay);
  await page.keyboard.press("Space");
  await expect(bestDay).toBeChecked();

  const next = page.getByRole("button", { name: "Continue to publish" });
  await tabTo(page, next);
  await page.keyboard.press("Enter");

  // Step 3 — Publish. The primary action copies Markdown that encodes every choice.
  await expect(page.getByRole("heading", { name: /publish to your readme/i })).toBeFocused();
  const copy = page.getByRole("button", { name: "Copy README Markdown" });
  await tabTo(page, copy);
  await expectVisibleFocus(copy);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "README Markdown copied." })).toBeVisible();

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain(`/api/card?v=1&amp;github=${user}&amp;gitlab=${user}&amp;layout=minimal`);
  expect(clipboard).toMatch(/f=[^"&]*best/);
  expect(clipboard).toContain('<source media="(max-width: 600px)"');

  // Back to Design without losing anything.
  const edit = page.getByRole("button", { name: "Edit design" });
  await tabTo(page, edit);
  await page.keyboard.press("Enter");
  await expect(design).toBeFocused();
  await expect(page.getByRole("radio", { name: /minimal/i })).toBeChecked();
  await expect(bestDay).toBeChecked();
});

test("focus moves to the first invalid field and errors are reachable", async ({ page }) => {
  await page.goto("/");
  const submit = page.getByRole("button", { name: "See my contributions" });
  await tabTo(page, submit);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("textbox", { name: /github username/i })).toBeFocused();
});

test("browser Back and reload keep the current step and design", async ({ page, request }) => {
  const user = uniqueUser("history");
  await upstream(request, user, { count: 3 });
  await page.goto(`/?v=1&github=${user}&palette=nordic-frost`);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(/design your graphic/i);

  await page.getByRole("button", { name: "Continue to publish" }).click();
  await expect(page).toHaveURL(/#publish$/);
  await page.reload();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(/publish to your readme/i);

  await page.goBack();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(/design your graphic/i);
  await expect(page.getByRole("radio", { name: /nordic frost/i })).toBeChecked();
});
