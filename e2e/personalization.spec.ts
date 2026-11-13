import { expect, type Locator, test } from "@playwright/test";
import {
  expandAll,
  openSection,
  type SectionTitle,
  expectAccessible,
  expectNoHorizontalScroll,
  getCard,
  stepHeading,
  uniqueUser,
  upstream,
} from "./helpers";

const PERSONALIZED =
  "hdr=full&av=github,gitlab&name=Avery%20Example&title=Frontend%20Engineer&bg=gradient&range=90&den=compact";

test.describe("published card", () => {
  test("embeds avatars as data URIs and shows the identity header", async ({ request }) => {
    const user = uniqueUser("avatar");
    await upstream(request, user, { count: 5 });
    const { res, svg } = await getCard(request, `github=${user}&gitlab=${user}&${PERSONALIZED}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-security-policy"]).toContain("img-src data:");
    expect(svg.match(/<image [^>]*href="data:image\/png;base64,/g)).toHaveLength(2);
    expect(svg).not.toMatch(/<image [^>]*href="https?:/);
    expect(svg).toContain("Avery Example");
    expect(svg).toContain("Frontend Engineer");
    expect(svg).toContain("<linearGradient");
  });

  test("falls back to a monogram when an avatar can't be loaded", async ({ request }) => {
    const user = uniqueUser("noavatar");
    await upstream(request, user, { count: 2 });
    const { res, svg } = await getCard(request, `github=${user}&hdr=compact&av=github&name=Avery`);
    expect(res.status()).toBe(200);
    expect(svg).not.toContain("<image");
    expect(svg).toContain("Avery");
  });

  test("panel styles are preserved in the published SVG", async ({ request }) => {
    const user = uniqueUser("panels");
    await upstream(request, user, { count: 4 });
    const panelRects = (svg: string) => svg.match(/<rect [^>]*rx="10"[^>]*>/g) ?? [];
    const filled = await getCard(request, `github=${user}`);
    const outlined = await getCard(request, `github=${user}&pnl=outlined&bg=gradient`);
    const borderless = await getCard(request, `github=${user}&pnl=borderless&bg=transparent`);
    expect(panelRects(filled.svg).length).toBeGreaterThan(0);
    expect(panelRects(outlined.svg)).toHaveLength(panelRects(filled.svg).length);
    for (const rect of panelRects(outlined.svg)) expect(rect).toContain('fill="none"');
    expect(panelRects(borderless.svg)).toEqual([]);
    expect(borderless.status).toBe("ok");
  });

  test("legacy URLs render without any identity header", async ({ request }) => {
    const user = uniqueUser("legacy");
    await upstream(request, user, { count: 3 });
    const { svg } = await getCard(request, `github=${user}`);
    expect(svg).not.toContain("<image");
    expect(svg).not.toContain("<linearGradient");
  });
});

test.describe("studio", () => {
  test("personalized settings survive reload and reach the README snippet", async ({ page, request }) => {
    const user = uniqueUser("persist");
    await upstream(request, user, { count: 9 });
    await page.goto(`/?v=1&github=${user}&gitlab=${user}&${PERSONALIZED}`);
    await openSection(page, "Identity");

    await expect(page.getByRole("radio", { name: /developer profile card/i })).toBeChecked();
    await expect(page.getByRole("radio", { name: /full profile/i })).toBeChecked();
    await expect(page.getByRole("textbox", { name: /display name/i })).toHaveValue("Avery Example");
    await openSection(page, "Colors & Background");
    await expect(page.getByRole("radio", { name: /gradient/i })).toBeChecked();
    await openSection(page, "Display");
    await expect(page.getByRole("radio", { name: "90 days" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "Compact", exact: true })).toBeChecked();

    await page.getByRole("button", { name: "Continue to publish" }).click();
    await expandAll(page);
    const markdown = page.getByRole("textbox", { name: "README Markdown" });
    await expect(markdown).toHaveValue(/hdr=full/);
    await expect(markdown).toHaveValue(/name=Avery(%20|\+)Example/);
    await expect(markdown).toHaveValue(/range=90/);

    await page.reload();
    await expect(stepHeading(page)).toHaveText(/publish to your readme/i);
    await page.getByRole("button", { name: "Edit design" }).click();
    await openSection(page, "Identity");
    await expect(page.getByRole("radio", { name: /full profile/i })).toBeChecked();
    await expect(page.getByRole("textbox", { name: /display name/i })).toHaveValue("Avery Example");
  });

  test("metrics reorder with the keyboard and the move is announced", async ({ page, request }) => {
    const user = uniqueUser("order");
    await upstream(request, user, { count: 4 });
    await page.goto(`/?v=1&github=${user}`);
    await page.locator("summary", { hasText: "Metrics & Charts" }).click();

    const down = page.getByRole("button", { name: "Move Total contributions down" });
    await expect(page.getByRole("button", { name: "Move Total contributions up" })).toBeDisabled();
    await down.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Total contributions moved to position 2 of 5.")).toBeAttached();
    await expect(page).toHaveURL(/[?&]ord=/);
  });

  test("header presets update the live preview", async ({ page, request }) => {
    const user = uniqueUser("preset");
    await upstream(request, user, { count: 4 });
    await page.goto(`/?v=1&github=${user}`);
    const graphic = page.getByRole("img", { name: /^Contribution activity/ }).first();

    await page.locator("label", { has: page.getByRole("radio", { name: /developer profile card/i }) }).click();
    await page.locator("summary", { hasText: "Identity" }).click();
    await expect(page.getByRole("radio", { name: /full profile/i })).toBeChecked();

    await page.getByRole("textbox", { name: /display name/i }).fill("Avery Example");
    await page.locator("label", { has: page.getByRole("radio", { name: /compact identity/i }) }).click();
    await expect(graphic).toHaveAccessibleName(/Avery Example/);
    await expect(graphic.getByText("Avery Example", { exact: true })).toBeAttached();

    await page.locator("label", { has: page.getByRole("radio", { name: /^None/ }) }).click();
    await expect(graphic.getByText("Avery Example", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("radio", { name: /contribution graphic/i })).toBeChecked();
  });

  test("panel style is chosen with the keyboard and survives into the shareable URL", async ({ page, request }) => {
    const user = uniqueUser("panelkbd");
    await upstream(request, user, { count: 4 });
    await page.goto(`/?v=1&github=${user}`);
    await openSection(page, "Colors & Background");
    const filled = page.getByRole("radio", { name: "Filled" });
    await filled.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "Outlined" })).toBeChecked();
    await expect(page).toHaveURL(/[?&]pnl=outlined/);
    await expect(page.getByRole("radio", { name: "Solid" })).toBeChecked();
    await expect(page.locator("summary", { hasText: "Colors & Background" })).toContainText("Outlined panels");
    await expectAccessible(page, "outlined panels");

    await page.reload();
    await openSection(page, "Colors & Background");
    await expect(page.getByRole("radio", { name: "Outlined" })).toBeChecked();
  });

  for (const width of [320, 375]) {
    test(`personalization controls pass axe with ≥ 24px targets at ${width}px`, async ({ page, request }) => {
      await page.setViewportSize({ width, height: 800 });
      const user = uniqueUser("touch");
      await upstream(request, user, { count: 6 });
      await page.goto(`/?v=1&github=${user}&gitlab=${user}&${PERSONALIZED}&pc=github:ff7a59`);
      await expect(stepHeading(page)).toHaveText(/design your graphic/i);
      const targets: [SectionTitle, Locator][] = [
        ["Metrics & Charts", page.getByRole("button", { name: /^Move .* (up|down)$/ })],
        ["Colors & Background", page.getByRole("button", { name: /^Reset .* color$/ })],
        ["Colors & Background", page.locator("input[type=color]")],
      ];
      for (const [section, group] of targets) {
        await openSection(page, section);
        expect(await group.count(), `${section} targets`).toBeGreaterThan(0);
        for (const target of await group.all()) {
          const box = await target.boundingBox();
          expect(box, "target is rendered").not.toBeNull();
          expect(Math.min(box!.width, box!.height), "WCAG 2.5.8 target size").toBeGreaterThanOrEqual(24);
        }
        await expectAccessible(page, `personalized · ${section} ${width}`);
        await expectNoHorizontalScroll(page);
      }
    });
  }
});
