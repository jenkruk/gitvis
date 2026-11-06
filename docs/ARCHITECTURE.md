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
                                     ├─ cachedGitHub(user)  "use cache: remote"  ─▶ api.github.com/graphql
                                     └─ cachedGitLab(user)  "use cache: remote"  ─▶ gitlab.com/users/:u/calendar.json
                                                                  │ PlatformContributions | AdapterError per platform
                                                                  ▼
                                   combineSources(successes, range, "live")  →  { dataset | null, results[] }
```

- **Partial success:** each platform resolves independently. The dataset is built from whichever succeeded, and `results[]` carries a status per requested platform.
- **Caching:** see "Publish › Caching". The studio and embeds share the same per-username cache entries.
- **Fetches** have an 8s timeout (`AbortSignal.timeout`) and a `User-Agent: GitVis`. GitLab is fetched with `redirect: "manual"` so its 302-to-sign-in is detected as "not found or private".
- **Range:** a 365-day window ending on today (UTC). If a platform reports activity dated tomorrow-in-UTC (users east of UTC), the window extends by that one day so nothing is silently dropped. GitHub is queried for the trailing year as of fetch time (inside the cached function), so cache keys don't roll over daily.
- **URL state:** the client mirrors usernames into `?github=&gitlab=` (`history.replaceState`) so a reload or shared link reconnects. Phase 3 adds the visualization config to the same URL.
- **Abuse:** the endpoint is public and spends the server's GitHub quota. Caching is the first defense; edge rate limiting is planned (ROADMAP Phase 5).

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

- **URL codes are a frozen public contract** (`src/publish/card-params.ts`), mapped explicitly to internal ids, so renaming code never breaks old URLs. Golden-URL tests pin this down.
- **Explicit enabled-list semantics:** a feature added later is _off_ for existing URLs, so old embeds never change appearance. Encoders always write every param, so changing defaults never alters published images.
- **Evolution:** unknown params are ignored, so new optional params (such as future custom colors, reserved as `colors`) can be added within v1. A breaking change bumps `v`, and the decoder keeps a branch for each published version.
- **Validation:** the card endpoint is strict and renders an explanatory error card for an unsupported `v`, invalid usernames, unknown codes, or a query over 512 characters. The studio is lenient: an Edit link with a bad value falls back to defaults rather than failing.
- The studio uses the **same query string** (`/?v=1&github=…`) as its Edit configuration link and keeps it in sync while you design, so a reload restores everything.

### Rendering

Next.js forbids `react-dom/server` in App Router code (verified: build error "You're importing a component that imports react-dom/server"). Our renderers are pure, hook-free SVG components, so `src/publish/svg-markup.ts` serializes the element tree directly: function components are called, attributes get React's SVG naming and escaping, and there's no dependency. **A parity test asserts byte-identical output to React's `renderToStaticMarkup`** for every layout × palette × mode, so the published image is guaranteed to match the studio preview.

### Caching (target: data about 12 hours fresh)

| Layer                               | Setting                                                                                                                                                             | Why                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Upstream data                       | `"use cache: remote"`, profile `contributions`: revalidate 12h, expire 7d. Keyed by **username only**.                                                              | One upstream fetch per user per 12h, shared by the studio and every embed.          |
| Failed refresh                      | Transient failures **throw** inside the cached function, so they're never cached. Past the revalidate time, the last good data keeps being served while it retries. | Upstream blips don't turn a README into an error card.                              |
| Not found                           | `cacheLife("hours")`                                                                                                                                                | Renamed or new accounts recover within about an hour.                               |
| CDN (`CDN-Cache-Control`)           | `public, s-maxage=3600, stale-while-revalidate=86400`; errors 60s; invalid config 1h                                                                                | Embed traffic is served from the edge.                                              |
| Camo and browsers (`Cache-Control`) | `no-cache` + strong `ETag`                                                                                                                                          | GitHub's documented advice for changing images. Revalidation returns a cheap `304`. |

Worst-case age is about 13h (12h data + 1h edge). If GitHub's camo ever holds an old image, purge it with `curl -X PURGE <camo-url>` (GitHub docs, "About anonymized URLs").

### Abuse protection

- **Input limits:** strict validation, a 512-character query cap, and bounded render cost (the dataset is always ≤ 366 days, and layouts are fixed size).
- **Per-IP rate limits** (in memory, per instance, best effort): `/api/card` 120/min, `/api/contributions` 30/min. Exceeding them returns `429` + `Retry-After`. Most embed traffic never reaches the function because the CDN answers it.
- **Upstream budget:** at most 300 upstream fetches per minute per instance, so a flood of unique usernames can't drain the shared GitHub quota. Requests over budget fail as a transient "busy" error, which isn't cached.
- **Production:** add a Vercel Firewall rate-limit rule on `/api/*` (configuration, not code) for limits shared across instances.

### Error policy

Card errors return **HTTP 200 with a readable error SVG** (plus `X-GitVis-Status: <code>`), because GitHub shows a broken-image icon for non-2xx responses and README owners need to see what's wrong. Messages come only from the fixed, user-safe adapter and validation strings. Unexpected exceptions become a generic "Something went wrong" card; details are logged server-side and never rendered. If **any** requested platform fails, the card shows an error rather than a silently partial (misleadingly low) total.

### Markdown and downloads

- Markdown: `[![alt](cardUrl)](editUrl)`, or an HTML `<picture>` with `prefers-color-scheme` sources for "match the viewer's theme". The alt text names the platforms and usernames. The SVG's own `<title>`/`<desc>` carries the numbers for direct viewing.
- SVG download fetches the published card. PNG rasterizes that same SVG on a `<canvas>` at 2× (no dependency).

## Security

- Tokens exist only in server environment variables. They never appear in client bundles, URLs, or responses. Network code lives in `src/server/*` behind `import "server-only"`. `src/adapters` is pure and shared (normalization, username validation).
- Usernames are validated against each platform's allowed character set before being interpolated into URLs or GraphQL variables (always passed as **variables**, never by string concatenation).
- No private repository content is ever requested. Only daily counts and, for GitHub, an anonymized restricted count.
- Error responses don't reveal upstream tokens or raw upstream bodies.
- Rate limiting and abuse: rely on caching first. Add per-IP limits at the edge if the embed endpoint is abused.

## Third-party code

No code is copied from other projects. GitHub Readme Stats (MIT) and similar projects informed general ideas such as SVG endpoints and cache headers only. If code is ever reused, check its license and record attribution in `NOTICE`.
