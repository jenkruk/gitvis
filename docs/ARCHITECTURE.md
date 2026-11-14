# GitVis — Architecture

## Overview

GitVis is a single Next.js (App Router) application. Each concern is a plain TypeScript module, and imports point one way only:

```
app → components → publish → renderers → config / theme → metrics → domain
                                  adapters → domain          (pure, shared)
server → publish, renderers, config, theme, metrics, adapters, domain   (server-only)
```

```
          ┌──────────────────────────── browser ────────────────────────────┐
          │ /            landing page (static)                              │
          │ /studio      Connect → Design → Publish (one client component)   │
          │              live preview = the same renderer, inline           │
          └───────────────┬──────────────────────────────────────────────────┘
                          │ GET /api/contributions · /api/avatar
          ┌───────────────▼──────────── server ─────────────────────────────┐
          │ app/api/*        route handlers                                 │
          │ server/          fetchers · snapshot cache · history · avatars  │
          │                  card rendering (renderers + publish/svg-markup)│
          └───────┬───────────────────────────────────────┬─────────────────┘
                  │ GitHub GraphQL · GitLab calendar.json  │ GET /api/card · /api/label
                  ▼                                        ▼
            upstream platforms                    README readers (via GitHub's camo)
```

**Key decision:** renderers are pure React components that emit SVG elements only: no hooks, browser APIs, CSS classes or web fonts. The same components draw the studio preview and the published image, so what you design is what you embed.

### Routes

| Route                | Purpose                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| `/`                  | Static landing page with a live sample showcase                                                  |
| `/studio`            | The studio. Partially prerendered; a URL with accounts loads their data on the server            |
| `/api/card`          | The published SVG (the public URL contract)                                                      |
| `/api/label`         | The small link images under a README card                                                        |
| `/api/contributions` | Contribution data for the studio (`?github=&gitlab=&years=1\|2\|3`)                              |
| `/api/avatar`        | Avatars for the studio preview, proxied so the browser never contacts GitHub, GitLab or Gravatar |
| `/opengraph-image`   | The social preview, drawn by the production renderer from the sample dataset                     |

## Directory layout

```
src/
  app/          routes, layout, global tokens (globals.css), social image
  components/   UI: landing/, studio/, connect/, publish/, shell/, ui/ (recipes, shared controls)
  publish/      URL contract (card-params), snippets, studio URLs, SVG serializer
  renderers/    SVG components: layouts, heatmap, stats, charts, headers, labels, view derivation
  config/       feature registry, layouts, VisualizationConfig + reducer, site constants
  theme/        palettes, color math, WCAG contrast, GitHub page constants
  metrics/      pure metric calculations over a dataset
  domain/       ISODate math, normalized types, combineSources, history periods
  adapters/     pure response normalization and username validation (shared)
  server/       server-only: fetchers, caching, history, avatars, card rendering, origin, rate limits
  fixtures/     deterministic sample data (always provenance: "sample")
  stories/      shared Storybook fixtures
```

## Domain model

```ts
type ISODate = string & { __brand: "ISODate" }; // "YYYY-MM-DD", a calendar day

interface PlatformContributions {
  platform: PlatformId; // "github" | "gitlab"
  username: string;
  days: DailyCount[]; // sparse, normalized, sorted
  coverage?: DateRange | null; // the days this source actually reports
  privateCount?: number; // only when the platform exposes it
  reportedTotal?: number; // the platform's own total, for reconciliation
  fetchedAt?: string;
  stale?: boolean;
}

interface ContributionDataset {
  provenance: "live" | "sample";
  range: DateRange;
  sources: PlatformContributions[];
  days: CombinedDay[]; // dense: one entry per day in range
  freshness?: DatasetFreshness;
}

interface CombinedDay {
  date: ISODate;
  total: number;
  byPlatform: Partial<Record<PlatformId, number>>; // absent = unknown, never 0
}
```

Adding a platform means adding an id to `PLATFORM_IDS`, a metadata entry and an adapter; nothing downstream changes.

**Coverage, not zeros.** `combineSources` seeds a platform's 0 only on days inside its `coverage`. Outside it, `byPlatform[platform]` is absent (unknown), is never summed into combined totals, and is labelled as unavailable rather than shown as zero.

### Dates

- Platforms return calendar-day keys already bucketed by their own time-zone logic. GitVis treats them as opaque `YYYY-MM-DD` strings and never parses them with `new Date("YYYY-MM-DD")` in local time.
- All date math (`src/domain/dates.ts`) uses `Date.UTC` and `getUTC*`, with tests covering leap years and DST dates. "Today" is derived explicitly with `todayInTimeZone(tz)`.
- SVG date labels are formatted with `timeZone: "UTC"`, so output is identical on any server.

## Platform integrations (verified November 2026)

### GitHub

- **API:** GraphQL `user(login) { contributionsCollection(from, to) { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } restrictedContributionsCount hasAnyRestrictedContributions } }`. Usernames and dates are always passed as GraphQL variables.
- **Auth:** the GraphQL API requires a token; anonymous requests are rate-limited immediately. The minimum is a fine-grained PAT with **Public repositories (read-only)** and no account or repository permissions (a no-scope classic PAT also works), stored server-side as `GITHUB_TOKEN`. Such a token sees exactly what the public profile shows, so a personal token is safe for privacy; a dedicated account is still recommended for production for its own rate-limit budget and ownership (see DEPLOYMENT).
- **Private contributions:** when a user enables "Include private contributions on my profile", daily counts include them anonymously and `restrictedContributionsCount` reports how many the viewer can't see. No repository names or content are exposed.
- **One year per collection:** `contributionsCollection` rejects spans longer than a year, so longer history is fetched one calendar year per aliased collection (see "Multi-year history").
- Scraping github.com's HTML calendar was rejected: it's undocumented and brittle. For some older years made entirely of private contributions, the API's totals and the HTML calendar differ slightly; GitVis reports the API.

### GitLab (GitLab.com)

| Option                                                   | Result                                                                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET https://gitlab.com/users/:username/calendar.json`   | **200 without auth.** A sparse `{ "YYYY-MM-DD": count }` object for about the last 12 months. Unknown or private users get a **302** to sign-in. |
| GraphQL `User.contributionCalendar` (experimental, 19.5) | Exists, but anonymous `user(username:)` queries are denied on GitLab.com. Needs an authenticated viewer; adds only time-zone metadata.           |
| REST `/api/v4/users/:id/events`                          | Needs auth for other users, returns event details, misses private contributions the calendar counts, and events older than 3 years are pruned.   |

**Decision:** `calendar.json` is the only GitLab source. GraphQL is deferred; if adopted, `calendar.json` stays the fallback for any schema error, `null` or permission failure. GitLab history is therefore **the last 12 months only**.

GitLab's calendar includes private activity when the user opts in, but GitLab exposes no separate private total, so `privateCount` stays `undefined` and the UI never claims a breakdown it doesn't have.

### Platform semantics (why combined ≠ commits)

|                    | GitHub                                                                                                                                              | GitLab                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Commits            | Only if the email is linked, the repo is not a fork, the commit is on the default branch or `gh-pages`, and the user has a relationship to the repo | Pushed commits (push events), including to forks                                               |
| Issues / PRs / MRs | Opened issues and PRs; PR reviews; discussions                                                                                                      | Created, closed, reopened, merged, and **approved** MRs; issues, epics, milestones, work items |
| Comments           | Not counted on their own                                                                                                                            | **Counted** (issues, MRs, commits, snippets, designs)                                          |
| Other              | Repo creation, forks                                                                                                                                | Wiki and design changes, project creation, membership joins and leaves                         |
| Timezone           | Commit timestamp's zone; browser zone for web actions                                                                                               | Computed by GitLab                                                                             |
| History            | Any year, one year per request                                                                                                                      | Calendar covers 12 months; events pruned after 3 years                                         |

Sources: [GitHub contributions reference](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference), [GitLab contributions calendar](https://docs.gitlab.com/user/profile/contributions_calendar/).

GitLab counts tend to run higher for the same work. Labels always say "contributions", the breakdown shows each platform's share, and the graphic and docs state that totals aren't deduplicated.

## Loading contributions

```
studio / card ──▶ loadContributions(request, loaders, { years })     src/server/contributions.ts
                    ├─ snapshot(github, user, window) ─▶ api.github.com/graphql
                    ├─ snapshot(gitlab, user, window) ─▶ gitlab.com/users/:u/calendar.json
                    └─ githubHistory(user, years)      ─▶ one aliased GraphQL request (years > 1)
                  ▼  PlatformContributions | AdapterError per platform
                combineSources(successes, range, "live") → { dataset | null, results[], history? }
```

- **Partial success:** platforms resolve independently; `results[]` carries a status per requested platform. The studio can continue with the platforms that loaded. A card never does (see "Error policy").
- **Fetches:** `User-Agent: GitVis`, `AbortSignal.timeout` (5s for the newest year, 8s for history, 3s for avatars). GitLab is fetched with `redirect: "manual"` so its 302 reads as "not found or private".
- **The newest period is each platform's own published year** (`platformYear`, `src/domain/history.ts`), so each platform's number matches its profile:
  - GitHub's "contributions in the last year" starts on the **Sunday of the week one year back** (366–372 days). The calendar returns at most 365 days, so the first days come from a second, aliased collection in the same request.
  - GitLab's "contributions in the last 12 months" starts on the **same date one year back**.
  - Each source's `coverage` is its own year and the dataset spans their union, so GitLab's first few days are unknown, not zero. The combined total is the sum of the two profile totals, and `<desc>` states each start date when they differ.
  - Activity dated tomorrow-in-UTC (users east of UTC) extends the window by that day so nothing is dropped. GitVis buckets in UTC; GitHub's own window uses the profile time zone, so counts can differ for activity near midnight.

### Freshness policy

`src/server/freshness.ts`, independent of any cache handler:

1. Time is split into fixed **12-hour windows**. Data is cached as one **immutable snapshot per (platform, username, window)**; the window is part of the key, so nothing is revalidated in place.
2. **The first request in a new window fetches upstream and waits for it.** After any idle period, the first viewer gets fresh data; maximum data age is 12 hours.
3. **A transient failure falls back to last-known-good:** earlier windows are read (never fetched or written) and the newest successful snapshot under **7 days** old is served, marked stale. The image shows a "Data from <date>" badge and says so in `<desc>`.
4. **Older than 7 days, or nothing to fall back on:** an honest error card. `not_found` is never masked by old data and is re-checked after an hour.
5. **Failures are never written.** Only successful snapshots and `not_found` answers are stored.

Next's `cacheLife` was rejected for this: `revalidate` serves stale data and refreshes in the background, so with low traffic every view after an idle gap would show data as old as the gap. Errors thrown inside `"use cache"` also lose their message in production builds.

### Snapshot storage

`src/server/cached.ts` stores snapshots in the **Vercel Runtime Cache** (`getCache({ namespace: "gitvis" })` from `@vercel/functions`) under keys GitVis controls: `v<SNAPSHOT_SCHEMA>:<platform>:<username>:<window>`, kept for the 7-day fallback plus one window.

`"use cache: remote"` isn't used because Next.js puts the build ID in every key, so each deployment would start empty and lose every snapshot and the 7-day fallback. `getCache` entries with our own keys survive deployments.

- **Regional and per environment:** keep functions in one region so requests share a cache. Preview and production never share entries.
- **Best effort:** LRU eviction; on Hobby, a team's projects share one cache, so last-known-good is likely but not guaranteed.
- **Small entries:** snapshots are about 1–12 KB (sparse daily counts) against a 2 MB item limit.
- **Schema versioning:** bump `SNAPSHOT_SCHEMA` when the stored shape changes. Values are validated on read; malformed entries are misses.
- **Degrades gracefully:** a read error is a miss, a write error still returns fresh data, and concurrent misses for the same key share one upstream fetch per instance.
- **Outside Vercel**, `getCache()` falls back to an in-memory store with the same semantics (dev and E2E).

| Situation                            | What the viewer sees                               | Upstream calls                |
| ------------------------------------ | -------------------------------------------------- | ----------------------------- |
| Several views within a window        | The same snapshot                                  | 1 per window                  |
| First view after days of no traffic  | Fresh data, on that request                        | 1 (blocking)                  |
| First view after idle, upstream down | Last snapshot ≤ 7 days old, badged "Data from …"   | 1 attempt + read-only lookups |
| Upstream down for more than 7 days   | "Contributions temporarily unavailable" error card | 1 attempt per request         |
| A new deployment                     | Unchanged: snapshots and last-known-good survive   | 0                             |

`e2e/cache.spec.ts` exercises these against a production build with a fake upstream and 4-second windows; deployment survival is covered by a unit test over a shared store.

### Multi-year history

- `yrs=2|3` (at most `MAX_HISTORY_YEARS` = 3) adds earlier 12-month periods. History is **GitHub only**: GitLab publishes only the last 12 months.
- `src/server/history.ts` fetches **complete calendar years** in one aliased GraphQL request and stores **one key per year** (`v<HISTORY_SCHEMA>:github-year:<login>:<year>`). Keys never move with "today", so 2- and 3-year views share them and only one new year is fetched after January 1.
- Complete years are kept 30 days and refreshed at most weekly, serving the cached copy if a refresh fails; a current calendar year, if requested, refreshes every 12 hours. Failures are never written; concurrent loads share one request.
- The studio loads 3 years whenever a multi-year design is chosen, so switching 2 ↔ 3 never refetches.
- **If requested history can't load**, the response carries `history: { status, message, retryable }`. Cards show a "temporarily unavailable" card rather than fewer years; the studio shows the last 12 months with a "Try again" notice.

## Studio state and URLs

`VisualizationConfig` (`src/config/config.ts`) holds layout, feature flags, palette, mode, identity, background, platform colors, metric order, range, density, panel style and years. It's plain serializable data, independent of the dataset, updated by the pure `configReducer`. The guided steps are one client component (`Studio`) holding the reducer above all three steps, so moving between steps never loses state; no global state library is needed.

- **Feature visibility is computed, never stored:** `getFeatureVisibility(featureId, layout, dataset)` says whether a feature renders and why not (the layout can't show it, or it needs two platforms). Switching layouts keeps every toggle's value.
- **Starting presets** (`STARTING_PRESETS`, `applyPreset`) are derived from `identity.style`: _Contribution graphic_ = no header, _Developer profile card_ = full header (plus avatars if none were chosen). They change nothing else and add no URL parameter. Name, title and handles are never touched, and the picker remembers the last profile header so Graphic → Profile restores it.
- **URL state:** the query string is the Edit link (the same v1 encoding as the card URL, at `/studio?…`) and the hash is the current step. Steps are pushed onto history, so Back/Forward work, and the query is kept in sync while designing, so a reload restores everything. `sample=1` opens Design on the sample data until accounts are connected. Bad values in an Edit link fall back to defaults rather than failing.
- **Old studio URLs:** the studio used to live at `/`. `next.config.ts` redirects (307) any `/` request carrying a studio query key (`STUDIO_QUERY_KEYS`, `src/publish/studio-url.ts`, checked against the encoder by a test) to `/studio` with the query unchanged; browsers keep the `#step` fragment. A bare `/#design` is forwarded on the client. `/` without studio keys (for example the README "Get Yours" link) shows the landing page.
- **Landing showcase:** `src/components/landing/showcase.ts` builds its config with `configReducer` (palette, mode and preset only) and renders it with the production `Visualization` on the sample dataset. Its links carry the design, never accounts, to the studio.
- **Curated palettes:** `CURATED_PALETTE_IDS` lists the six shown first. Collapsed, the list always shows six; a selected palette outside them takes `CURATED_SWAP_PALETTE_ID`'s slot.
- **Storybook seam:** `PublishPanel`/`Studio` accept an optional `renderCard(cardUrl) → svg`. Storybook renders the real URL offline with the production decoder, renderer and serializer; production uses `/api/card`.

## Rendering

- **One derivation for every view** (`prepareView`, `src/renderers/view.ts`): the period slices for the chosen years or legacy 30/90-day range, and `metricsView`, the newest period. Stats, breakdown, trends, the data tables and `<desc>` use `metricsView`; calendars use the full view. The graphic, the studio preview and the "Detailed contribution data" tables all call it, so their numbers can't drift.
- **Accessible SVG:** `role="img"`, a `<title>`, and a `<desc>` summarizing the data. Platforms are distinguished by labels as well as color. Per-day `<title>` tooltips appear in the studio preview only; published cards omit them (a README image can't show them) to stay small.
- **Heatmap levels:** 0 for no activity, then quartiles of the non-zero days (`src/renderers/heatmap-model.ts`).
- **Sample data** always renders a "Sample data" badge that can't be turned off.
- **Multi-year designs:** each 12-month period is its own year card, headed by its dates, its total and a coverage label ("GitHub + GitLab" / "GitHub only · GitLab unavailable"). Summary statistics always describe the newest 12 months and sit inside that year's card; the period is also named in panel titles, `<desc>` and the data tables. A platform's period total is shown only when it covers the whole period, and a combined total only when every platform does. A hand-written `yrs` URL for a GitLab-only account renders 12 months plus a note that earlier years aren't available; the studio disables the option with the reason.
- **Panel styles** (`pnl`): filled (the original), outlined or borderless, applied through the `Panel` primitive. Unfilled panels put content directly on the backdrop, so `applyPanelStyle` re-checks text (4.5:1) and accent, series and the top heatmap level (3:1) against the actual backdrops from `panelBackdrops` (canvas, both gradient stops, or GitHub's page colors for transparent). Filled panels return the theme untouched, so legacy output stays byte-identical. Contrast is tested for every palette × mode × background × unfilled style.

### Image width

The published SVG is **840px wide** (`CANVAS_WIDTH`) with a height computed from the enabled sections. GitHub displays README images in a column about **830px** wide (`GITHUB_README_WIDTH`) and scales the image down to fit, so text sizes are chosen for the scaled result (the smallest text is 10px at 840). The studio caps its preview at the same 830px so it matches what readers see. `size=compact` renders a reflowed **400px** layout (two-column stats, the last 20 weeks of heatmap, stacked charts); snippets no longer produce it, but existing URLs keep rendering it.

### SVG serialization

Next.js forbids `react-dom/server` in App Router route handlers, so `src/publish/svg-markup.ts` serializes the renderer's element tree directly: function components are called, attributes get React's SVG naming and escaping, and nothing else is supported (renderers must stay hook-free with inline attributes). **A parity test asserts byte-identical output to React's `renderToStaticMarkup`** for every layout × palette × mode, so the published image matches the studio preview.

### Avatars

`src/server/avatars.ts` fetches avatars server-side and embeds them as `data:` URIs; a rendered SVG never references an external URL.

- GitHub: `avatars.githubusercontent.com/<user>?s=96`. GitLab: the public `/api/v4/users?username=` lookup, then its `avatar_url`.
- Host allowlist (`avatars.githubusercontent.com`, `secure.gravatar.com`, `www.gravatar.com`, `gitlab.com`), at most two allowlisted redirects, PNG/JPEG/GIF/WebP only, ≤ 64 KB, 3s timeout. Any failure falls back to a monogram; it never throws.
- Cached 24 hours (misses for 1 hour), counted against the upstream budget, with concurrent fetches de-duplicated. Fetched only when a header with avatars is requested.
- The studio previews through `/api/avatar`, so readers' and designers' browsers never contact GitHub, GitLab or Gravatar because of GitVis.

## Published URL contract (v1)

```
/api/card?v=1&github=jenkruk&gitlab=contactkruk&layout=dashboard&palette=aurora&mode=dark&f=heatmap,total,active,streak,breakdown,trends,labels
```

| Param              | Values                                                                                                                 | Missing                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `v`                | `1`                                                                                                                    | treated as `1`            |
| `github`, `gitlab` | validated usernames; at least one required                                                                             | platform not included     |
| `layout`           | `minimal` · `dashboard` · `data-rich`                                                                                  | `dashboard`               |
| `palette`          | one of 24 codes (`PALETTE_CODES` in `src/publish/card-params.ts`), e.g. `aurora`, `github-classic`                     | `aurora`                  |
| `mode`             | `light` · `dark`                                                                                                       | `dark`                    |
| `f`                | comma list of **enabled** features: `heatmap` `total` `active` `streak` `best` `breakdown` `trends` `labels` `current` | the frozen v1 default set |
| `size`             | `full` · `compact`                                                                                                     | `full`                    |
| `hdr`              | `none` · `compact` · `full` · `centered`                                                                               | `none`                    |
| `av`               | avatars shown: comma list of `github`, `gitlab`                                                                        | none                      |
| `name`, `title`    | display name (≤ 40) and title (≤ 60), after sanitizing                                                                 | none                      |
| `left`             | centered header: the platform on the left, `github` · `gitlab`                                                         | `github`                  |
| `avs`              | compact/full header: the avatars' side, `left` · `right`                                                               | `left`                    |
| `bg`               | `solid` · `gradient` · `transparent`                                                                                   | `solid`                   |
| `pc`               | platform colors, `github:ff7a59,gitlab:123456`                                                                         | palette series            |
| `ord`              | stat order: `total` `active` `streak` `best` `current`; a partial list is completed in default order                   | default order             |
| `range`            | `30` · `90` · `365`                                                                                                    | `365`                     |
| `den`              | `spacious` · `compact`                                                                                                 | `spacious`                |
| `pnl`              | `filled` · `outlined` · `borderless`                                                                                   | `filled`                  |
| `yrs`              | `1` · `2` · `3` 12-month periods; `2`/`3` require the full range                                                       | `1`                       |
| `hl`               | legacy handle list; still validated, but has no effect: every connected account is always shown                        | —                         |

**Compatibility rules** (`src/publish/card-params.ts`):

- **URL codes are frozen.** They're mapped explicitly to internal ids, so renaming code never breaks old URLs, and golden-URL tests pin every code.
- **Enabled-list semantics:** features added later are off for existing URLs, so old embeds never gain them. The encoder always writes `layout`, `palette`, `mode` and `f`, so changing defaults never alters published images. Every other param is written only when it differs from the **frozen legacy default**, so an unpersonalized design still produces the original URL.
- **Source attribution is mandatory:** the decoder applies `withAttribution` to every URL, so account labels are on and every connected account is shown whatever `f` or `hl` say. The combined total can't be turned off either.
- **Legacy snapshots:** `src/publish/legacy-render.test.tsx` renders seven original v1 URLs (live and sample data) and compares them byte-for-byte with `src/publish/__snapshots__/legacy/`. Never update those files; a diff means an old embed changed.
- **Evolution:** unknown params are ignored, so optional params can be added within v1. **The contract freezes at the first production deployment;** after that, a breaking change needs a new `v`, and the decoder keeps a branch for each published version.
- **Validation:** the card endpoint is strict. An unsupported `v`, invalid usernames, unknown codes or a query over 2,048 characters (`MAX_QUERY_LENGTH`; the worst-case personalized URL is tested to fit) render an explanatory error card.
- **Text params** (`name`, `title`) are NFC-normalized and stripped of control, private-use, unassigned and bidi-override characters (ZWJ/ZWNJ are kept). Whitespace is collapsed, and markup characters are escaped by the serializer.

## README snippet and downloads

- **The image** is always an unlinked `<picture>` inside `<p align="center">` (GitHub auto-links a plain Markdown image, but not a `<picture>`). Its alt text names the platforms and usernames; the SVG's own `<title>`/`<desc>` carries the numbers.
- **Theme matching** adds `prefers-color-scheme` `<source>`s for the light and dark variants; transparent backgrounds always use it (`effectiveSnippetOptions`). Snippets never use width media or `size=compact`: for signed-in readers with a chosen theme, GitHub's `<themed-picture>` rewrites media queries that mention `prefers-color-scheme` and drops width conditions, which would serve the phone image on desktops.
- **Links under the image:** one centered line with "Get Yours" (the production origin, i.e. the landing page) and "· open source on GitHub" (`GITVIS_REPO_URL`). The graphic itself contains no links, since a README image can't be clicked. GitHub strips widths, colors and padding from README HTML, so each link is an image from `/api/label` (`src/renderers/LinkLabel.tsx`) sized so the two together match the card's width, colored with the design's GitLab color and adjusted to 4.5:1 on GitHub's page. Text is fixed or a validated username, never free text. **Label images are cached for up to a year at the edge**, so any change to a label's image must bump `LABEL_VERSION` in `src/publish/snippets.ts`. The route still serves the `gitlab=`, `span` and `inset` variants that older snippets use.
- **Downloads:** SVG fetches the published card; PNG rasterizes that same SVG on a `<canvas>` at 2× (no dependency).

## Caching and delivery

Worst-case data age is about 12 hours (snapshot window) + 1 hour (edge) + 10 minutes (stale-while-revalidate).

| Layer                                   | Setting                                                                                                                           | Effect                                                       |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Data snapshots                          | Runtime Cache, 12-hour windows, 7-day last-known-good                                                                             | Blocking refresh after idle; never stale-then-refresh        |
| Vercel CDN (`Vercel-CDN-Cache-Control`) | Cards: `public, s-maxage=3600, stale-while-revalidate=600` (stale, unavailable and error cards 60s; invalid URL and not found 1h) | After about 70 idle minutes the edge refetches synchronously |
| Browsers and camo (`Cache-Control`)     | Cards: `no-cache, max-age=0` + strong `ETag`                                                                                      | Every view revalidates; an unchanged image is a 0-byte `304` |
| `/api/contributions`                    | `s-maxage=900, stale-while-revalidate=300`; stale or failed results `no-store`                                                    | Shares the same snapshots as cards                           |
| `/api/label`, `/api/avatar`             | Labels: edge 1 year, browsers 1 day. Avatars: edge 24 hours                                                                       | Labels change only with a new `LABEL_VERSION`                |

`Vercel-CDN-Cache-Control` is used instead of `CDN-Cache-Control` because Vercel consumes and strips it, so downstream caches, including GitHub's camo, see only `no-cache` + `ETag`, which is GitHub's documented advice for images that change. camo is on Vercel's verified-bot list. Operational details (firewall rules, purging a stuck camo image, post-deployment checks) are in [DEPLOYMENT](DEPLOYMENT.md).

## Error policy

Card errors return **HTTP 200 with a readable error SVG** and an `X-GitVis-Status` header, because GitHub shows a broken-image icon for any non-2xx response and README owners need to see what's wrong. Messages come only from fixed, user-safe adapter and validation strings; unexpected exceptions become a generic "Something went wrong" card, with details logged on the server only. If **any** requested platform (or requested history) fails, the card shows an error rather than a silently partial, misleadingly low total.

## Security and abuse protection

- **Tokens** exist only in server environment variables and never appear in client bundles, URLs or responses. Network code lives in `src/server/*` behind `import "server-only"`; `src/adapters` is pure.
- **Usernames** are validated against each platform's allowed characters before they reach a URL or GraphQL variable.
- **Privacy:** no private repository content is ever requested; only daily counts and, for GitHub, an anonymized restricted count. Avatars are public and shown only when the user opts in.
- **Card CSP:** `default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox`, so an SVG opened directly can't load or run anything.
- **Errors** never reveal tokens or raw upstream bodies.
- **Bounded cost:** strict validation, the 2,048-character query cap, fixed-size layouts and at most three years of data per render.
- **Upstream budget:** at most 300 upstream fetches per minute per instance, so a flood of unique usernames can't drain the shared GitHub quota.
- **Per-IP limits** (in memory, per instance, keyed on `x-real-ip`): `/api/card` 600/min (camo shares a small IP pool), `/api/contributions` 30/min, `/api/avatar` 60/min. These only blunt bursts on one warm instance; the real controls are the CDN, snapshots, the upstream budget and the Vercel WAF. Never rate-limit or challenge `/api/card` by IP at the WAF: camo's shared IPs would break every README at once, and other image fetchers can't solve a JavaScript challenge. The WAF rules are in [DEPLOYMENT](DEPLOYMENT.md).

### Production origin

Published URLs and page metadata must never point at a preview or the request host. `src/server/origin.ts` resolves the public origin from `SITE_URL`, then `https://VERCEL_PROJECT_PRODUCTION_URL`, then (local development only) the request host, and rejects any candidate equal to the preview's own hostname. The canonical origin is `https://gitvis.app` (see [DEPLOYMENT "Domain and URL compatibility"](DEPLOYMENT.md#domain-and-url-compatibility)); images already published from `gitvis.vercel.app` keep working there. Page metadata uses `siteOrigin()`, which is read at build time so pages stay static. On preview deployments the Publish panel explains that its URLs point at production. The `GITVIS_*` test overrides (fake upstream URLs, short windows) are ignored when `VERCEL_ENV=production`.

## Third-party code

No code is copied from other projects. GitHub Readme Stats (MIT) and similar projects informed general ideas such as SVG endpoints and cache headers only. The GitHub mark in the site header is from Octicons (MIT). If code is ever reused, check its license and record attribution in `NOTICE`.
