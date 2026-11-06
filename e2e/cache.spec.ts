import { expect, test } from "@playwright/test";
import { E2E_POLICY } from "../playwright.config";
import { freshWindow, getCard, hits, nextWindow, uniqueUser, upstream } from "./helpers";

/*
 * Real Next.js production server + fake upstream, with the freshness window
 * shrunk from 12h to 4s and max staleness from 7d to 12s. One window here
 * stands for 12 hours; "several windows" stands for days without traffic.
 */

test.describe("data freshness and cache layers", () => {
  test("within a window, repeated requests are served from cache (one upstream fetch)", async ({ request }) => {
    const user = uniqueUser("hit");
    await upstream(request, user, { count: 3 });
    await freshWindow();

    expect((await getCard(request, `gitlab=${user}`)).desc).toContain("3 contributions");
    await upstream(request, user, { count: 9 });
    const second = await getCard(request, `gitlab=${user}`);

    expect(second.desc).toContain("3 contributions"); // still the cached snapshot
    expect(await hits(request, user)).toEqual({ github: 0, gitlab: 1, history: 0 });
  });

  test("after days without requests, the first view gets fresh data immediately (no stale-then-refresh)", async ({
    request,
  }) => {
    const user = uniqueUser("idle");
    await upstream(request, user, { count: 3 });
    expect((await getCard(request, `gitlab=${user}`)).desc).toContain("3 contributions");

    await upstream(request, user, { count: 9 });
    await nextWindow(2); // ≈ a day of zero traffic

    const view = await getCard(request, `gitlab=${user}`);
    expect(view.status).toBe("ok");
    expect(view.desc).toContain("9 contributions"); // this request, not the next one
    // The data-age header (used for post-deploy verification) shows a fetch made just now.
    expect(Date.now() - Date.parse(view.res.headers()["x-gitvis-data-as-of"]!)).toBeLessThan(5_000);
    expect(view.svg).not.toContain("Data from");
    expect((await hits(request, user)).gitlab).toBe(2);
  });

  test("a failed refresh serves last-known-good data, clearly labeled and short-lived at the edge", async ({
    request,
  }) => {
    const user = uniqueUser("lkg");
    await upstream(request, user, { count: 5 });
    expect((await getCard(request, `github=${user}`)).status).toBe("ok");

    await upstream(request, user, { mode: "fail" });
    await nextWindow();
    const view = await getCard(request, `github=${user}`);

    expect(view.status).toBe("stale");
    expect(view.desc).toContain("5 contributions");
    expect(view.desc).toMatch(/Showing data last updated .+; a refresh is pending\./);
    expect(view.svg).toContain("Data from");
    expect(view.res.headers()["vercel-cdn-cache-control"]).toBe("public, s-maxage=60, stale-while-revalidate=600");
    expect((await hits(request, user)).github).toBe(2); // the refresh was attempted
  });

  test("once last-known-good data exceeds the maximum age, an honest error card replaces it", async ({ request }) => {
    const user = uniqueUser("expired");
    await upstream(request, user, { count: 5 });
    await getCard(request, `gitlab=${user}`);
    await upstream(request, user, { mode: "fail" });

    await nextWindow();
    expect((await getCard(request, `gitlab=${user}`)).status).toBe("stale");

    await new Promise((r) => setTimeout(r, E2E_POLICY.maxStaleSeconds * 1000 + 500)); // ≈ 7+ days of outage
    const view = await getCard(request, `gitlab=${user}`);
    expect(view.status).toBe("unavailable");
    expect(view.svg).toContain("Contributions temporarily unavailable");
    // Production builds redact errors thrown from "use cache"; outcomes are returned as data so this survives.
    expect(view.svg).toContain("GitLab responded with an error (503)");
    expect(view.svg).not.toContain("5 contributions");
  });

  test("recovers to fresh data as soon as upstream works again", async ({ request }) => {
    const user = uniqueUser("recover");
    await upstream(request, user, { count: 5 });
    await getCard(request, `gitlab=${user}`);
    await upstream(request, user, { mode: "fail" });
    await nextWindow();
    expect((await getCard(request, `gitlab=${user}`)).status).toBe("stale");

    await upstream(request, user, { mode: "ok", count: 11 });
    await nextWindow();
    const view = await getCard(request, `gitlab=${user}`);
    expect(view.status).toBe("ok");
    expect(view.desc).toContain("11 contributions");
  });

  test("a combined card with one platform down labels the stale side instead of a silent partial total", async ({
    request,
  }) => {
    const user = uniqueUser("mixed");
    await upstream(request, user, { count: 4 });
    await getCard(request, `github=${user}&gitlab=${user}`);

    await upstream(request, user, { mode: "fail" }); // both platforms share the fake user
    await nextWindow();
    const view = await getCard(request, `github=${user}&gitlab=${user}`);
    expect(view.status).toBe("stale");
    expect(view.desc).toContain("8 contributions"); // full last-known total, never 4 + nothing
  });

  test("a missing account is reported, not masked by old data", async ({ request }) => {
    const user = uniqueUser("gone");
    await upstream(request, user, { count: 5 });
    await getCard(request, `gitlab=${user}`);
    await upstream(request, user, { mode: "notfound" });
    await nextWindow();
    const view = await getCard(request, `gitlab=${user}`);
    expect(view.status).toBe("not_found");
    expect(view.svg).toContain("Account not found");
  });

  test("ETag revalidation (as GitHub's image proxy does) returns 304 until the data changes", async ({ request }) => {
    const user = uniqueUser("etag");
    await upstream(request, user, { count: 2 });
    await freshWindow();
    const first = await getCard(request, `gitlab=${user}`);
    const etag = first.res.headers()["etag"]!;
    expect(first.res.headers()["cache-control"]).toBe("no-cache, max-age=0");

    const revalidated = await getCard(request, `gitlab=${user}`, { "If-None-Match": etag });
    expect(revalidated.res.status()).toBe(304);

    await upstream(request, user, { count: 6 });
    await nextWindow();
    const changed = await getCard(request, `gitlab=${user}`, { "If-None-Match": etag });
    expect(changed.res.status()).toBe(200);
    expect(changed.desc).toContain("6 contributions");
  });

  test("the studio API and the embed share one cached snapshot", async ({ request }) => {
    const user = uniqueUser("shared");
    await upstream(request, user, { count: 3 });
    await freshWindow();
    await getCard(request, `gitlab=${user}`);
    const api = await request.get(`/api/contributions?gitlab=${user}`, {
      headers: { "x-forwarded-for": "203.0.113.200" },
    });
    expect((await api.json()).results[0]).toMatchObject({ status: "ok", total: 3 });
    expect((await hits(request, user)).gitlab).toBe(1);
  });
});
