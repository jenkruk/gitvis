# GitVis

Customizable contribution visualizations that combine GitHub + GitLab activity for README embeds. Read `docs/` before structural changes: PRODUCT, ARCHITECTURE, ROADMAP, DESIGN_SYSTEM, DEPLOYMENT.

@AGENTS.md

## Commands

- `npm run dev` — dev server
- `npm run check` — lint + typecheck + tests (run before declaring work done)
- `npm run typecheck` — `next typegen` (route types like `LayoutProps`) + `tsc --noEmit`
- `npm test` / `npm run test:watch` — Vitest
- `npm run test:e2e` — Playwright + axe against a production build and a fake upstream (`e2e/`); never hits real GitHub/GitLab
- `npm run format` — Prettier (`format:check` to verify only)
- `npm run build` — production build
- Live GitHub API check (opt-in, never in CI): `GITVIS_LIVE_GITHUB=<login> node --env-file=.env.local node_modules/vitest/vitest.mjs run src/server/github.live.test.ts`
- `npm run storybook` / `npm run build-storybook` — Storybook (production components only; stories next to source as `*.stories.tsx`)

## Architecture rules

- Imports point inward only: `app → components → renderers → config/theme → metrics → domain`. A module never imports from a layer to its left.
- `adapters` (pure response normalization + username validation) import only `domain`. `server` (network fetchers, caching, tokens) imports `adapters` + `domain`, starts with `import "server-only"`, and is used only by route handlers / server code.
- `domain`, `metrics`, `config`, `theme`, `adapters`, `renderers` are pure (no fetch, no browser APIs, no React hooks in renderers).
- Renderers emit self-contained SVG: inline attributes only, system font stack, no CSS classes, no `<style>`/`<script>`. They must work via `renderToStaticMarkup` for embeds.
- Dates are `ISODate` (`YYYY-MM-DD`) strings. Never `new Date("YYYY-MM-DD")` or local-time getters; use helpers in `src/domain/dates.ts`.
- Feature flags come from the registry in `src/config/features.ts`; layouts declare supported features. Don't hardcode feature lists in components.
- Layout, palette, mode, and features are independent; switching one never resets another. One deliberate coupling (`withFeature` in `src/config/config.ts`): a feature switch reads as off when the layout can't show it; turning it on moves to the smallest layout that shows it, and turning off the last one Minimal lacks moves to Minimal. Feature flags themselves are never discarded.
- Published image URLs are a public contract (`src/publish/card-params.ts`): never change or remove an existing URL code, never derive v1 defaults from current defaults, and add a golden-URL test for anything new. Breaking changes need a new `v` — once deployed. The contract (and the legacy snapshots) freeze at the first production deployment; until then, deliberate pre-launch changes are allowed and must be recorded in the snapshot test's header.
- Source attribution is mandatory (`withAttribution` in the decoder and studio): never add a way to hide account labels/usernames when that account's data is shown.
- The combined total is mandatory too (`alwaysOn` in `src/config/features.ts`, enforced by `withAttribution`): it can be reordered, never hidden.
- Route handlers can't import `react-dom/server`; serialize SVG with `src/publish/svg-markup.ts` and keep its React-parity test passing. Renderers must stay hook-free with inline attributes.
- `src/publish/__snapshots__/legacy/*.svg` are byte-identical renders of pre-Phase-4 URLs. Never update them; a failure means an old embed changed. New URL params must be optional and written only when they differ from the frozen legacy defaults.
- Avatars are fetched only in `src/server/avatars.ts` (host allowlist, size/type limits) and embedded as `data:` URIs. Never put an external URL in a rendered SVG `<image>`.
- Days outside a source's `coverage` are UNKNOWN, never zero: don't zero-fill, don't sum them into combined totals. Never present partial data as a complete cross-platform total.
- The newest period is each platform's own published year (`platformYear` in `src/domain/history.ts`): GitHub's "last year" starts on the Sunday of the week one year back, GitLab's "last 12 months" on the same date one year back. Each platform's numbers there match its profile, and the combined total is the sum of those two profile totals (decided Nov 2026 so users can verify our numbers). Metrics use `prepareView(...).metricsView` (the newest period); `<desc>` states each platform's start date when they differ.
- GitLab history = its public 12-month calendar only (no Events API, no GitLab auth). GitHub history = complete calendar years cached per year in `src/server/history.ts`.
- Contribution snapshots live in the Vercel Runtime Cache via `getCache` (`src/server/cached.ts`), not `"use cache: remote"` (its keys change every deploy). Bump `SNAPSHOT_SCHEMA` when the stored shape changes. Never write failures to the cache.
- Published URLs must use the production origin from `src/server/origin.ts`; never build them from the request host.

## Data honesty

- Say "contributions", never "commits". GitHub and GitLab count different events (see ARCHITECTURE "Platform semantics").
- Never fabricate data in production views. Fixtures must have `provenance: "sample"`; renderers show a non-removable "Sample data" badge.
- Tokens are server-only env vars (`GITHUB_TOKEN`, optional `GITLAB_TOKEN`). Never in client code, URLs, or responses.
- GitLab GraphQL `contributionCalendar` is experimental and needs auth on GitLab.com; `calendar.json` is the required fallback.

## Conventions

- TypeScript strict; no `any`. Prefer `as const` registries + derived union types.
- Accessibility (WCAG 2.2 AA) and mobile-first responsiveness are requirements for every component, not polish — see DESIGN_SYSTEM "Accessibility". Include keyboard + screen-reader assertions in component tests.
- Native accessible controls (fieldset/legend, radio, checkbox role=switch) over custom widgets. Animations behind `motion-safe:`.
- New palettes must pass `src/theme/palettes.test.ts` contrast checks.
- Add dependencies only with a clear purpose; note why in the PR/commit.
- Tests live next to source as `*.test.ts(x)`.
