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

## Phase 3.1: Publish hardening

- Playwright E2E with `@axe-core/playwright`: connect → customize → publish, a keyboard-only path, and an axe scan of each state (empty, loading, partial error, loaded, published) at mobile and desktop sizes. Runs in CI and fails on serious or critical violations.
- Preview modes: desktop, tablet and mobile widths, plus GitHub light and dark README surfaces (preview container only).
- Verify an embed inside a real GitHub README after the first deployment (requires approval to deploy), including how camo's caching behaves in practice.

## Phase 4: Color studio and design-system depth

**Tasks**

- Advanced overrides (accent, heatmap endpoints, background) with live contrast warnings and an automatic fallback to readable text colors.
- Palette preview thumbnails with real mini-renders.
- Persist the last config in `localStorage` as a convenience (the URL stays the source of truth).
- **Storybook** for production components and the design system: controls, palette and token pages, every layout × palette × mode, and the Connect states. Includes the a11y addon (axe) per story.
- **Accessibility preview modes:** standard, grayscale, and accessible-data views (DESIGN_SYSTEM, "Preview modes").
- **Alternative data views:** a screen-reader-friendly written summary plus monthly and weekly data tables, derived from `ContributionMetrics`.

**Acceptance criteria**

- Every production component has stories that pass the Storybook a11y checks.
- Grayscale mode keeps every layout readable (labels and legends carry the meaning).
- The data tables match the graphic's numbers (shared source, tested).

## Phase 5: Quality and launch

**Tasks**

- **Visual regression:** snapshots of layouts × palettes × light/dark × mobile, tablet, and desktop (Playwright screenshots, or Storybook-based if that proves simpler), with review in CI.
- Manual screen-reader passes (VoiceOver + Safari, NVDA + Firefox) and a WCAG 2.2 AA checklist review.
- Performance budget (studio JS < 150 kB gz), Lighthouse ≥ 95 accessibility.
- Edge rate limiting for the public API routes if usage warrants it.
- Vercel deployment (requires approval), README with an embed example, contribution guide, license.

## Later

GitLab GraphQL calendar (once stable) · Bitbucket adapter · self-hosted GitLab · multi-year view · animated SVG (with reduced-motion fallbacks) · per-repo filters via opt-in OAuth.
