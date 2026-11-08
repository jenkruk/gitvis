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

`VisualizationConfig` (`src/config/config.ts`) holds layout, feature flags, palette, mode, identity (`style`, `handles`, `avatars`, `name`, `title`), background, platform colors, metric order, range and density. It is plain, serializable data, independent of the dataset. It is updated by a pure `configReducer` (unit-tested) through `useReducer` in the studio. No global state library is needed: the guided steps are one client component (`Studio`) holding the reducer above all three step panels, so navigating never loses state.

- **URL state:** the query string is the Edit link (unchanged v1 contract); the hash holds the current step. Steps are pushed onto history, so Back/Forward work.
- **Starting presets** (`STARTING_PRESETS`, `presetOf`, the `applyPreset` action) are derived from `identity.style` — _Contribution graphic_ = no header, _Developer profile card_ = full header (+ avatars if none were chosen). They change nothing else and add no URL parameter, so every published URL renders exactly as before.
- **Presets never discard identity choices:** name, title and handles are untouched by presets, and the picker remembers the last profile header (style and avatars) so Graphic → Profile restores it instead of the preset defaults.
- **Storybook seam:** `PublishPanel`/`Studio` accept an optional `renderCard(cardUrl) → svg`. Storybook passes one that decodes the real URL and renders it with the production renderer and serializer; production omits it and uses `/api/card`.
- **Curated palettes:** `CURATED_PALETTE_IDS` lists the six shown first; the selected palette is always listed too.

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
- **Range: each platform's own year, so our numbers match its profile** (`platformYear`, `src/domain/history.ts`; verified November 2026). GitHub's "N contributions in the last year" counts from the **Sunday of the week one year back** (366–372 days; its calendar grid shows only 53 weeks, but the headline total covers the whole span). GitLab's "N contributions in the last 12 months" counts from the **same date one year back**. Each source's `coverage` is its own year; the dataset spans their union (GitHub's starts earliest), so GitLab's first few days are unknown, not zero, and tooltips say so. The combined total is the sum of the two profile totals, and `<desc>` states when the start dates differ. GitHub's calendar returns at most 365 days per collection, so the first days come from a second, aliased `contributionsCollection` (`lead`, `@include(if: $hasLead)`) in the same request. If a platform reports activity dated tomorrow-in-UTC (users east of UTC), the window extends by that one day so nothing is silently dropped. GitHub is queried for its year as of fetch time (inside the cached function), so cache keys don't roll over daily. Time zones: we bucket in UTC; GitHub's own default window uses a profile time zone, so counts can differ for activity near midnight.
- **URL state:** the client mirrors usernames into `?github=&gitlab=` (`history.replaceState`) so a reload or shared link reconnects. Phase 3 adds the visualization config to the same URL.
- **Abuse:** see "Abuse protection" and "Production requirements".

## Publish: export and embedding (Phase 3)

### URL contract (v1)

**Source attribution is part of v1.** The decoder applies `withAttribution` to every URL: account labels are on and every connected account is shown, whatever `f` (`labels`) or the legacy `hl` say. The encoder never writes `hl`. This was decided before the first deployment, so no published embed changed; two legacy snapshots that hid labels were re-recorded once, deliberately. **The contract freezes at the first production deployment** — from then on, breaking changes need a new `v`.

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

**Phase 4 params** (optional, added within v1; absent = the original rendering):

| Param   | Values                                                                                                      | Missing        |
| ------- | ----------------------------------------------------------------------------------------------------------- | -------------- |
| `hdr`   | `none` · `compact` · `full`                                                                                 | `none`         |
| `hl`    | handles shown: comma list of `github`, `gitlab` (may be empty)                                              | both           |
| `av`    | avatars shown: comma list of `github`, `gitlab`                                                             | none           |
| `name`  | display name, ≤ 40 characters after sanitizing                                                              | none           |
| `title` | professional title, ≤ 60 characters after sanitizing                                                        | none           |
| `bg`    | `solid` · `gradient` · `transparent`                                                                        | `solid`        |
| `pc`    | platform colors, `github:ff7a59,gitlab:123456`                                                              | palette series |
| `ord`   | stat order: `total` `active` `streak` `best` `current`; a partial list is completed in default order        | default order  |
| `range` | `30` · `90` · `365`                                                                                         | `365`          |
| `den`   | `spacious` · `compact`                                                                                      | `spacious`     |
| `pnl`   | `filled` · `outlined` · `borderless` (Phase 4.2)                                                            | `filled`       |
| `yrs`   | `1` · `2` · `3` 12-month periods (Phase 4.2); `2`/`3` require the full range (with `range=30/90` → invalid) | `1`            |

New palette codes: `github-classic` · `gitlab-inspired` · `nordic-frost` · `solarized` · `midnight-neon` · `paper-ink`. New feature code: `current` (current streak; off unless listed in `f`, so old URLs never gain it).

- **URL codes are a frozen public contract** (`src/publish/card-params.ts`), mapped explicitly to internal ids, so renaming code never breaks old URLs. Golden-URL tests pin this down.
- **Explicit enabled-list semantics:** a feature added later is _off_ for existing URLs, so old embeds never change appearance. Encoders always write the original params (`layout`, `palette`, `mode`, `f`), so changing defaults never alters published images. Phase 4 params are written only when they differ from the **frozen legacy defaults** above, so an unpersonalized config still produces exactly the URL it did before.
- **Legacy snapshot guard:** `src/publish/legacy-render.test.tsx` renders seven pre-Phase-4 URLs (live and sample data) and compares them byte-for-byte with SVGs recorded before Phase 4 (`src/publish/__snapshots__/legacy/`). Never update those snapshots; a diff means an old embed changed.
- **Evolution:** unknown params are ignored, so new optional params (such as future custom colors, reserved as `colors`) can be added within v1. A breaking change bumps `v`, and the decoder keeps a branch for each published version.
- **Validation:** the card endpoint is strict and renders an explanatory error card for an unsupported `v`, invalid usernames, unknown codes, or a query over 2,048 characters (`MAX_QUERY_LENGTH`; the worst-case personalized URL, with a 60-character non-Latin title, is tested to fit).
- **Text params** (`name`, `title`) are NFC-normalized and stripped of control, private-use, unassigned and bidi-override characters (ZWJ/ZWNJ are kept for emoji and scripts that need them). Whitespace is collapsed. React's attribute/text escaping (mirrored by `svg-markup.ts`) handles markup characters. The studio is lenient: an Edit link with a bad value falls back to defaults rather than failing.
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

- **Input limits:** strict validation, a 2,048-character query cap, and bounded render cost (the dataset is ≤ 366 days; layouts are fixed size).
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

### Historical ranges (Phase 4.2)

**Sources (verified November 2026).** GitHub's `contributionsCollection(from, to)` returns a calendar for any period of at most one year, so history is fetched per year. GitLab publishes a calendar for the **last 12 months only** (profile calendar, `calendar.json`, and the experimental GraphQL `contributionCalendar`). Its Events API is not used: it needs a token, misses private contributions the calendar counts, and GitLab prunes events older than 3 years — older GitLab years would be silently undercounted.

**Verified against the real API (Nov 2026, `jenkruk`).** One aliased request returned three complete years; year chunks never leak neighbouring days; New Year boundary days match GitHub's public calendar; a second overlapping load reused every cached year (no request). Daily counts from 2025-04 onward match the public calendar exactly. For older periods made entirely of _private_ contributions, GitHub's own API (`totalContributions` 915 for 2024, identical for any `from`/`to` offset) and its public HTML calendar (923, with a few ±1 day shifts) disagree slightly. GitVis reports the official API faithfully; scraping the HTML calendar would be unsupported and fragile. Re-run with the opt-in check below.

**Opt-in live check:** `GITVIS_LIVE_GITHUB=<login> node --env-file=.env.local node_modules/vitest/vitest.mjs run src/server/github.live.test.ts` (skipped in `npm test`; uses the server token from the environment and never prints it).

**Coverage, not zeros.** `PlatformContributions.coverage` records the dates a source actually reports. `combineSources` seeds a platform's 0 only on covered days, so outside coverage `byPlatform[platform]` is **absent** (unknown). Legacy datasets have no coverage and behave exactly as before.

**One derivation for every view** (`src/renderers/view.ts`, `prepareView`): the years slice (`historyRange`: the newest period — each platform's own year — plus 365-day periods before it), the legacy 30/90-day slice, and `metricsView` — the newest period, where each platform contributes its own published year. Stats, breakdown, trends, the monthly table and the description use `metricsView`; calendars use the full view. The graphic, studio preview and data table all call it, so their numbers can't drift.

- **Combined accounts, 2–3 years:** each period is its own card whose header pairs the dates with that period's total and a coverage label ("GitHub + GitLab" / "GitHub only · GitLab unavailable"). **Summary statistics always describe the newest 12 months and are drawn inside that year's card**, so its border and header ("Nov 2, 2025 – Nov 6, 2026 · GitHub + GitLab") say which year they belong to. The period is also appended to breakdown and chart titles ("Platform breakdown · Last 12 months") and stated in `<desc>` ("Summary statistics: Last 12 months, GitHub + GitLab.") and the data table's headings. Phones (no year cards) and heatmap-less designs use a "Last 12 months · GitHub + GitLab" heading above the stats instead. Cell tooltips say "(GitHub only; GitLab not available)". No hatching.
- **GitHub-only accounts:** the same rule — stats describe the newest 12 months, inside its card — so every multi-year graphic reads the same way.
- **Per-period summaries** (`periodSummaries`): a platform's total is reported only if it covers the **whole** period; otherwise "unavailable". A combined total exists only when every platform is complete (the data table shows "Not available" / "Incomplete").
- **GitHub-only accounts:** full-span stats (complete data).
- **GitLab-only accounts:** the studio disables 2 and 3 years with the reason; a hand-made `yrs` URL renders 12 months plus "The earlier years aren't available: GitLab publishes only the last 12 months."
- **Phones (`size=compact`):** yearly summaries as text plus the readable last-20-weeks heatmap.

**Loading and caching.** `loadContributions(request, loaders, { years })` fetches history in parallel with the newest year (`githubHistory` loader, `src/server/history.ts`):

- History is fetched as **complete calendar years** in one aliased GraphQL request (`y0: contributionsCollection($from0, $to0)`, …; login and dates are variables), and stored **one key per year**: `v1:github-year:<login-lowercase>:<year>`. Keys never move with "today", every 2- or 3-year view reuses them, and after Jan 1 only one new year is fetched.
- Past years are effectively immutable: kept **30 days**, refreshed at most **weekly**, and if a refresh fails the cached copy is served. The current calendar year (reachable only at a leap-year boundary) follows a 12-hour policy. Failures are never written. Concurrent loads share one request; each fetch takes from the upstream budget.
- The trailing 12 months keep the existing 12h snapshot policy, so the newest period stays fresh while history costs ~one request per user per week.
- `/api/contributions?…&years=1|2|3` (anything else → 400). The studio loads 3 years whenever a multi-year design is chosen, so switching 2 ↔ 3 never refetches.
- **Failure policy:** if requested history can't load, the response carries `history: { status, message, retryable }`. Cards show an explanatory "temporarily unavailable" card (60s at the edge) rather than fewer years; the studio shows the last 12 months with a "Try again" notice.

### Panel styles (Phase 4.2)

`pnl` sets how stat cards, the heatmap container, the platform breakdown and chart panels are drawn: **filled** (`surface` + `border`, the original), **outlined** (border only) or **borderless** (an invisible frame: same padding and spacing, no fill or border). Every panel goes through the `Panel` primitive, so the style is applied consistently.

Unfilled panels put their content directly on whatever is behind them, so `applyPanelStyle` re-checks text and muted text (4.5:1), and accent, series and the top heatmap level (3:1), against the **actual backdrops** from `panelBackdrops`: the canvas color (solid), both gradient stops (gradient), or GitHub's page colors for the matching mode (transparent). Filled panels return the theme untouched, so `pnl` absent = byte-identical legacy output. Contrast is tested for all 24 palettes × 2 modes × 3 backgrounds × 2 unfilled styles, including a worst-case custom series color.

### Avatars (Phase 4)

`src/server/avatars.ts` fetches avatars **server-side** and embeds them in the SVG as `data:` URIs:

- GitHub: `https://avatars.githubusercontent.com/<user>?s=96`. GitLab: the public `/api/v4/users?username=` lookup, then its `avatar_url` (gravatar `s=96`, otherwise `width=96`).
- **Host allowlist** (`avatars.githubusercontent.com`, `secure.gravatar.com`, `www.gravatar.com`, `gitlab.com`), at most 2 allowlisted redirects, PNG/JPEG/GIF/WebP only, ≤ 64 KB, 3s timeout. Any failure returns `null` → monogram. Never throws.
- Cached in the Runtime Cache under `v1:avatar:<platform>:<user>` for 24h (misses for 1h), shares the upstream budget, and de-duplicates concurrent fetches.
- Only fetched when the URL asks for a header **and** avatars (`hdr` ≠ `none`, `av` set). Card CSP: `default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox`, so an SVG opened directly can't load anything external either.
- The studio previews through `/api/avatar?platform&username` (60/min/IP, CDN-cached 24h). The client never contacts GitHub/GitLab directly.
- **Privacy:** avatars are already public on both platforms and are only shown when the user opts in. Readers' browsers never contact GitHub, GitLab or Gravatar because of a GitVis image.

### Markdown and downloads

- Markdown: `[![alt](cardUrl)](editUrl)`, or an HTML `<picture>` when theme matching and/or the mobile image is on (the default).
  - The first matching `<source>` wins, so the order is: `(max-width: 600px)` sources pointing at `size=compact`, then the `prefers-color-scheme` sources, then `<img>`.
  - The alt text names the platforms and usernames. The SVG's own `<title>`/`<desc>` carries the numbers.
- **Compact image** (`size=compact`, 400px): reflowed, not shrunk.
  - Stat cards in 2 columns, the last 20 weeks of heatmap (cells ≈ GitHub's 10px on a phone), stacked charts, and wrapped text.
  - `size` is an optional v1 parameter. It's absent from full-size URLs, so every previously published URL is unchanged.
- Profile links (`<a>`) are rendered in published SVGs, where they work when the file is opened directly, but not in the studio's `role="img"` preview, where nested links are unreachable by assistive tech (axe `nested-interactive`).
- **Profile links** (optional): a line of Markdown links under the image (`[GitHub @user](…) · [GitLab @user](…)`), because links inside an SVG don't work through GitHub's `<img>`.
- **Transparent background** forces theme matching (`effectiveSnippetOptions`), so the light variant is never shown on a dark page.
- SVG download fetches the published card. PNG rasterizes that same SVG on a `<canvas>` at 2× (no dependency).

## Security

- Tokens exist only in server environment variables. They never appear in client bundles, URLs, or responses. Network code lives in `src/server/*` behind `import "server-only"`. `src/adapters` is pure and shared (normalization, username validation).
- Usernames are validated against each platform's allowed character set before being interpolated into URLs or GraphQL variables (always passed as **variables**, never by string concatenation).
- No private repository content is ever requested. Only daily counts and, for GitHub, an anonymized restricted count.
- Error responses don't reveal upstream tokens or raw upstream bodies.
- Rate limiting and abuse: see "Abuse protection" and `docs/DEPLOYMENT.md` (WAF rules).

## Third-party code

No code is copied from other projects. GitHub Readme Stats (MIT) and similar projects informed general ideas such as SVG endpoints and cache headers only. If code is ever reused, check its license and record attribution in `NOTICE`.
