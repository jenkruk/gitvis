import { expect, test } from "@playwright/test";
import {
  expandAll,
  expectAccessible,
  expectNoHorizontalScroll,
  getCard,
  hits,
  stepHeading,
  uniqueUser,
  upstream,
} from "./helpers";

test.describe("published multi-year card", () => {
  test("stacks one calendar per 12-month period and labels GitLab's missing history", async ({ request }) => {
    const user = uniqueUser("hist");
    await upstream(request, user, { count: 4 });
    const { res, svg, desc, status } = await getCard(request, `github=${user}&gitlab=${user}&yrs=3`);
    expect(res.status()).toBe(200);
    expect(status).toBe("ok");
    expect(svg.match(/>More</g)).toHaveLength(1);
    expect(svg.match(/>GitHub only · GitLab unavailable</g)).toHaveLength(2);
    expect(svg).toContain(">GitHub + GitLab<");
    expect(svg).toContain(">Platform breakdown · Last 12 months<");
    expect(desc).toContain("Summary statistics: Last 12 months, GitHub + GitLab.");
    expect(desc).toContain("By 12-month period, newest first");
    expect(svg).not.toMatch(/<pattern/);
  });

  test("earlier years are cached: later views and other ranges don't refetch history", async ({ request }) => {
    const user = uniqueUser("histcache");
    await upstream(request, user, { count: 2 });
    await getCard(request, `github=${user}&yrs=3`);
    await getCard(request, `github=${user}&yrs=2&layout=minimal`);
    await getCard(request, `github=${user}&yrs=3&size=compact`);
    expect((await hits(request, user)).history).toBe(1);
  });

  test("phones get yearly summaries and the recent weeks", async ({ request }) => {
    const user = uniqueUser("histphone");
    await upstream(request, user, { count: 3 });
    const { svg } = await getCard(request, `github=${user}&gitlab=${user}&yrs=3&size=compact`);
    expect(svg).toMatch(/^<svg[^>]+width="400"/);
    expect(svg).toContain("Last 20 weeks");
    expect(svg).toContain("GitHub only · GitLab unavailable");
  });

  test("legacy 30/90/365-day URLs render as before, and can't be mixed with yrs", async ({ request }) => {
    const user = uniqueUser("histlegacy");
    await upstream(request, user, { count: 1 });
    for (const range of ["30", "90", "365"]) {
      const { status, svg } = await getCard(request, `github=${user}&range=${range}`);
      expect(status).toBe("ok");
      expect(svg).not.toContain("By 12-month period");
    }
    expect((await getCard(request, `github=${user}&yrs=2&range=30`)).status).toBe("invalid_config");
    expect((await hits(request, user)).history).toBe(0);
  });
});

test.describe("studio", () => {
  test("choosing 3 years shows yearly calendars, the period table, and survives reload", async ({ page, request }) => {
    const user = uniqueUser("histui");
    await upstream(request, user, { count: 5 });
    await page.goto(`/?v=1&github=${user}&gitlab=${user}`);
    await expandAll(page);
    const group = page.getByRole("group", { name: /date range/i });
    await group.locator("label", { has: page.getByRole("radio", { name: "3 years" }) }).click();

    const graphic = page.getByRole("img", { name: /^Contribution activity/ }).first();
    await expect(graphic).toHaveAccessibleDescription(/By 12-month period, newest first/);
    await expect(page).toHaveURL(/[?&]yrs=3/);
    await expect(page.getByRole("table", { name: "Contributions by 12-month period" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Contributions by 12-month period" })).toContainText("Not available");
    await expectAccessible(page, "3-year history");
    await expectNoHorizontalScroll(page);

    await page.reload();
    await expect(stepHeading(page)).toHaveText(/design your graphic/i);
    await expandAll(page);
    await expect(page.getByRole("radio", { name: "3 years" })).toBeChecked();
    await expect(graphic).toHaveAccessibleDescription(/By 12-month period/);
  });

  test("GitLab-only accounts can't pick earlier years, and are told why", async ({ page, request }) => {
    const user = uniqueUser("histgl");
    await upstream(request, user, { count: 2 });
    await page.goto(`/?v=1&gitlab=${user}`);
    await expandAll(page);
    const group = page.getByRole("group", { name: /date range/i });
    await expect(group.getByRole("radio", { name: "2 years" })).toBeDisabled();
    await expect(group.getByRole("radio", { name: "3 years" })).toBeDisabled();
    await expect(group).toHaveAccessibleDescription(/GitLab publishes only the last 12 months/);
  });

  test("a legacy 90-day link keeps its range in the studio", async ({ page, request }) => {
    const user = uniqueUser("histold");
    await upstream(request, user, { count: 2 });
    await page.goto(`/?v=1&github=${user}&range=90`);
    await expandAll(page);
    await expect(page.getByRole("radio", { name: /last 90 days \(from your link\)/i })).toBeChecked();
    await expect(page).toHaveURL(/[?&]range=90/);
  });
});

test.describe("phones (375px)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("multi-year design fits without horizontal scrolling", async ({ page, request }) => {
    const user = uniqueUser("histmob");
    await upstream(request, user, { count: 3 });
    await page.goto(`/?v=1&github=${user}&gitlab=${user}&yrs=3`);
    await expandAll(page);
    await page.getByRole("button", { name: "Expand preview" }).click();
    const graphic = page.getByRole("img", { name: /^Contribution activity/ }).first();
    await expect(graphic).toHaveAttribute("width", "840");
    await expectAccessible(page, "3-year history on a phone");
    await expectNoHorizontalScroll(page);
  });
});

test.describe("source attribution", () => {
  test("a published graphic always names its accounts, even if the URL tries to hide them", async ({ request }) => {
    const user = uniqueUser("attr");
    await upstream(request, user, { count: 2 });
    const { svg, desc } = await getCard(request, `github=${user}&f=heatmap,total&hl=`);
    const visible = svg.replace(/<desc[\s\S]*?<\/desc>/, "");
    expect(visible).toContain(`@${user}`);
    expect(desc).toContain(`GitHub @${user}`);
  });
});
