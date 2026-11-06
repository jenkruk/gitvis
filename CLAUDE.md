# GitVis

Customizable contribution visualizations that combine GitHub + GitLab activity for README embeds. Read `docs/` before structural changes: PRODUCT, ARCHITECTURE, ROADMAP, DESIGN_SYSTEM.

@AGENTS.md

## Commands

- `npm run dev` — dev server
- `npm run check` — lint + typecheck + tests (run before declaring work done)
- `npm run typecheck` — `next typegen` (route types like `LayoutProps`) + `tsc --noEmit`
- `npm test` / `npm run test:watch` — Vitest
- `npm run format` — Prettier (`format:check` to verify only)
- `npm run build` — production build

## Architecture rules

- Imports point inward only: `app → components → renderers → config/theme → metrics → domain`. A module never imports from a layer to its left.
- `adapters` (pure response normalization + username validation) import only `domain`. `server` (network fetchers, caching, tokens) imports `adapters` + `domain`, starts with `import "server-only"`, and is used only by route handlers / server code.
- `domain`, `metrics`, `config`, `theme`, `adapters`, `renderers` are pure (no fetch, no browser APIs, no React hooks in renderers).
- Renderers emit self-contained SVG: inline attributes only, system font stack, no CSS classes, no `<style>`/`<script>`. They must work via `renderToStaticMarkup` for embeds.
- Dates are `ISODate` (`YYYY-MM-DD`) strings. Never `new Date("YYYY-MM-DD")` or local-time getters; use helpers in `src/domain/dates.ts`.
- Feature flags come from the registry in `src/config/features.ts`; layouts declare supported features. Don't hardcode feature lists in components.
- Layout, palette, mode, and features are independent; switching one never resets another.

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
