# GitVis — Deployment (controlled public beta on Vercel)

Status: **not deployed.** This document is the plan, the checklist, and the evidence to collect. Background on the decisions is in `ARCHITECTURE.md` ("Freshness policy", "Snapshot storage", "Cache layers", "Abuse protection").

## 1. Environment variables

| Variable                                                                                                   | Production                                  | Preview                            | Notes                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN`                                                                                             | **Required**                                | Recommended (a separate token)     | Fine-grained PAT, **Public repositories (read-only)**, no account or repository permissions. Prefer a dedicated bot account (its own 5,000 points/h budget). Mark it **Sensitive**. |
| `SITE_URL`                                                                                                 | **Required**: `https://<production domain>` | Set to the **same production URL** | The canonical origin for every published URL. Setting it in Preview too protects previews even if system env vars are ever disabled.                                                |
| System environment variables                                                                               | Enabled (default)                           | Enabled (default)                  | `VERCEL_ENV` and `VERCEL_PROJECT_PRODUCTION_URL` drive the production-only origin and the test-override guard.                                                                      |
| `GITVIS_DATA_TTL_SECONDS`, `GITVIS_MAX_STALE_SECONDS`, `GITVIS_GITHUB_GRAPHQL_URL`, `GITVIS_GITLAB_ORIGIN` | **Never set**                               | **Never set**                      | E2E-only. Ignored when `VERCEL_ENV=production`, but don't rely on that.                                                                                                             |
| `GITLAB_TOKEN`                                                                                             | Not used                                    | Not used                           | GitLab GraphQL is deferred; `calendar.json` needs no token.                                                                                                                         |

## 2. Vercel project settings

- **Framework:** Next.js. Build `npm run build`, Node 22.
- **Function region:** keep the **single default region**. The Runtime Cache is regional, so one region keeps every request on one snapshot cache. Don't enable multi-region functions.
- **Deployment Protection:** keep **Vercel Authentication on for preview deployments** (the default). Preview image URLs then can't be embedded by accident, because camo gets a 401.
- **Skew Protection:** optional. It no longer affects GitVis caching, since snapshots don't use deployment-scoped keys.
- **Plan:** Hobby covers the beta's numbers (section 5), but Hobby is **non-commercial, personal use only**. Exceeding a Hobby limit **pauses** that resource for up to 30 days, and for the Runtime Cache that means no snapshots. Move to Pro before a public launch or any commercial use.

## 3. Firewall (Vercel WAF)

Facts from Vercel's docs:

- Hobby allows **1 rate-limit rule**, within 3 custom rules.
- Rate-limit keys on Hobby and Pro are IP or JA4.
- Counters are per region.
- `github-camo` is a **verified bot**, so bot protection and Attack Mode skip it automatically.

| #   | Rule                           | Condition                        | Action                                                            | Why                                                                                                                                                                                                  |
| --- | ------------------------------ | -------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Rate limit studio lookups      | Path equals `/api/contributions` | Rate limit: fixed window 60s, 30 requests, key IP, action **429** | Interactive route; unique usernames cost upstream calls. Start in **Log** for 24–48h, then switch to 429.                                                                                            |
| 2   | Keep embeds reachable          | Path equals `/api/card`          | **Bypass**                                                        | Make sure bot protection or Attack Mode challenges never hit image fetchers. camo is verified anyway, but other Markdown renderers and link previewers aren't, and a JS challenge breaks an `<img>`. |
| 3   | (Optional) Block abuse sources | Specific IPs or JA4 seen in logs | Deny                                                              | Add only from evidence.                                                                                                                                                                              |

- **No IP rate limit on `/api/card`.** camo fetches every README image from a small shared IP pool, so a per-IP limit there could break all embeds at once. That route is protected by the CDN (repeat views never reach a function), the per-instance upstream budget (300 upstream fetches/min), the in-app 600 req/min/IP limit, and strict input validation.
- **Bot protection managed ruleset:** leave it **Off** for the beta. If you turn it on later, rule 2 must be published first.

## 4. Cache and header expectations (production)

| Header on `/api/card`      | Expected value                                                                     | Meaning                                                |
| -------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `cache-control`            | `no-cache, max-age=0`                                                              | camo and browsers always revalidate                    |
| `etag`                     | `"<sha1>"`                                                                         | 304 on unchanged images                                |
| `vercel-cdn-cache-control` | **absent** (Vercel strips it)                                                      | Edge TTL 1h (60s for stale or error cards), SWR 10 min |
| `x-vercel-cache`           | `MISS` → `HIT` → `STALE`                                                           | Edge cache status                                      |
| `x-gitvis-status`          | `ok` / `stale` / `invalid_config` / `not_found` / `unavailable` / `internal_error` | What the image shows                                   |
| `x-gitvis-data-as-of`      | ISO timestamp                                                                      | Age of the upstream data in the image                  |

## 5. Cost model for a low-traffic public beta (Hobby allowances)

Assumptions:

- 50 users, each README viewed about 20×/day, so about 30k views/month.
- Each `<picture>` embed has up to 4 URL variants (full or compact × light or dark).
- About 2 platforms per user.

| Resource                                                                                      | Estimate per month                       | Hobby included | Usage |
| --------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------- | ----- |
| CDN requests (every view revalidates through camo)                                            | ~30k, plus studio traffic                | 1,000,000      | ~3–5% |
| Function invocations (edge misses: ≤ 1/h per URL that's viewed)                               | ≤ 144k (upper bound: 200 URLs × 24 × 30) | 1,000,000      | ≤ 15% |
| Active CPU (~10–20 ms CPU per card render)                                                    | ≤ 0.8 CPU-h                              | 4 CPU-h        | ≤ 20% |
| Runtime Cache reads (1–2 reads per platform per invocation; snapshots are 1–12 KB, 1–2 units) | ≤ ~400k units                            | 1,000,000      | ≤ 40% |
| Runtime Cache writes (2 windows/day × 100 snapshots × 1–2 units)                              | ~6–12k units                             | 200,000        | ~5%   |
| Fast Data Transfer (mostly 304s; ~10–60 KB per 200)                                           | < 5 GB                                   | 100 GB         | < 5%  |
| WAF rate-limit evaluations (`/api/contributions` only)                                        | small                                    | 1,000,000      | ~0%   |

- **First ceiling:** Runtime Cache **reads**, at roughly 10× this traffic (about 500 active users). Options then:
  - move to Pro;
  - raise the edge TTL on `ok` cards (fewer invocations, at the cost of freshness);
  - add an in-process read-through memo (cheap, per instance).
- **GitHub API:** each user costs at most 2 GraphQL calls/day, plus failure retries, against 5,000 points/h.
- **History (Phase 4.2, opt-in `yrs=2|3`):** one GraphQL request per user per **week** at most (all missing years in one aliased query), plus 2–4 Runtime Cache reads per multi-year card invocation (one per calendar year; ~10–25 KB each). Multi-year SVGs are larger (~100–150 KB for 3 years: one titled cell per day), so 200 responses cost more transfer; 304s are unaffected.
- **Avatars (Phase 4, opt-in):** one Runtime Cache read per avatar per card invocation (entries are ≤ ~90 KB base64, so up to ~1–2 units each) and at most one upstream image fetch per avatar per 24h. Cards with avatars are also larger (≤ ~180 KB with two avatars), so 200 responses cost more transfer; 304s are unaffected. At the beta's scale this adds well under 10% to Runtime Cache reads.

## 6. Deployment checklist (do in order; needs approval)

1. [ ] `npm run check && npm run test:e2e && npm run build` pass on the commit being deployed.
2. [ ] Create the Vercel project. Confirm the single function region and Node 22.
3. [ ] Add `GITHUB_TOKEN` (Production; a separate token for Preview) and `SITE_URL` (Production and Preview) as Sensitive env vars. Confirm no `GITVIS_*` vars exist (`vercel env ls`).
4. [ ] Leave preview Deployment Protection on. Leave bot protection Off. Publish the WAF rules from section 3, with rule 1 in Log mode.
5. [ ] Deploy a **preview** first and run section 7, steps A–C, against it, using its protection bypass.
6. [ ] Promote to production. Attach the custom domain, which must match `SITE_URL`.
7. [ ] Run section 7 against production. Record the results in `docs/ROADMAP.md` (Phase 3.2).

## 7. Post-deployment verification

Replace `$SITE` with the production origin and `$Q` with `v=1&github=jenkruk&gitlab=contactkruk&layout=dashboard`.

**A. Headers and edge cache**

```bash
curl -sI "$SITE/api/card?$Q" | grep -iE '^(HTTP|cache-control|etag|vercel-cdn|x-vercel-cache|x-gitvis)'
curl -sI "$SITE/api/card?$Q" | grep -i x-vercel-cache            # expect HIT on the second request
curl -s -o /dev/null -w '%{http_code}\n' -H "If-None-Match: <etag>" "$SITE/api/card?$Q"   # expect 304
```

- [ ] `cache-control: no-cache, max-age=0`; `vercel-cdn-cache-control` absent; an `etag` is present; `x-gitvis-status: ok`.
- [ ] The second request returns `x-vercel-cache: HIT`, and a conditional request returns **304** (on both a MISS and a HIT).
- [ ] A request from a different client (another machine, or the camo URL) also gets `HIT`. Next.js adds `vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch` to route handlers (seen locally); camo and browsers don't send those headers, so all image requests should share one cache variant.

**B. Snapshots survive a deployment.** Note `x-gitvis-data-as-of`, redeploy the same commit, then request a different design variant. That forces an edge miss but reads the same snapshot.

- [ ] `x-gitvis-data-as-of` is unchanged, and the Observability → Runtime Cache read count went up without new writes.

**C. Preview safety**

- [ ] On the preview deployment, the Publish panel shows the preview notice, and every URL in the Markdown uses `$SITE`.
- [ ] `curl -sI https://<preview-url>/api/card?$Q` returns **401** (Deployment Protection).

**D. Real README via camo**

- [ ] Add the snippet (with mobile image and theme matching on) to a test repo's README.
- [ ] github.com desktop in light and dark shows the right variant.
- [ ] A phone (or devtools at 375px) shows the 400px compact image.
- [ ] The image URL is `camo.githubusercontent.com/...`. `curl -sI <camo-url>` shows camo's headers; record its `cache-control` and `etag` behavior.
- [ ] The image isn't a link; "Get Yours" and the GitLab link share one line under it (GitLab right-aligned, in both themes) and both work.

**E. Freshness after idle.** Leave one test card unrequested for **> 13h**: 12h window plus 1h edge, and make sure no README views it.

- [ ] The first request shows `x-gitvis-data-as-of` within seconds of now and `x-gitvis-status: ok`.

**F. Firewall**

- [ ] 31+ rapid requests to `/api/contributions` from one IP are logged by rule 1 (then return 429 once it's switched).
- [ ] `/api/card` is never challenged or blocked (Firewall → traffic for the `/api/card` path).

**G. Monitoring (first week)**

- [ ] Runtime logs show no `[gitvis] unexpected` and no `GitHub rejected GITHUB_TOKEN`.
- [ ] Usage: Runtime Cache reads, function invocations and CDN requests against section 5.

## 8. Rollback

- **Instant:** promote the previous production deployment in Vercel. Snapshots survive (the keys don't depend on the deployment), so READMEs keep rendering current data.
- **If a snapshot shape change misbehaves:** bump `SNAPSHOT_SCHEMA` in `src/server/cached.ts` and redeploy. Old entries are ignored and expire on their own.
- **Kill switch for upstream load:** remove `GITHUB_TOKEN`. GitHub cards then show last-known-good data for up to 7 days, then an explanatory error. GitLab is unaffected.

## 9. Known limits and open questions (verify during the beta)

- **The Runtime Cache is best-effort.** LRU eviction and, on Hobby, a cache shared with the team's other projects mean last-known-good during an outage is likely, not guaranteed.
- **camo's behavior** with `no-cache` + ETag and its fetch timeout are undocumented. The first view in a new window waits on the upstream fetch (5s timeout), and a slower camo timeout could briefly show a broken image.
- **GitHub's sanitizer:** `<picture>`/`<source media>` support for `prefers-color-scheme` is documented by GitHub. `(max-width: 600px)` support is expected, but this is the first real verification (step D).
- **Vercel CDN and conditional requests:** whether the CDN answers `If-None-Match` with a 304 on a cache HIT (step A).
