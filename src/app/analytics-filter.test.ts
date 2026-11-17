import { describe, expect, it } from "vitest";
import { filterAnalyticsEvent, isSafeReferrer } from "./analytics-filter";

const HOST = "gitvis.dev";
const pageview = (url: string) => ({ type: "pageview" as const, url });

describe("analytics referrers", () => {
  it.each([
    ["no referrer (a direct visit or a stripped one)", ""],
    ["GitHub's profile page, which sends only its origin", "https://github.com/"],
    ["GitLab, which sends only its origin", "https://gitlab.com/"],
    ["any origin-only referrer", "https://news.ycombinator.com/"],
    ["an origin with a port", "http://localhost:3000/"],
    ["GitVis itself (never sent by the collector)", "https://gitvis.dev/studio?github=jenkruk#design"],
  ])("keeps %s", (_label, referrer) => {
    expect(isSafeReferrer(referrer, HOST)).toBe(true);
  });

  it.each([
    ["a GitHub profile URL", "https://github.com/jenkruk"],
    ["a profile README repository", "https://github.com/jenkruk/jenkruk"],
    ["a repository README file", "https://github.com/jenkruk/gitvis/blob/main/README.md"],
    ["a GitLab profile URL", "https://gitlab.com/contactkruk"],
    ["an origin with a query", "https://example.com/?user=jenkruk"],
    ["an origin with a fragment", "https://example.com/#jenkruk"],
    ["a path with a query", "https://example.com/posts/1?utm_source=x"],
    ["credentials in the URL", "https://jenkruk:secret@example.com/"],
    ["the old GitVis host with a studio link", "https://gitvis.vercel.app/studio?github=jenkruk"],
    ["an app referrer", "android-app://com.example.app/"],
    ["an unparseable referrer", "not a url"],
  ])("suppresses %s", (_label, referrer) => {
    expect(isSafeReferrer(referrer, HOST)).toBe(false);
  });
});

describe("analytics events", () => {
  it("sends home and studio pageviews without their query or fragment", () => {
    expect(filterAnalyticsEvent(pageview("https://gitvis.dev/studio?v=1&github=jenkruk#design"), "")).toEqual(
      pageview("https://gitvis.dev/studio"),
    );
    expect(filterAnalyticsEvent(pageview("https://gitvis.dev/?sample=1"), "https://github.com/")).toEqual(
      pageview("https://gitvis.dev/"),
    );
  });

  it("drops pageviews outside the allowlist and every custom event", () => {
    expect(filterAnalyticsEvent(pageview("https://gitvis.dev/api/card?github=jenkruk"), "")).toBeNull();
    expect(filterAnalyticsEvent(pageview("https://gitvis.dev/studio/extra"), "")).toBeNull();
    expect(filterAnalyticsEvent({ type: "event", url: "https://gitvis.dev/" }, "")).toBeNull();
  });

  it("drops a pageview whose referrer could identify someone, even on an allowed page", () => {
    expect(filterAnalyticsEvent(pageview("https://gitvis.dev/"), "https://github.com/jenkruk/jenkruk")).toBeNull();
    expect(filterAnalyticsEvent(pageview("https://gitvis.dev/studio"), "https://example.com/?q=jenkruk")).toBeNull();
  });
});
