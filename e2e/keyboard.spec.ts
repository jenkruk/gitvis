import { expect, type Locator, type Page, test } from "@playwright/test";
import { uniqueUser, upstream } from "./helpers";

async function tabTo(page: Page, target: Locator, maxPresses = 80) {
  for (let i = 0; i < maxPresses; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Could not reach ${target} with the keyboard`);
}

async function expectVisibleFocus(locator: Locator) {
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

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

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

  await expect(page.getByRole("heading", { name: /publish to your readme/i })).toBeFocused();
  const copy = page.getByRole("button", { name: "Copy README Markdown" });
  await tabTo(page, copy);
  await expectVisibleFocus(copy);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "README Markdown copied." })).toBeVisible();

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain(`/api/card?v=1&amp;github=${user}&amp;gitlab=${user}&amp;layout=minimal`);
  expect(clipboard).toMatch(/f=[^"&]*best/);
  expect(clipboard).not.toContain("size=compact");
  expect(clipboard).toContain('alt="Get Yours"');

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

test("Detailed contribution data opens, and its monthly table is reachable, with the keyboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /try it with sample data/i }).click();
  const panel = page.locator("summary", { hasText: "Detailed contribution data" });
  await tabTo(page, panel);
  await expectVisibleFocus(panel);
  await page.keyboard.press("Enter");
  await expect(panel.locator("..")).toHaveAttribute("open", "");
  await expect(page.getByRole("table", { name: /^Contribution history/ })).toBeVisible();

  const monthly = page.locator("summary", { hasText: "Monthly contributions" });
  await tabTo(page, monthly, 10);
  await expectVisibleFocus(monthly);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("table", { name: "Monthly contributions · Last 12 months" })).toBeVisible();
});
