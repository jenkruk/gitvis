import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RETENTION } from "@/components/privacy/Privacy";
import { GITVIS_ISSUES_URL, PRIVACY_PATH } from "@/config/site";
import { AVATAR_POLICY } from "@/server/avatars";
import { NOT_FOUND_TTL_SECONDS } from "@/server/cached";
import { DEFAULT_POLICY } from "@/server/freshness";
import { HISTORY_POLICY } from "@/server/history";
import { TRACKED_PATHS } from "../analytics-filter";
import PrivacyPage, { metadata } from "./page";

const HOUR = 3_600;
const DAY = 24 * HOUR;

function renderPage() {
  render(<PrivacyPage />);
  return screen.getByRole("main");
}

describe("privacy page", () => {
  it("has one h1, a machine-readable last-updated date and a heading for every section", () => {
    const main = renderPage();
    expect(within(main).getByRole("heading", { level: 1 })).toHaveTextContent("Privacy");
    expect(
      within(main)
        .getByText(/last updated/i)
        .querySelector("time"),
    ).toHaveAttribute("datetime", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(
      within(main)
        .getAllByRole("heading", { level: 2 })
        .map((h) => h.textContent),
    ).toEqual([
      "At a glance",
      "What GitVis does",
      "Public contribution data",
      "What's cached, and for how long",
      "Website analytics",
      "Hosting and other services",
      "Check it yourself",
      "Contact",
      "Changes",
    ]);
    for (const heading of within(main).getAllByRole("heading", { level: 2 })) {
      expect(heading.closest("section")).toHaveAccessibleName(heading.textContent!);
    }
  });

  it("states the cache lifetimes the server actually uses", () => {
    const snapshotSeconds = (DEFAULT_POLICY.maxStaleMs + DEFAULT_POLICY.ttlMs) / 1000;
    expect(DEFAULT_POLICY.ttlMs / 1000).toBe(12 * HOUR);
    expect(snapshotSeconds).toBe(7.5 * DAY);
    expect(HISTORY_POLICY.completeYear.ttlSeconds).toBe(30 * DAY);
    expect(HISTORY_POLICY.currentYear.ttlSeconds).toBe(DAY);
    expect(AVATAR_POLICY.ttlSeconds).toBe(7 * DAY);
    expect(AVATAR_POLICY.refreshAfterMs / 1000).toBe(DAY);
    expect(AVATAR_POLICY.missingTtlSeconds).toBe(HOUR);
    expect(NOT_FOUND_TTL_SECONDS).toBe(HOUR);

    expect(RETENTION.map((row) => row.kept)).toEqual([
      "Up to about 7½ days",
      "Up to 30 days (the current year: 1 day)",
      "Up to 7 days, refreshed after a day when viewed. A failed lookup is remembered for 1 hour.",
      "1 hour",
    ]);
    expect(RETENTION[0].why).toMatch(/every 12 hours/);
    const list = within(renderPage())
      .getByText(/recent contribution counts/i)
      .closest("dl")!;
    expect(within(list).getAllByRole("term")).toHaveLength(RETENTION.length);
  });

  it("describes exactly the analytics the filter allows", () => {
    expect(TRACKED_PATHS).toEqual(["/", "/studio"]);
    renderPage();
    const analytics = screen.getByRole("region", { name: "Website analytics" });
    for (const path of TRACKED_PATHS) expect(within(analytics).getByText(path, { selector: "code" })).toBeVisible();
    expect(analytics).toHaveTextContent("Before an analytics pageview is sent");
    expect(analytics).toHaveTextContent(/removes query strings and fragments/i);
    expect(analytics).toHaveTextContent(/that visit isn.t counted at all/i);
    expect(analytics).toHaveTextContent(/deliberately undercount/i);
    expect(analytics).toHaveTextContent(/doesn.t use cookies for analytics/i);
  });

  it("avoids claims the implementation can't back", () => {
    const text = renderPage().textContent!;
    expect(text).not.toMatch(/anonymous|GDPR|100%|zero data|never process|secure|guarantee that/i);
    expect(text).not.toMatch(/remove(d)? sooner|delete.*on request/i);
  });

  it("sends privacy questions to public issues with a warning, never to the security advisory form", () => {
    const contact = within(renderPage()).getByRole("region", { name: "Contact" });
    const issues = within(contact).getByRole("link", { name: /^open an issue on GitHub \(opens in a new tab\)$/ });
    expect(issues).toHaveAttribute("href", GITVIS_ISSUES_URL);
    expect(contact).toHaveTextContent(/issues are public, so please don.t include personal or private information/i);
    expect(within(contact).queryByRole("link", { name: /advisor/i })).not.toBeInTheDocument();
    expect(document.querySelector('a[href*="security/advisories"]')).toBeNull();
  });

  it("opens external links in a new tab and says so", () => {
    for (const link of within(renderPage()).getAllByRole("link")) {
      if (!link.getAttribute("href")!.startsWith("http")) continue;
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveAccessibleName(/\(opens in a new tab\)$/);
    }
  });

  it("uses its own title and canonical URL", () => {
    expect(metadata.title).toBe("Privacy");
    expect(metadata.alternates?.canonical).toBe(PRIVACY_PATH);
    expect(metadata.openGraph?.url).toBe(PRIVACY_PATH);
  });
});
