# GitVis — Roadmap

Phases are ordered by dependency. Each phase ends in a working, tested app.

## Phase 1: Foundation and first vertical slice ✅

**Tasks**

- [x] Planning docs, `CLAUDE.md`
- [x] Next.js 16 + TS strict + Tailwind v4 + Vitest/RTL scaffold
- [x] Domain: `ISODate` utilities, normalized types, `combineSources`
- [x] Metrics: totals, active days, streaks, best day, platform totals, weekly and monthly series
- [x] Config: feature registry, layout definitions, `VisualizationConfig` reducer, feature visibility
- [x] Theme: nine palettes × light/dark, generated heatmap ramps, WCAG contrast utilities and tests
- [x] Renderers: heatmap plus Minimal, Dashboard, and Data-rich layouts as pure SVG
- [x] Deterministic, clearly labeled sample dataset
- [x] Studio UI: layout switcher, feature toggles, palette and mode pickers, live preview
- [x] Adapter normalization functions for GitHub and GitLab response shapes (pure, tested)

**Acceptance criteria**

- `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` pass.
- Switching layouts keeps feature, palette, and mode selections.
- The preview always shows a "Sample data" badge.
- All palettes pass the contrast tests.

## Phase 2: Connect (live data) ✅

_Depends on:_ Phase 1 domain and adapters.

**Tasks**

- [x] Server fetchers in `src/server` (`server-only`): GitHub GraphQL with a server token, and GitLab `calendar.json`, each with a timeout and mapped error kinds.
- [x] Caching with `"use cache: remote"`: `cacheLife("hours")` for successes and not-found results, a short lifetime for transient failures so retries can recover.
- [x] `GET /api/contributions?github=&gitlab=` returns a `live` `ContributionDataset` built from the successful platforms, plus a per-platform status (`ok` | `not_found` | `invalid_username` | `rate_limited` | `not_configured` | `upstream`).
- [x] Username validation shared by client and server.
- [x] Connect UI: two independent optional fields; per-platform loading, success, and error states; retry for transient errors; partial success; an empty state for zero contributions; the URL keeps the usernames for reload and sharing.
- [x] Explain the platform differences in the UI (contributions ≠ commits; no deduplication; private counts are shown only when the user opted in).
- [x] Accessibility: label, hint, and error wiring, focus management on errors, a polite live region, `aria-busy` on the preview, reduced motion (see DESIGN_SYSTEM).

**Acceptance criteria**

- ✅ `jenkruk` (GitHub) and `contactkruk` (GitLab) load individually and combined. Verified 2026-11-06: every one of the 365 days matches the anonymous public calendars on both platforms (GitHub 629, GitLab 175, combined 804).
- Nonexistent and private profiles show accurate messages. GitLab returns the same redirect for both, so it shows one combined "doesn't exist or is private" message. One failing platform doesn't block the other.
- Without `GITHUB_TOKEN`, GitHub reports "not configured" and GitLab still works.
- The flow is completable with keyboard only and announced correctly by a screen reader. No horizontal scroll at 320px.
- No token appears in client bundles (grep the `.next/static` output).

**Deferred from Phase 2:** GitLab GraphQL `contributionCalendar`. `calendar.json` already provides the same daily counts without a token. Adopt the GraphQL field when it leaves Experiment status or when we need its timezone metadata, and verify the minimum token scope at that time.

## Phase 3: Publish ✅

_Depends on:_ Phase 2.

**Tasks**

- [x] Docs: URL contract, caching layers, abuse protection, error policy.
- [x] Versioned config ⇄ URL encoding (`src/publish/card-params.ts`): frozen v1 codes, strict and lenient decoding, golden-URL compatibility tests.
- [x] Per-username, date-independent upstream cache with a 12h revalidate. Failed refreshes keep serving the last good data.
- [x] Dependency-free SVG serializer with a byte-parity test against `renderToStaticMarkup`.
- [x] `GET /api/card`: validated params, error cards, ETag/304, `Cache-Control: no-cache` for camo, `CDN-Cache-Control` for the edge, rate limits, and an upstream budget.
- [x] Studio: decode the full config from the URL (Edit link), keep the URL in sync, keep settings across reconnects.
- [x] Publish panel: live published-image preview, Copy Markdown (single image or theme-matching `<picture>`), copy image and edit URLs, SVG and PNG downloads, accessible status messages.
- [x] Verify real `jenkruk` / `contactkruk` embeds.

**Acceptance criteria**

- One Markdown snippet in a README renders current data and refreshes about every 12 hours with no user action. Verified locally against live data. Verifying inside a real GitHub README needs a deployment (Phase 3.1).
- GitHub-only, GitLab-only and combined URLs render. Invalid or partial-failure URLs render explanatory error cards, never misleading partial totals.
- Golden URLs from v1 keep decoding to the same design.
- SVG and PNG downloads match the published image.
- No credentials or internal errors appear in SVGs, responses or bundles.

## Phase 3.1: Reliability, accessibility, responsiveness ✅ (deployment verification pending)

**Tasks**

- [x] Freshness policy: 12h window snapshots with a blocking refresh after idle periods, last-known-good up to 7 days (badged "Data from …"), honest errors beyond that, and outcomes returned rather than thrown (production redacts thrown messages).
- [x] Cache layers bounded for low traffic: edge SWR cut from 24h to 10 min; stale cards cached 60s at the edge; the studio API doesn't cache stale results.
- [x] E2E cache suite against a real production server and a fake upstream (shortened windows): hit, idle refresh, last-known-good, expiry, recovery, combined partial outage, not-found, ETag/304, and a shared snapshot.
- [x] Playwright + `@axe-core/playwright` (WCAG 2.2 AA tags; any violation fails): sample, connected, validation-error and partial-failure states at 320/375/768/1280.
- [x] Keyboard-only Connect → Customize → Publish test (skip link, arrow keys, Space, Enter, visible focus, clipboard contents).
- [x] Responsive: no horizontal scroll at 320/375/768/1280; 24px targets; ≥ 11px UI text; mobile editing.
- [x] Studio preview modes: desktop, tablet and mobile README widths (removed Nov 2026: README cards are always the full image).
- [x] Mobile-optimized compact image (`size=compact`, 400px reflow). No longer offered in snippets (GitHub's `<themed-picture>` broke width media for signed-in readers); `size=compact` URLs still render.
- [x] Alternative data view: written summary, key stats, and an accessible monthly table (pulled forward from Phase 4).
- [x] Error cards wrap text; usernames are truncated in messages (GitLab allows 255 characters).
- [x] Fixed: step-number contrast, a nested-interactive SVG preview, and a 20px disclosure target (all found by axe or the E2E checks).
- [x] Rate-limit review and production requirements documented (ARCHITECTURE "Abuse protection", "Production requirements").

Deployment verification moved to Phase 3.2.

## Phase 3.2: Deployment readiness 🚧 (code ready; deployment awaiting approval)

**Audit fixes (done locally)**

- [x] Snapshots moved from `"use cache: remote"` to the Vercel Runtime Cache via `getCache` with versioned keys we control. Next 16 keys `use cache: remote` entries by build ID, so every deploy would have wiped the snapshots and the 7-day last-known-good fallback. Unit tests cover deploy survival, read-only past windows, no writes on failure, 1h not-found re-checks, store outages, malformed entries, and in-flight de-duplication.
- [x] The edge header is now `Vercel-CDN-Cache-Control`, which is stripped before camo or other downstream caches; `CDN-Cache-Control` would have been forwarded to them.
- [x] Preview deployments always publish production URLs: `SITE_URL` → `VERCEL_PROJECT_PRODUCTION_URL` → request host (local only). A preview's own hostname is rejected, and the Publish panel shows a preview notice.
- [x] Test-only `GITVIS_*` overrides are ignored when `VERCEL_ENV=production`.
- [x] In-app limiter keyed on `x-real-ip`; card limit raised to 600/min/IP (camo shares IPs).
- [x] An `X-GitVis-Data-As-Of` header for verifying freshness from outside.
- [x] `<picture>` markup audit test: content model, attributes GitHub's sanitizer keeps, absolute production URLs, the compact source wins on narrow screens, and the alt text.
- [x] `docs/DEPLOYMENT.md`: environment variables, Vercel settings, WAF rules that don't block camo, cost model, deploy, verify and rollback.

**Deployment verification (requires approval; see DEPLOYMENT.md §6–7)**

- [ ] Headers in production: `vercel-cdn-cache-control` stripped, `no-cache` + ETag, `x-vercel-cache` HIT, 304 on a HIT.
- [ ] Snapshots survive a redeploy (`x-gitvis-data-as-of` unchanged; Runtime Cache reads without writes).
- [ ] Preview publishes production URLs; preview `/api/card` returns 401.
- [ ] A real README embed through camo: light, dark, mobile compact; the links under the image work.
- [ ] After more than 13h with no traffic, the first view has fresh data.
- [ ] WAF rule 1 logging, then enforcing; `/api/card` never challenged.

## Phase 4: Personalization and visual design ✅

- [x] Optional profile identity: header presets (None, Compact identity, Full profile), independent handles, avatars, display name and title
- [x] Avatars fetched server-side and embedded as `data:` URIs (allowlist, size/type limits, 24h cache, monogram fallback); card CSP `img-src data:`
- [x] Profile links under the image in the README snippet
- [x] Six new palettes (15 total), Solid/Gradient/Transparent backgrounds, custom platform colors with automatic contrast correction
- [x] Transparent contrast verified against GitHub light and dark page colors; transparent forces theme matching
- [x] Current-streak metric, metric visibility and keyboard-accessible ordering, 30/90/365-day ranges (replaced in the studio by 1–3 years in 4.2; URLs still honored), Compact/Spacious density
- [x] URL contract extended within v1 (optional params written only when non-default); legacy byte-identical SVG snapshots; golden URLs; 2,048-character cap; text sanitizing
- [x] Storybook (production components, a11y addon, viewports) plus a Vitest smoke test over stories
- [x] Unit, component and Playwright + axe coverage for the new controls, serialization and SVG output

## Phase 4.1: Guided user experience ✅

- [x] Three-step studio (Connect → Design → Publish) with a step indicator, revisitable completed steps and locked future steps
- [x] Connect: one primary action, auto-advance on success, partial-failure retry or continue, sample-data exploration
- [x] Design: Contribution graphic / Developer profile card presets (config presets over `identity.style`), layouts, six curated palettes + View all, four collapsed sections, sticky desktop preview, expandable phone preview
- [x] Publish: published image, Copy README Markdown as primary, downloads, image URL, Edit design, one-line refresh note; Markdown options collapsed
- [x] Step in the URL hash (reload, Back/Forward); focus moves to each step's heading; reduced motion respected
- [x] v1 URLs and rendering unchanged (legacy snapshots, golden URLs)
- [x] Storybook: guided studio steps, design controls, step navigation; unit and Playwright coverage for navigation, focus, preservation and the publishing flow

## Phase 4.2: Visual refinement ✅

- [x] Panel styles (Filled, Outlined, Borderless) for stat cards, heatmap, breakdown and charts; `pnl` URL param; contrast re-checked against the real backdrop; legacy output unchanged
- [x] Presets restore the user's last profile header and avatars; name, title and handles are never discarded
- [x] Storybook Publish stories render the real published URL offline (no unavailable API)
- [x] Studio copy trimmed (redundant group descriptions removed, shorter layout and header descriptions)
- [x] Historical ranges: 1/2/3 years (`yrs`), one calendar per 12-month period with yearly summaries; GitHub history via per-year cached GraphQL, GitLab's public 12 months only; coverage-aware metrics, descriptions and data table; phone summaries; GitLab-only accounts limited to 1 year with an explanation; 30/90/365-day URLs preserved

## Visual refinement milestone ✅

- [x] Multi-year year cards: each 12-month period framed per panel style (Borderless: invisible frame, same padding), header pairs dates with that year's total, coverage labels
- [x] Nine new palettes (24 total; six featured, "View all 24"), all contrast-tested across modes, backgrounds and panel styles
- [x] Reporting-period labels for summary statistics ("Last 12 months · GitHub + GitLab"), in the graphic, `<desc>` and data table
- [x] Mandatory source attribution in the v1 contract (decided pre-launch; no v2); long usernames wrap/shorten so attribution always fits
- [x] Multi-year summary stats live inside the newest year's card, so they visibly belong to that year
- [x] Totals match each profile: the newest period is each platform's own published year (GitHub from the Sunday a year back, GitLab from the same date), so the combined total equals the two profile totals; verified live (GitHub 650 + GitLab 177 = 827)
- [x] Centered profile header (`hdr=centered`): name and dates centered, GitHub on the left, GitLab on the right

## Phase 4.3: Design-system depth

**Tasks**

- Advanced overrides (accent, heatmap endpoints, background) with live contrast warnings and an automatic fallback to readable text colors.
- Palette preview thumbnails with real mini-renders.
- Persist the last config in `localStorage` as a convenience (the URL stays the source of truth).
- Storybook: token pages, Connect states, and running the a11y addon in CI (`@storybook/addon-vitest`).
- Verify avatars against real GitHub/GitLab/Gravatar URLs on a deployment.
- **Accessibility preview modes:** grayscale, and an accessible-data view that swaps the graphic for the data view (device widths shipped in 3.1).
- **Alternative data views:** monthly table and summary shipped in 3.1; add a weekly table and sortable columns.

**Acceptance criteria**

- Every production component has stories that pass the Storybook a11y checks in CI.
- Grayscale mode keeps every layout readable (labels and legends carry the meaning).
- The data tables match the graphic's numbers (shared source, tested).

## Phase 5: Quality and launch

**Tasks**

- **Visual regression:** snapshots of layouts × palettes × light/dark × mobile, tablet, and desktop (Playwright screenshots, or Storybook-based if that proves simpler), with review in CI.
- Manual screen-reader passes (VoiceOver + Safari, NVDA + Firefox) and a WCAG 2.2 AA checklist review.
- Performance budget (studio JS < 150 kB gz), Lighthouse ≥ 95 accessibility.
- Vercel Firewall rules (required before launch; see ARCHITECTURE "Production requirements").
- Vercel deployment (requires approval), README with an embed example, contribution guide, license.

## Later

GitLab GraphQL calendar (once stable) · Bitbucket adapter · self-hosted GitLab · multi-year view · animated SVG (with reduced-motion fallbacks) · per-repo filters via opt-in OAuth.
