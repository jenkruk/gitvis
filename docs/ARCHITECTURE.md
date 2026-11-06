# GitVis — Architecture

## Overview

GitVis is one Next.js (App Router) application. Each concern is a plain TypeScript module with one-way dependencies:

```
                ┌──────────────────────────────────────────────┐
 server only    │ adapters/   GitHub GraphQL · GitLab calendar  │
                └───────────────┬──────────────────────────────┘
                                │ PlatformContributions (normalized)
                ┌───────────────▼──────────────────────────────┐
 shared, pure   │ domain/     ISODate utils · combineSources()  │
                │ metrics/    computeMetrics()                  │
                │ config/     features · layouts · config model │
                │ theme/      palettes · contrast · resolve     │
                │ renderers/  pure React SVG components         │
                └───────┬─────────────────────────┬────────────┘
                        │                         │
           ┌────────────▼──────────┐   ┌──────────▼─────────────────┐
 client    │ components/studio     │   │ app/api/card (planned)     │ server
           │ live preview (inline) │   │ renderToStaticMarkup → SVG │
           └───────────────────────┘   └────────────────────────────┘
```

**Key decision:** renderers are pure React components that emit SVG elements only. They use no hooks, browser APIs, CSS classes, or external fonts. The same component renders the inline studio preview and, via `react-dom/server`, the standalone SVG used for downloads and README embeds. What you see is what you embed.

## Directory layout

```
src/
  app/            Next.js routes (UI shell; API routes later)
  domain/         ISODate type and date math, normalized types, combineSources
  metrics/        pure metric calculations over a ContributionDataset
  adapters/       pure platform normalization + username validation (shared)
  server/         server-only fetchers and caching (tokens live here)
  config/         feature registry, layout definitions, VisualizationConfig + reducer
  theme/          palettes, color math, WCAG contrast
  renderers/      SVG components: heatmap, stats, breakdown, charts, layouts
  fixtures/       deterministic sample data (always provenance: "sample")
  components/     interactive UI (app shell, studio controls)
```

## Domain model

```ts
type ISODate = string & { __brand: "ISODate" }; // "YYYY-MM-DD", a calendar day

interface PlatformContributions {
  // one per connected platform
  platform: PlatformId; // "github" | "gitlab" (extensible)
  username: string;
  profileUrl?: string;
  days: DailyCount[]; // sparse; normalized + sorted
  privateCount?: number; // only when the platform exposes it
  reportedTotal?: number; // platform's own total, for reconciliation
}

interface ContributionDataset {
  // what renderers and metrics consume
  provenance: "live" | "sample";
  range: { start: ISODate; end: ISODate };
  sources: PlatformContributions[];
  days: CombinedDay[]; // dense: one entry per day in range
}

interface CombinedDay {
  date: ISODate;
  total: number;
  byPlatform: Partial<Record<PlatformId, number>>;
}
```

Adding Bitbucket means adding an id to `PLATFORM_IDS`, a metadata entry, and an adapter. Nothing downstream changes.

### Dates without off-by-one errors

- Platforms return **calendar-day keys** already bucketed in their own timezone logic. GitVis treats them as opaque `YYYY-MM-DD` strings and **never parses them with `new Date("YYYY-MM-DD")` in local time**.
- All date math (`addDays`, `diffDays`, `dayOfWeek`, `eachDay`) goes through `Date.UTC` and `getUTC*` and has unit tests, including leap years and DST transition dates.
- "Today" for a viewer is derived explicitly with `todayInTimeZone(tz)` via `Intl.DateTimeFormat`.
- Date labels in SVGs are formatted with `timeZone: "UTC"` from UTC midnight, so they are deterministic on any server.

## Platform integrations (verified November 2026)

### GitHub

- **API:** GraphQL `user(login) { contributionsCollection(from, to) { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } restrictedContributionsCount hasAnyRestrictedContributions } }`.
- **Auth:** GitHub's GraphQL API always requires a token; we observed anonymous requests being rate-limited immediately. Per GitHub's docs, a classic token "with no assigned scopes can only access public information", and every fine-grained token "include[s] read-only access to all public repositories". **Minimum:** a fine-grained PAT with **Public repositories (read-only)** access and **no account or repository permissions**. A no-scope classic PAT works too. Store it server-side as `GITHUB_TOKEN`.
- **Is a dedicated bot account required?** Not for privacy. Contribution results depend on the viewer, but private-repository contributions are only included when the token has the `read:user` scope, and a public-only token can't see private resources anyway. Data from your personal token with no scopes therefore matches what the public sees. (Verified 2026-11-06: with a public-only token, `jenkruk`'s 365 daily counts match the anonymous public profile calendar exactly, and private work appears only as the opted-in anonymized count.) A dedicated account is **recommended for production** for operational reasons: its own 5,000 points/hour rate-limit budget that public traffic can't drain from a personal account, ownership that doesn't depend on one person, and isolation if the token leaks.
- **Unauthenticated alternative (rejected):** scraping the HTML contribution fragment on github.com. It's undocumented and brittle, so we don't use it.
- **Private contributions:** when a user enables "Include private contributions on my profile", daily counts include them anonymously, and `restrictedContributionsCount` reports how many the viewer cannot see. No repository names or content are exposed.
- **Range:** `from`/`to` default to the past year. The API rejects spans longer than one year (observed behavior; not stated on the reference page). Fetch per year if we ever show more.

### GitLab (GitLab.com)

Verified against GitLab.com on 2026-11-06:

| Option                                                                                                                             | Result                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET https://gitlab.com/users/:username/calendar.json`                                                                             | **200 without auth.** Returns a sparse `{ "YYYY-MM-DD": count }` object for roughly the past 12 months. Unknown or inaccessible users get **302** (redirect to sign-in).                                                                                                                                                                                                                                       |
| GraphQL `User.contributionCalendar` (Experiment, 19.5, [MR !260226](https://gitlab.com/gitlab-org/gitlab/-/merge_requests/260226)) | The field **exists in the GitLab.com schema** (validation of `UserContributionCalendar` succeeds). However, **anonymous `user(username:)` queries are denied** on GitLab.com ("resource does not exist or you don't have permission"). It needs an authenticated viewer. It returns `totalCount`, `timezone`, `utcOffset`, and `days { date count }`, or `null` for private, blocked, or unconfirmed profiles. |
| REST `/api/v4/users/:id/events`                                                                                                    | Requires auth for others' events, and returns event details. That is more than we need, so we won't use it.                                                                                                                                                                                                                                                                                                    |

**Decision:** the GitLab adapter uses `calendar.json` as the **only source in V1**. It's unauthenticated and returns the same daily counts. GraphQL `contributionCalendar` is deferred (see ROADMAP "Later") because it is experimental, needs a token on GitLab.com, and would only add timezone metadata. When we adopt it, `calendar.json` stays the fallback for any schema error, `null`, or permission failure, and we verify the minimum token scope then.

**Private contributions:** with the user's "Include private contributions on my profile" setting enabled, GitLab's calendar includes private activity in its daily counts. GitLab **does not expose a separate private total**, so `privateCount` stays `undefined` for GitLab, and the UI must not claim a breakdown it doesn't have.

### Platform semantics (why combined ≠ commits)

|                    | GitHub                                                                                                                                              | GitLab                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Commits            | Only if the email is linked, the repo is not a fork, the commit is on the default branch or `gh-pages`, and the user has a relationship to the repo | Pushed commits (push events), including to forks                                               |
| Issues / PRs / MRs | Opened issues and PRs; PR reviews; discussions                                                                                                      | Created, closed, reopened, merged, and **approved** MRs; issues, epics, milestones, work items |
| Comments           | Not counted on their own                                                                                                                            | **Counted** (issues, MRs, commits, snippets, designs)                                          |
| Other              | Repo creation, forks                                                                                                                                | Wiki and design changes, project creation, membership joins and leaves                         |
| Timezone           | Commit timestamp's zone; browser zone for web actions                                                                                               | Computed by GitLab; GraphQL exposes `timezone`/`utcOffset`                                     |
| History            | Per requested year                                                                                                                                  | Calendar covers 12 months; events pruned after 3 years                                         |

Sources: [GitHub contributions reference](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference), [GitLab contributions calendar](https://docs.gitlab.com/user/profile/contributions_calendar/).

Consequences: GitLab counts tend to run higher for the same amount of work. Labels always say "contributions", the breakdown shows each platform's share, and docs and UI note that counts are not deduplicated.

## State and configuration

`VisualizationConfig` (`src/config/config.ts`) holds layout, feature flags, palette, and mode. It is plain, serializable data, independent of the dataset. It is updated by a pure `configReducer` (unit-tested) through `useReducer` in the studio. No global state library is needed yet. If the Connect → Customize → Publish flow needs cross-route state, we'll introduce Zustand or URL state then.

Feature visibility is computed, never stored: `getFeatureVisibility(featureId, layout, dataset)` returns whether the feature is rendered and why not (layout doesn't support it, or it needs two platforms). Toggles keep their values across layout switches.

## Rendering

- Fixed width (840px), height computed from the enabled sections. System font stack, inline attributes only, no `<style>` or `<script>`. Self-contained, so it survives GitHub's image proxy (camo).
- Each SVG has `role="img"`, `<title>`, and a `<desc>` summarizing the data. Heatmap cells carry `<title>` tooltips. Platforms are distinguished by labels as well as color.
- Heatmap levels: 0 for no activity, then quartiles of non-zero days (`renderers/heatmap-scale.ts`).
- Sample datasets render a visible "Sample data" badge. The badge can't be turned off.

## Connect data flow (Phase 2)

```
ConnectForm (client) ──GET /api/contributions?github=&gitlab=──▶ route handler
                                                                  │ validate usernames (400 on invalid)
                                                                  ▼
                                   src/server/contributions.ts  loadContributions()
                                     ├─ snapshot(github, user, window)  Runtime Cache (getCache)  ─▶ api.github.com/graphql
                                     └─ snapshot(gitlab, user, window)  Runtime Cache (getCache)  ─▶ gitlab.com/users/:u/calendar.json
                                                                  │ PlatformContributions | AdapterError per platform
                                                                  ▼
                                   combineSources(successes, range, "live")  →  { dataset | null, results[] }
```

- **Partial success:** each platform resolves independently. The dataset is built from whichever succeeded, and `results[]` carries a status per requested platform.
- **Caching:** see "Freshness policy". The studio and embeds share the same per-username snapshots.
- **Fetches** have a 5s timeout (the first view in a new window waits on it) (`AbortSignal.timeout`) and a `User-Agent: GitVis`. GitLab is fetched with `redirect: "manual"` so its 302-to-sign-in is detected as "not found or private".
- **Range:** a 365-day window ending on today (UTC). If a platform reports activity dated tomorrow-in-UTC (users east of UTC), the window extends by that one day so nothing is silently dropped. GitHub is queried for the trailing year as of fetch time (inside the cached function), so cache keys don't roll over daily.
- **URL state:** the client mirrors usernames into `?github=&gitlab=` (`history.replaceState`) so a reload or shared link reconnects. Phase 3 adds the visualization config to the same URL.
- **Abuse:** see "Abuse protection" and "Production requirements".

## Publish: export and embedding (Phase 3)

### URL contract (v1)

```
/api/card?v=1&github=jenkruk&gitlab=contactkruk&layout=dashboard&palette=aurora&mode=dark&f=heatmap,total,active,streak,breakdown,trends,labels
```

| Param              | Values                                                                                                                                | Missing                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `v`                | `1`                                                                                                                                   | treated as `1`            |
| `github`, `gitlab` | validated usernames; at least one required                                                                                            | platform not included     |
| `layout`           | `minimal` · `dashboard` · `data-rich`                                                                                                 | v1 default (`dashboard`)  |
| `palette`          | `aurora` · `amethyst` · `desert-sunset` · `ocean-depths` · `forest-gold` · `rose-quartz` · `electric-cobalt` · `ember` · `monochrome` | v1 default (`aurora`)     |
| `mode`             | `light` · `dark`                                                                                                                      | v1 default (`dark`)       |
| `f`                | comma list of **enabled** features: `heatmap` `total` `active` `streak` `best` `breakdown` `trends` `labels`                          | the frozen v1 default set |
| `size`             | `full` · `compact` (400px reflowed mobile image; optional, added within v1)                                                           | `full`                    |

- **URL codes are a frozen public contract** (`src/publish/card-params.ts`), mapped explicitly to internal ids, so renaming code never breaks old URLs. Golden-URL tests pin this down.
- **Explicit enabled-list semantics:** a feature added later is _off_ for existing URLs, so old embeds never change appearance. Encoders always write every param, so changing defaults never alters published images.
- **Evolution:** unknown params are ignored, so new optional params (such as future custom colors, reserved as `colors`) can be added within v1. A breaking change bumps `v`, and the decoder keeps a branch for each published version.
- **Validation:** the card endpoint is strict and renders an explanatory error card for an unsupported `v`, invalid usernames, unknown codes, or a query over 512 characters. The studio is lenient: an Edit link with a bad value falls back to defaults rather than failing.
- The studio uses the **same query string** (`/?v=1&github=…`) as its Edit configuration link and keeps it in sync while you design, so a reload restores everything.

### Rendering

Next.js forbids `react-dom/server` in App Router code (verified: build error "You're importing a component that imports react-dom/server"). Our renderers are pure, hook-free SVG components, so `src/publish/svg-markup.ts` serializes the element tree directly: function components are called, attributes get React's SVG naming and escaping, and there's no dependency. **A parity test asserts byte-identical output to React's `renderToStaticMarkup`** for every layout × palette × mode, so the published image is guaranteed to match the studio preview.

### Freshness policy (Phase 3.1; storage revised in 3.2)

**Why the Phase 3 design was replaced.** It relied on `cacheLife({ revalidate: 12h, expire: 7d })`. Next's docs define `revalidate` as "the next request will trigger a **background** refresh" (it serves stale data) and only `expire` as "the next one waits for fresh content". With little traffic, every view after an idle gap would show data as old as the gap, and only the following view would be fresh. Two more problems surfaced:

- **The default handler drops entries at `revalidate`.** Without `cacheHandlers`, `"use cache: remote"` uses a per-process, in-memory LRU, so stale-on-failure didn't exist there at all.
- **Production builds redact thrown errors.** Errors thrown from a `"use cache"` scope lose their message in production, which was verified in E2E. So "throw to avoid caching" turned specific errors into generic ones.

**Policy** (`src/server/freshness.ts`, independent of cache-handler semantics):

1. Time is split into fixed **12h windows** (epochs). Data is cached as one **immutable snapshot per (platform, username, window)**. The cache key contains the window number, so nothing is ever revalidated in place.
2. **First request in a new window → blocking upstream fetch.** After any idle period (hours or weeks), the first viewer gets fresh data immediately. Maximum data age is 12h. The cost is that one request per window per user waits about 1s for the upstream (fetch timeout 5s).
3. **Fetch fails transiently → last-known-good.** We look up earlier windows' snapshots, newest first. Past windows are **read-only lookups**: a miss never fetches and never writes. We serve the newest successful snapshot younger than **7 days**, marked stale. The image then shows a "Data from <date>" badge and says so in its `<desc>`.
4. **Older than 7 days, or nothing to fall back on → honest error card.** `not_found` is never masked by old data, and it is re-checked after 1h.
5. **Failures are never written.** Only successful snapshots and `not_found` answers are stored.

### Snapshot storage (Phase 3.2: Vercel Runtime Cache via `getCache`)

`src/server/cached.ts` stores snapshots with `getCache({ namespace: "gitvis" })` from `@vercel/functions`, under keys we control: `v1:<platform>:<username>:<window>`.

**Why not `"use cache: remote"`** (the Phase 3.1 implementation): Next.js 16 puts the build ID (or `deploymentId`) in every `use cache: remote` key, so **each deployment starts with an empty cache**. The 7-day last-known-good fallback, and every user's current snapshot, would vanish on each deploy (Vercel docs, Runtime Cache, "How a new deployment affects cached data"). Entries written through `getCache` with our own keys **stay readable across deployments**.

Properties and limits (Vercel docs, verified 2026-11):

- **Regional.** Each region has its own Runtime Cache. Keep functions in **one region** (the default) so all requests share one cache.
- **Isolated by environment.** Preview and production never share entries, so a preview can't poison production snapshots.
- **Best-effort.** It uses LRU eviction at a storage limit. On Hobby, all of a team's projects share one cache, so last-known-good is likely but not guaranteed.
- **Item limit 2 MB.** Snapshots are about 1–12 KB (sparse daily counts), so about 1–2 read/write units of 8 KB each.
- **Schema versioning.** `SNAPSHOT_SCHEMA` in the key: bump it when the stored shape changes. Stored values are validated on read, and malformed entries are treated as misses.
- **Outside Vercel**, `getCache()` falls back to an in-memory cache with the same get/set/TTL semantics, which is what dev and E2E use.
- **Store failures degrade gracefully.** A read error is treated as a miss; a write error still returns the fresh data. Concurrent misses for the same key share one upstream fetch per instance.

**Low-traffic timeline (one user, one README):**

| Situation                            | What the viewer sees                                                           | Upstream calls                |
| ------------------------------------ | ------------------------------------------------------------------------------ | ----------------------------- |
| Several views within a window        | Same snapshot                                                                  | 1 per window                  |
| First view after 3 idle days         | Fresh data, on that request                                                    | 1 (blocking)                  |
| First view after idle, upstream down | Last snapshot ≤ 7 days old, badged "Data from …"                               | 1 attempt + read-only lookups |
| Upstream down > 7 days               | "Contributions temporarily unavailable" error card with the platform's message | 1 attempt per request         |
| Upstream recovers                    | Fresh data on the next request                                                 | 1                             |
| A new deployment                     | Unchanged: snapshots and last-known-good survive                               | 0                             |

All rows except the deployment row are exercised against a real production server in `e2e/cache.spec.ts` (fake upstream, 4s windows). The deployment row is covered by a unit test that uses a new loader instance over the same store, and is a post-deploy verification item. Cron and a database aren't needed.

### Cache layers (worst-case data age ≈ 12h + 1h + 10 min)

| Layer                                   | Setting                                                                                                      | Effect after a long idle period                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Data snapshots                          | Runtime Cache, keyed by 12h window; kept 7.5 days                                                            | Blocking refresh; never stale-then-refresh                                             |
| Vercel CDN (`Vercel-CDN-Cache-Control`) | `public, s-maxage=3600, stale-while-revalidate=600` (stale and error cards: 60s; invalid config: 1h)         | After about 70 min idle the edge refetches synchronously; it can't replay an old image |
| Camo and browsers (`Cache-Control`)     | `no-cache, max-age=0` + strong `ETag`                                                                        | Every view revalidates; unchanged images are a 0-byte `304`                            |
| Studio API (`/api/contributions`)       | `Vercel-CDN-Cache-Control: s-maxage=900, stale-while-revalidate=300`; stale or failed results are `no-store` | Shares the same snapshots as embeds                                                    |

**Why `Vercel-CDN-Cache-Control` and not `CDN-Cache-Control`:** Vercel honors both, but `CDN-Cache-Control` is also forwarded to downstream CDNs and proxies, including GitHub's camo. `Vercel-CDN-Cache-Control` is consumed and stripped by Vercel, so downstream caches see only `no-cache` + `ETag`, which is GitHub's documented advice for images that change. When a targeted header is present, Vercel forwards `Cache-Control` to clients unchanged.

**Camo interaction (expected; verify after deploying):** GitHub serves README images through `camo.githubusercontent.com`. With `no-cache`, camo revalidates using our `ETag`, so unchanged images cost a 304 from the edge. If an image ever sticks, purge it with `curl -X PURGE <camo-url>`. camo is on Vercel's verified-bot list (`github-camo`), so bot protection and Attack Mode don't challenge it.

### Abuse protection

- **Input limits:** strict validation, a 512-character query cap, and bounded render cost (the dataset is ≤ 366 days; layouts are fixed size).
- **Upstream budget** (per instance): at most 300 upstream fetches per minute, so a flood of unique usernames can't drain the shared GitHub quota.
- **In-app per-IP limits** (in memory, per instance): `/api/card` 600/min (camo shares IPs), `/api/contributions` 30/min. The key is `x-real-ip`, which Vercel sets from the connecting address.

**Review: in-memory limits on serverless.** Counters are per instance, so they only blunt bursts that land on one warm instance. They're a cheap second line of defense. The real controls are the CDN (repeat embed traffic never reaches a function), snapshots (repeated usernames are free), the upstream budget, and the **Vercel WAF**. The WAF rules are in `docs/DEPLOYMENT.md`. Key constraints:

- **Hobby allows 1 rate-limit rule.** Spend it on `/api/contributions`, the interactive route where unique usernames cost upstream calls.
- **Don't rate-limit `/api/card` by IP.** GitHub's camo requests come from a small shared IP pool, so an IP limit risks breaking every README at once. The CDN, the upstream budget and the in-app 600/min limit cover it instead.
- **WAF counters are per region.**
- **Never challenge `/api/card`.** Bot protection and Attack Mode let verified bots like camo through, but other image fetchers (other Markdown renderers, link previews) can't solve a JavaScript challenge. Add a WAF _bypass_ rule for `/api/card` before turning either on.

### Production configuration

See **`docs/DEPLOYMENT.md`** for the environment variables, Vercel settings, firewall rules, cost model, and the deployment and post-deployment checklists.

**Preview deployments never publish preview URLs.** `src/server/origin.ts` resolves the public origin in this order:

1. `SITE_URL`
2. `https://VERCEL_PROJECT_PRODUCTION_URL` (set on every Vercel deployment, including previews)
3. the request host, for local development only

A candidate equal to the preview's own hostname (`VERCEL_URL` or `VERCEL_BRANCH_URL`) is rejected even if it was misconfigured into `SITE_URL`. On previews, the Publish panel explains that its URLs point at production. Preview deployments also sit behind Vercel Authentication, so a hand-copied preview image URL would fail in camo rather than become a permanent dependency.

**Test-only overrides are inert in production.** The `GITVIS_*` overrides (fake upstream URLs, shortened windows) are ignored when `VERCEL_ENV=production`.

### Error policy

Card errors return **HTTP 200 with a readable error SVG** (plus `X-GitVis-Status: <code>`), because GitHub shows a broken-image icon for non-2xx responses and README owners need to see what's wrong. Messages come only from the fixed, user-safe adapter and validation strings. Unexpected exceptions become a generic "Something went wrong" card; details are logged server-side and never rendered. If **any** requested platform fails, the card shows an error rather than a silently partial (misleadingly low) total.

### Markdown and downloads

- Markdown: `[![alt](cardUrl)](editUrl)`, or an HTML `<picture>` when theme matching and/or the mobile image is on (the default).
  - The first matching `<source>` wins, so the order is: `(max-width: 600px)` sources pointing at `size=compact`, then the `prefers-color-scheme` sources, then `<img>`.
  - The alt text names the platforms and usernames. The SVG's own `<title>`/`<desc>` carries the numbers.
- **Compact image** (`size=compact`, 400px): reflowed, not shrunk.
  - Stat cards in 2 columns, the last 20 weeks of heatmap (cells ≈ GitHub's 10px on a phone), stacked charts, and wrapped text.
  - `size` is an optional v1 parameter. It's absent from full-size URLs, so every previously published URL is unchanged.
- Profile links (`<a>`) are rendered in published SVGs, where they work when the file is opened directly, but not in the studio's `role="img"` preview, where nested links are unreachable by assistive tech (axe `nested-interactive`).
- SVG download fetches the published card. PNG rasterizes that same SVG on a `<canvas>` at 2× (no dependency).

## Security

- Tokens exist only in server environment variables. They never appear in client bundles, URLs, or responses. Network code lives in `src/server/*` behind `import "server-only"`. `src/adapters` is pure and shared (normalization, username validation).
- Usernames are validated against each platform's allowed character set before being interpolated into URLs or GraphQL variables (always passed as **variables**, never by string concatenation).
- No private repository content is ever requested. Only daily counts and, for GitHub, an anonymized restricted count.
- Error responses don't reveal upstream tokens or raw upstream bodies.
- Rate limiting and abuse: see "Abuse protection" and `docs/DEPLOYMENT.md` (WAF rules).

## Third-party code

No code is copied from other projects. GitHub Readme Stats (MIT) and similar projects informed general ideas such as SVG endpoints and cache headers only. If code is ever reused, check its license and record attribution in `NOTICE`.
