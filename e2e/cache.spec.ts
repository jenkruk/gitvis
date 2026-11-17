import { expect, test } from "@playwright/test";
import { E2E_POLICY } from "../playwright.config";
import { freshWindow, getCard, hits, nextWindow, TTL_MS, uniqueUser, upstream } from "./helpers";

test.describe("data freshness and cache layers", () => {
  test("within a window, repeated requests are served from cache (one upstream fetch)", async ({ request }) => {
    const user = uniqueUser("hit");
    await upstream(request, user, { count: 3 });
    await freshWindow();

    expect((await getCard(request, `gitlab=${user}`)).desc).toContain("3 contributions");
    await upstream(request, user, { count: 9 });
    const second = await getCard(request, `gitlab=${user}`);

    expect(second.desc).toContain("3 contributions");
    expect(await hits(request, user)).toEqual({ github: 0, gitlab: 1, history: 0 });
  });

  test("a brand-new username waits for its first fetch and gets fresh, cacheable data", async ({ request }) => {
    const user = uniqueUser("new");
    await upstream(request, user, { count: 3 });
    const view = await getCard(request, `gitlab=${user}`);
    expect(view.status).toBe("ok");
    expect(view.desc).toContain("3 contributions");
    expect(view.svg).not.toContain("Data from");
    expect((await hits(request, user)).gitlab).toBe(1);
  });

  test("after idle windows, the first view answers with the last snapshot, labelled and uncacheable, then refreshes", async ({
    request,
  }) => {
    const user = uniqueUser("idle");
    await upstream(request, user, { count: 3 });
    expect((await getCard(request, `gitlab=${user}`)).desc).toContain("3 contributions");

    await upstream(request, user, { count: 9 });
    await nextWindow(2);

    const view = await getCard(request, `gitlab=${user}`);
    expect(view.status).toBe("stale");
    expect(view.desc).toContain("3 contributions");
    expect(view.desc).toMatch(/Showing GitLab data last updated .+; a refresh is pending\./);
    expect(view.svg).toContain("Data from");
    expect(view.res.headers()["cache-control"]).toBe("no-cache, max-age=0");
    expect(view.res.headers()["vercel-cdn-cache-control"]).toBe("public, s-maxage=60, stale-while-revalidate=600");

    await expect.poll(async () => (await hits(request, user)).gitlab).toBe(2);
    await expect
      .poll(async () => {
        const next = await getCard(request, `gitlab=${user}`);
        return next.status === "ok" && next.desc.includes("9 contributions") && !next.svg.includes("Data from");
      })
      .toBe(true);
  });

  test("simultaneous first views of a new window share one background refresh", async ({ request }) => {
    const user = uniqueUser("burst");
    await upstream(request, user, { count: 2 });
    await getCard(request, `gitlab=${user}`);
    await nextWindow();

    const views = await Promise.all(Array.from({ length: 5 }, () => getCard(request, `gitlab=${user}`)));
    expect(views.every((v) => v.desc.includes("2 contributions"))).toBe(true);
    await expect.poll(async () => (await getCard(request, `gitlab=${user}`)).status).toBe("ok");
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
    expect(view.desc).toMatch(/Showing GitHub data last updated .+; a refresh is pending\./);
    expect(view.svg).toContain("Data from");
    expect(view.res.headers()["vercel-cdn-cache-control"]).toBe("public, s-maxage=60, stale-while-revalidate=600");
    await expect.poll(async () => (await hits(request, user)).github).toBe(2);
    expect((await getCard(request, `github=${user}`)).status).toBe("stale");
  });

  test("once last-known-good data exceeds the maximum age, an honest error card replaces it", async ({ request }) => {
    const user = uniqueUser("expired");
    await upstream(request, user, { count: 5 });
    await getCard(request, `gitlab=${user}`);
    await upstream(request, user, { mode: "fail" });

    await nextWindow();
    expect((await getCard(request, `gitlab=${user}`)).status).toBe("stale");

    await new Promise((r) => setTimeout(r, E2E_POLICY.maxStaleSeconds * 1000 + 500));
    const view = await getCard(request, `gitlab=${user}`);
    expect(view.status).toBe("unavailable");
    expect(view.svg).toContain("Contributions temporarily unavailable");
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
    await expect.poll(async () => (await getCard(request, `gitlab=${user}`)).status).toBe("ok");
    expect((await getCard(request, `gitlab=${user}`)).desc).toContain("11 contributions");
  });

  test("a combined card with one platform down labels the stale side instead of a silent partial total", async ({
    request,
  }) => {
    const user = uniqueUser("mixed");
    await upstream(request, user, { count: 4 });
    await getCard(request, `github=${user}&gitlab=${user}`);

    await upstream(request, user, { mode: "fail" });
    await nextWindow();
    const view = await getCard(request, `github=${user}&gitlab=${user}`);
    expect(view.status).toBe("stale");
    expect(view.desc).toContain("8 contributions");
  });

  test("a missing account is reported, not masked by old data", async ({ request }) => {
    const user = uniqueUser("gone");
    await upstream(request, user, { count: 5 });
    await getCard(request, `gitlab=${user}`);
    await upstream(request, user, { mode: "notfound" });
    await nextWindow();
    expect((await getCard(request, `gitlab=${user}`)).status).toBe("stale");
    await expect.poll(async () => (await getCard(request, `gitlab=${user}`)).status).toBe("not_found");
    expect((await getCard(request, `gitlab=${user}`)).svg).toContain("Account not found");
  });

  test("fresh cards are cacheable until their window ends, and ETag revalidation returns 304 until the data changes", async ({
    request,
  }) => {
    const user = uniqueUser("etag");
    await upstream(request, user, { count: 2 });
    await freshWindow();
    const requestedAt = Date.now();
    const windowEnd = requestedAt - (requestedAt % TTL_MS) + TTL_MS;
    const first = await getCard(request, `gitlab=${user}`);
    const etag = first.res.headers()["etag"]!;
    const maxAge = Number(/^public, max-age=(\d+)$/.exec(first.res.headers()["cache-control"]!)?.[1]);
    expect(maxAge).toBeGreaterThanOrEqual(1);
    expect(requestedAt + maxAge * 1000).toBeLessThanOrEqual(windowEnd);
    expect(first.res.headers()["vercel-cdn-cache-control"]).toBe(`public, s-maxage=${maxAge}`);

    const revalidated = await getCard(request, `gitlab=${user}`, { "If-None-Match": etag });
    expect(revalidated.res.status()).toBe(304);

    await upstream(request, user, { count: 6 });
    await nextWindow();
    const changed = await getCard(request, `gitlab=${user}`, { "If-None-Match": etag });
    expect(changed.res.status()).toBe(200);
    await expect
      .poll(async () => (await getCard(request, `gitlab=${user}`, { "If-None-Match": etag })).desc)
      .toContain("6 contributions");
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
