# GitVis — Deployment and operations

A maintainer's guide to running GitVis on Vercel. Contributors don't need it to develop locally; see [CONTRIBUTING](../CONTRIBUTING.md). The reasoning behind the caching, security and URL rules is in [ARCHITECTURE](ARCHITECTURE.md).

**Production today:** one Vercel project, served at `https://gitvis.vercel.app`.
**Official domain:** `https://gitvis.app` is chosen but **not yet purchased or connected**. Until it is, `SITE_URL` stays on the current production origin; the compatibility rules for the move are in "Domain and URL compatibility" below.

Settings below are what GitVis requires or recommends. Unless a step says it has been verified, confirm it in the Vercel dashboard rather than assuming it's in place.

## Production configuration

### Environment variables

| Variable                                                                                                   | Production                                                                     | Preview                          | Notes                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN`                                                                                             | **Required**                                                                   | Recommended, as a separate token | Fine-grained PAT with **Public repositories (read-only)** and no other permissions. Prefer a dedicated account (its own 5,000 points/hour budget). Mark it **Sensitive**. |
| `SITE_URL`                                                                                                 | **Required**: the production origin (`https://gitvis.app` once it's connected) | The same production origin       | The origin for every published URL, Edit link, canonical link and Open Graph URL. Page metadata reads it **at build time**, so changing it needs a redeploy.              |
| System environment variables                                                                               | Enabled (the default)                                                          | Enabled                          | `VERCEL_ENV` and `VERCEL_PROJECT_PRODUCTION_URL` drive the origin fallback and disable the test overrides in production.                                                  |
| `GITVIS_DATA_TTL_SECONDS`, `GITVIS_MAX_STALE_SECONDS`, `GITVIS_GITHUB_GRAPHQL_URL`, `GITVIS_GITLAB_ORIGIN` | **Never set**                                                                  | **Never set**                    | E2E-only. Ignored when `VERCEL_ENV=production`, but don't rely on that.                                                                                                   |

GitLab needs no token. `src/server/origin.ts` resolves the public origin as `SITE_URL`, then `VERCEL_PROJECT_PRODUCTION_URL`, then (locally only) the request host, and never uses a preview's own hostname.

### Domain and URL compatibility

Published READMEs embed absolute image URLs, so every host that has ever served them must keep serving them.

- **`gitvis.vercel.app` keeps serving `/api/card` and `/api/label` permanently, with no redirect.** A redirect adds a hop through GitHub's image proxy (camo) and risks broken or stale images in every existing README. After the move to `gitvis.app`, its page routes (`/`, `/studio`) may redirect.
- **Image URLs follow the v1 contract** ([ARCHITECTURE "Published URL contract"](ARCHITECTURE.md#published-url-contract-v1)): never change or remove a URL code, and new params must be optional. `src/publish/__snapshots__/legacy/` must never change.
- **Old studio links** (`/?v=1&…`) redirect to `/studio` from `next.config.ts`; nothing to configure in Vercel.

### Vercel project settings

| Setting               | Required value                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework and runtime | Next.js, `npm run build`, Node 22 (`engines` in `package.json`)                                                                                                                                                                      |
| Function region       | **One region** (the default). The Runtime Cache is regional, so multiple regions would split the snapshot cache.                                                                                                                     |
| Deployment Protection | **Vercel Authentication on for previews.** Preview image URLs then return 401, so they can't be embedded by accident.                                                                                                                |
| Skew Protection       | Optional; snapshot keys don't depend on the deployment.                                                                                                                                                                              |
| Plan                  | Hobby is for **non-commercial, personal use**, and exceeding a Hobby limit **pauses** that resource for up to 30 days; for the Runtime Cache, that means no snapshots. Move to Pro before commercial use or traffic near the limits. |

### Firewall (Vercel WAF)

GitHub fetches every README image through camo, from a small shared IP pool. `github-camo` is on Vercel's verified-bot list, so bot protection and Attack Mode skip it, but other Markdown renderers and link previewers aren't verified and can't solve a JavaScript challenge.

| #   | Rule                      | Condition                        | Action                                         | Notes                                                                      |
| --- | ------------------------- | -------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | Rate-limit studio lookups | Path equals `/api/contributions` | Fixed window 60s, 30 requests, key IP, **429** | Unique usernames cost upstream calls. Start in **Log** mode, then enforce. |
| 2   | Keep images reachable     | Path equals `/api/card`          | **Bypass**                                     | Must exist before bot protection or Attack Mode is ever turned on.         |
| 3   | Block abuse (optional)    | Specific IPs or JA4 from logs    | Deny                                           | Only from evidence.                                                        |

- **Never rate-limit or challenge `/api/card` by IP.** A per-IP limit could break every README at once. The CDN, the upstream budget, the in-app limits and strict validation protect it instead ([ARCHITECTURE "Security and abuse protection"](ARCHITECTURE.md#security-and-abuse-protection)).
- Hobby allows one rate-limit rule (within three custom rules); rate-limit counters are per region. Leave the bot-protection managed ruleset off unless rule 2 is published.

## Releasing an update

1. **Check locally:** `npm run check`, `npm run format:check`, `npm run test:e2e` and `npm run build` all pass on the commit.
2. **Check compatibility** when the change touches these areas:
   - **Card rendering or URL params:** the legacy snapshot test passes unchanged, and every new param is optional, with a golden-URL test.
   - **Stored data shape:** bump `SNAPSHOT_SCHEMA` (`src/server/cached.ts`), `HISTORY_SCHEMA` (`src/server/history.ts`) or the avatar schema (`src/server/avatars.ts`).
   - **Link-label images:** bump `LABEL_VERSION` (`src/publish/snippets.ts`). Labels are cached at the edge for a year, so an unbumped change never reaches existing READMEs.
   - **A new studio query key:** add it to `STUDIO_QUERY_KEYS` (`src/publish/studio-url.ts`).
3. **Deploy a preview** and run the preview checks below, using the protection bypass.
4. **Promote to production**, then run the smoke checks.
5. **After infrastructure changes** (domain, caching headers, firewall, region, plan), also run the full verification.

## Verification

Set `$SITE` to the production origin and `$Q` to `v=1&github=jenkruk&gitlab=contactkruk&layout=dashboard`.

### Smoke checks (every release)

```bash
curl -s "$SITE/" | grep -oE '<link rel="canonical"[^>]*>|<meta property="og:(url|image)"[^>]*>'   # $SITE, never a preview host
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$SITE/?$Q"                              # 307 → $SITE/studio?$Q
curl -sI "$SITE/api/card?$Q" | grep -iE '^(HTTP|cache-control|etag|vercel-cdn|x-vercel-cache|x-gitvis)'
```

| Header on `/api/card`      | Expected                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `cache-control`            | `no-cache, max-age=0` (camo and browsers always revalidate)                                                      |
| `etag`                     | a quoted SHA-1 of the SVG                                                                                        |
| `vercel-cdn-cache-control` | **absent**: Vercel consumes it (edge: 1 hour; stale and unavailable cards 60s; invalid URL and not found 1 hour) |
| `x-vercel-cache`           | `MISS`, then `HIT` on a repeat request                                                                           |
| `x-gitvis-status`          | `ok` (otherwise `stale`, `invalid_config`, `not_found`, `unavailable` or `internal_error`)                       |
| `x-gitvis-data-as-of`      | when the upstream data was fetched                                                                               |

### Preview checks

- The Publish panel shows the preview notice, and every URL in its Markdown uses the production origin.
- `curl -sI "https://<preview-host>/api/card?$Q"` returns **401**.

### Full verification (after infrastructure changes)

**Edge cache and conditional requests**

```bash
curl -sI "$SITE/api/card?$Q" | grep -i x-vercel-cache                                      # HIT on the second request
curl -s -o /dev/null -w '%{http_code}\n' -H 'If-None-Match: <etag>' "$SITE/api/card?$Q"   # 304, on both MISS and HIT
```

- A request from another client also gets a `HIT`. Next.js adds `vary: rsc, next-router-state-tree, …` to route handlers; camo and browsers don't send those headers, so image requests should share one cache entry.

**Snapshots survive a deployment.** Note `x-gitvis-data-as-of`, redeploy the same commit, then request a different design variant (an edge miss that reads the same snapshot). The timestamp is unchanged, and Observability → Runtime Cache shows reads without new writes.

**Freshness after idle.** Leave a test card unrequested for more than 13 hours (the 12-hour window plus the 1-hour edge cache). The first request returns `x-gitvis-status: ok` with `x-gitvis-data-as-of` within seconds of now.

**A real README through camo.** In a test repository, add a snippet with **Match reader's theme** selected:

- github.com shows the right variant in light and dark, signed in with a chosen theme and signed out, on desktop and on a phone (the full 840px image scaled to fit).
- The image URL is `camo.githubusercontent.com/…`; record camo's `cache-control` and `etag` from `curl -sI <camo-url>`.
- The image isn't a link, and "Get Yours · open source on GitHub" sits under the card's credit line, with both links working.

**Old host (after the move to `gitvis.app`).**

```bash
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' "https://gitvis.vercel.app/api/card?$Q"   # 200 image/svg+xml, no redirect
```

**Firewall.** 31+ rapid requests to `/api/contributions` from one IP are logged (or rejected with 429) by rule 1, and Firewall traffic for `/api/card` shows nothing challenged or blocked.

Record the date and outcome of each full verification.

## Monitoring

- **Runtime logs.** All messages start with `[gitvis]`. Act on:
  - `GitHub rejected GITHUB_TOKEN (401)`: the token expired or was revoked; replace it and redeploy.
  - `unexpected … loader failure` or `card render failed`: a bug; cards show a generic error.
  - `snapshot read/write failed` or `history read/write failed`: Runtime Cache trouble; requests still succeed, but last-known-good is at risk.
  - `Neither SITE_URL nor VERCEL_PROJECT_PRODUCTION_URL is usable`: published URLs are falling back to the request host. Fix the environment variables immediately.
- **Usage**, against your plan's included amounts: Runtime Cache reads, function invocations, CDN requests and Fast Data Transfer.
  - **Runtime Cache reads are the first limit to watch.** Every edge miss reads one snapshot per platform, plus one per history year and per avatar. At low traffic this stays well inside Hobby's allowance, but growth multiplies reads first.
  - If reads approach the limit, move to Pro or raise the edge TTL on `ok` cards (fewer function runs, at the cost of freshness).
  - **GitHub API:** each user costs at most about two GraphQL calls a day for the newest year and one a week for history, against 5,000 points per hour. The in-app upstream budget (300 fetches per minute per instance) caps bursts.

## Recovery

- **Bad release:** promote the previous production deployment in Vercel. Snapshot keys don't depend on the deployment, so READMEs keep current data.
- **A stored-shape change misbehaves:** bump the relevant schema constant (see "Releasing an update") and redeploy. Old entries are ignored and expire on their own.
- **Stop upstream load:** remove `GITHUB_TOKEN` and redeploy. GitHub cards serve last-known-good data for up to 7 days, then an explanatory error; GitLab is unaffected.
- **A README image is stuck at an old version:** purge it from camo with `curl -X PURGE <camo-url>`.
- **Upstream outage:** nothing to do. Cards serve last-known-good data, badged "Data from <date>", for up to 7 days.

## Known limits

- **The Runtime Cache is best-effort.** LRU eviction (and, on Hobby, a cache shared with the account's other projects) makes last-known-good likely during an outage, not guaranteed.
- **camo's timeout is undocumented.** The first view in a new 12-hour window waits for the upstream fetch (5s timeout); if camo gives up sooner, that one view shows a broken image.
- **Unverified on Vercel:** whether the CDN answers `If-None-Match` with a 304 on a cache `HIT` (see "Full verification").
