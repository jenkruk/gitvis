import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll, stepHeading, uniqueUser, upstream } from "./helpers";

const VIEWPORTS = [
  { width: 320, height: 720 },
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];

const clickRadioLabel = (page: import("@playwright/test").Page, name: string) =>
  page.locator("label", { has: page.getByRole("radio", { name, exact: true }) }).click();

const showcase = (page: import("@playwright/test").Page) =>
  page.getByRole("figure").getByRole("img", { name: "Contribution activity" });

for (const viewport of VIEWPORTS) {
  test.describe(`landing at ${viewport.width}px`, () => {
    test.use({ viewport });

    for (const colorScheme of ["light", "dark"] as const) {
      test(`passes axe (WCAG 2.2 AA) in ${colorScheme} without horizontal scrolling`, async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        await page.goto("/");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your work deserves to be seen.");
        await expectAccessible(page, `landing ${viewport.width} ${colorScheme}`);
        await expectNoHorizontalScroll(page);
      });
    }

    test("shows the headline and primary action without scrolling", async ({ page }) => {
      await page.goto("/");
      const cta = page.getByRole("link", { name: "Create your graphic" });
      await expect(cta).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole("heading", { level: 1 })).toBeInViewport({ ratio: 1 });
      if (viewport.width >= 1024) await expect(showcase(page)).toBeInViewport({ ratio: 0.6 });
    });
  });
}

test("reflows at 200% zoom (640 CSS px) without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 400 });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Create your graphic" })).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("the showcase controls are keyboard operable and drive the real graphic", async ({ page }) => {
  await page.goto("/");
  const graphic = showcase(page);
  await expect(graphic).toContainText("Sample data");
  await expect(page.getByRole("radio", { name: "Contribution graphic" })).toBeChecked();

  const viewBox = () => page.getByTestId("showcase-graphic").locator("svg").getAttribute("viewBox");
  const frameHeight = async () => (await page.locator("figure [data-mode]").boundingBox())!.height;
  const before = await viewBox();
  const heightBefore = await frameHeight();
  await page.getByRole("radio", { name: "Contribution graphic" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "Developer profile card" })).toBeChecked();
  // The profile header makes the graphic taller, so its viewBox changes.
  await expect.poll(viewBox).not.toBe(before);
  // Switching styles never changes the frame's height.
  expect(await frameHeight()).toBeCloseTo(heightBefore, 0);

  await clickRadioLabel(page, "Light theme");
  await expect(page.locator("figure [data-mode]")).toHaveAttribute("data-mode", "light");
  await clickRadioLabel(page, "Terracotta");

  const href = await page.getByRole("link", { name: "Create your graphic" }).getAttribute("href");
  expect(href).toMatch(/^\/studio\?/);
  expect(href).toContain("palette=terracotta");
  expect(href).toContain("mode=light");
  expect(href).toContain("hdr=full");
});

test("Create your graphic opens the studio at Connect", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Create your graphic" }).click();
  await expect(page).toHaveURL(/\/studio/);
  await expect(stepHeading(page)).toHaveText(/connect your accounts/i);
});

test("Explore with sample data opens Design on labelled sample data that can't be published", async ({ page }) => {
  await page.goto("/");
  await clickRadioLabel(page, "GitHub Classic");
  await page.getByRole("link", { name: "Explore with sample data" }).click();
  await expect(page).toHaveURL(/\/studio\?.*palette=github-classic.*sample=1#design$/);
  await expect(stepHeading(page)).toHaveText(/design your graphic/i);
  await expect(page.getByText(/previewing sample data/i)).toBeVisible();
  await expect(page.getByRole("radio", { name: /github classic/i })).toBeChecked();
  await expect(
    page.getByRole("navigation", { name: "Progress" }).getByRole("button", { name: /publish/i }),
  ).toBeDisabled();

  await page.reload();
  await expect(stepHeading(page)).toHaveText(/design your graphic/i);
});

test("old root studio links still open the studio with their design and step", async ({ page, request }) => {
  const user = uniqueUser("legacy");
  await upstream(request, user, { count: 5 });
  await page.goto(`/?v=1&github=${user}&palette=nordic-frost#design`);
  await expect(page).toHaveURL(new RegExp(`/studio\\?.*github=${user}.*#design$`));
  await expect(stepHeading(page)).toHaveText(/design your graphic/i);
  await expect(page.getByRole("radio", { name: /nordic frost/i })).toBeChecked();

  await page.goto("/#publish");
  await expect(page).toHaveURL(/\/studio#/);
});

test("the header links home, to the studio and to the source", async ({ page }) => {
  await page.goto("/studio");
  const nav = page.getByRole("navigation", { name: "Site" });
  const source = nav.getByRole("link", { name: /source on github \(opens in a new tab\)/i });
  await expect(source).toHaveAttribute("href", "https://github.com/jenkruk/gitvis");
  await expect(source).toHaveAttribute("target", "_blank");
  await page
    .getByRole("link", { name: /gitvis/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "Open studio" }).click();
  await expect(page).toHaveURL(/\/studio#connect$/);
});

test("metadata uses the production origin, with a canonical URL and a social preview", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("GitVis — GitHub + GitLab contribution graphics for your README");
  const origin = "http://localhost:3100";
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", origin);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Your work deserves to be seen.");
  const image = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(image).toMatch(new RegExp(`^${origin}/opengraph-image`));
  const res = await request.get(image!);
  expect(res.headers()["content-type"]).toBe("image/png");
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute("content", /sample data/i);

  await page.goto("/studio");
  await expect(page).toHaveTitle("Studio · GitVis");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${origin}/studio`);
});
