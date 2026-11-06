# GitVis — Design System

There are two surfaces with different rules:

1. **The graphic.** A standalone SVG that is themed by the selected palette. It must look right inside GitHub READMEs (light and dark), as a download, and inline in the studio.
2. **The studio app.** A neutral (zinc) interface that stays out of the way so the palettes stand out.

## Layout families

Width is fixed at 840px, with 24px outer padding and 16px section gaps. Height comes from the enabled sections.

| Layout        | Sections (in order)                                                                                          | Supported features                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| **Minimal**   | Header (title, platform labels, range) · inline stats line · heatmap                                         | heatmap, total, active days, longest streak, best day, platform labels |
| **Dashboard** | Header · stat cards row · heatmap panel · platform breakdown bar                                             | all except activity trends                                             |
| **Data-rich** | Header · detailed stat cards (with sub-metrics) · heatmap panel · weekly trend + monthly platform comparison | all                                                                    |

When a feature is enabled but the current layout doesn't support it, the setting is **kept**, and the toggle shows "Not shown in _Layout_".

## Visual components (`src/renderers`)

- **Heatmap:** weeks as columns, Sunday-first rows. Cells are 11px with a 3px gap and 2px radius. It has month labels, Mon/Wed/Fri labels, and a Less→More legend. Every cell has a `<title>` tooltip ("5 contributions on Tue, Mar 3, 2026").
- **Stat card:** a large value in the `text` color, a label in `textMuted`, and an optional sub-line (Data-rich only).
- **Inline stats** (Minimal): `1,234 contributions · 210 active days · 14-day longest streak`.
- **Platform breakdown:** one stacked horizontal bar. Each segment is labelled with the platform name, count, and percentage, so meaning never depends on color alone.
- **Weekly trend:** an area plus line chart of weekly totals, with a baseline and min/max labels.
- **Monthly comparison:** stacked bars per month, one segment per platform, with a legend.
- **Sample badge:** a pill in the header reading "Sample data". It is always shown when `provenance === "sample"`.
- **Error card** (published images only): same frame and palette as the graphic, with a title, a one-line user-safe message, and a hint on how to fix it. It has its own `<title>`/`<desc>`, so a broken README embed still explains itself.

## Typography

SVG text uses a system stack, `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`. Web fonts don't load inside `<img>` embeds. Sizes: title 16/600, stat value 22/700, label 11/500, axis 10/400. Numbers use `en-US` grouping for deterministic output.

## Palettes (`src/theme/palettes.ts`)

Each palette defines **light and dark** variants with these tokens:

| Token                    | Use                                                         |
| ------------------------ | ----------------------------------------------------------- |
| `background`             | Canvas behind everything                                    |
| `surface`                | Panels and cards                                            |
| `border`                 | Panel borders, chart baselines                              |
| `text`                   | Titles and values (≥ 4.5:1 on background and surface)       |
| `textMuted`              | Labels and captions (≥ 4.5:1 on surface)                    |
| `accent`                 | Highlights and the trend line (≥ 3:1 on surface)            |
| `heatmapEmpty`           | Zero-activity cells                                         |
| `rampFrom` → `rampTo`    | Heatmap levels 1–4, interpolated (level 4 ≥ 3:1 on surface) |
| `series[0]`, `series[1]` | GitHub and GitLab series colors (each ≥ 3:1 on surface)     |

| Palette         | Character              |
| --------------- | ---------------------- |
| Aurora          | Mint → blue            |
| Amethyst        | Violet → pink          |
| Desert Sunset   | Orange → rose          |
| Ocean Depths    | Deep blue → cyan       |
| Forest & Gold   | Forest green with gold |
| Rose Quartz     | Pink → lavender        |
| Electric Cobalt | Cobalt → mint          |
| Ember           | Coral → amber          |
| Monochrome      | Neutral grays          |
| GitHub Classic  | Familiar greens        |
| GitLab Inspired | Orange → purple        |
| Nordic Frost    | Frost blue → teal      |
| Solarized       | Solarized-style tones  |
| Midnight Neon   | Magenta → cyan glow    |
| Paper & Ink     | Ink on warm paper      |

Contrast thresholds are **enforced by unit tests** (`src/theme/palettes.test.ts`) for every palette × mode. Any new palette must pass them.

Palette, layout, and mode are independent axes of `VisualizationConfig`, and changing one never resets the others. So are background, identity, platform colors, range, density and metric order.

### Panel styles

| Style      | Panels (stat cards, heatmap, breakdown, charts) | Content colors                          |
| ---------- | ----------------------------------------------- | --------------------------------------- |
| Filled     | `surface` fill + `border` stroke (default)      | Palette tokens as designed              |
| Outlined   | `border` stroke, no fill                        | Re-checked against the real backdrop(s) |
| Borderless | Not drawn; section gaps carry the hierarchy     | Re-checked against the real backdrop(s) |

Independent of the background: any panel style works with Solid, Gradient or Transparent. Geometry and spacing are identical across styles, so switching never reflows the graphic. The Sample badge always keeps its filled pill.

### Backgrounds

- **Solid:** the palette `background`.
- **Gradient:** `background` → `gradientEnd(theme)` (background mixed 10% toward the accent). Tests check `text`/`textMuted` ≥ 4.5:1 on the gradient end.
- **Transparent:** no canvas rect. Panels keep their `surface` fill. Tests check text, muted text (≥ 4.5:1) and heatmap level 4 (≥ 3:1) directly on GitHub's page colors (`GITHUB_SURFACES`: light `#ffffff`; dark `#0d1117` and `#212830`). The README snippet forces theme matching so the light variant never sits on a dark page.

### Custom platform colors

`resolveTheme(palette, mode, { series })` runs each custom color through `ensureContrast(color, surface, 3)`, mixing it toward black or white in 5% steps until it reaches 3:1. The studio shows "Adjusted to … for contrast." when that happens.

## Profile headers (`src/renderers/IdentityHeader.tsx`)

| Preset           | Avatar                  | Content                                    | Height |
| ---------------- | ----------------------- | ------------------------------------------ | ------ |
| None             | —                       | Original title row, date range, handles    | —      |
| Compact identity | 36px                    | Name (or "Contribution activity"), handles | 40–58  |
| Full profile     | 64px (48 compact image) | Name 20px (17), title, date range, handles | ~88    |

- Avatars are circles clipped with a per-graphic `clipPath` id (`{idPrefix}-avatar-{platform}`) and ringed in the platform color. `<image href>` is always a `data:` URI.
- **Monogram fallback:** a circle in the series color with the initial in `bestTextOn(color)`.
- Name and title are single lines with an ellipsis, and leave room for the Sample badge. They are also in `<title>`/`<desc>`.

## History calendars (`src/renderers/HistoryCalendars.tsx`)

- **Full image:** one calendar per 12-month period, newest first, in one panel. Each period has a title row — dates (12px semibold, `text`) on the left and a summary on the right ("1,234 contributions", or "612 contributions · GitHub only") in `textMuted`. Missing platform history is explained once, in the scope note under the stats, not under each calendar. One legend under the last calendar; one colour scale (quartiles over all shown days) across every year.
- **No hatching.** Missing coverage is explained in words (titles, notes, tooltips, description, data table), never by patterns.
- **Phones (`size=compact`):** a "yearly summary" list (dates, total, coverage note) above the usual last-20-weeks heatmap.
- **Scope note** under the stats whenever they cover less than the calendars.

## Density

`SPACING` in `src/renderers/layouts.tsx`: Spacious (section gap 16, panel padding 16, stat card 70/84, breakdown 74, trends 170) and Compact (10, 10, 58/70, 60, 140). Font sizes don't change with density; only whitespace does.

## Storybook

`npm run storybook` (dev, port 6006) and `npm run build-storybook`. Stories import production components only (`src/**/*.stories.tsx`, shared data in `src/stories/fixtures.ts`):

- **Graphic/Visualization:** every layout, the 15 × 2 palette gallery, backgrounds over GitHub light/dark, ranges, densities, profile headers (avatar and monogram), custom colors, the compact phone image.
- **Graphic/Heatmap** and **Graphic/Metric cards:** the section components with palette, mode, width, density and count controls.
- **Studio/Guided studio:** each step (Connect, Design with data or sample data, Publish) at desktop and phone viewports. Publish stories render the real published URL offline via `renderSampleCard` (production decoder + renderer), so they show a meaningful image instead of a failed request.
- **Studio/Design controls** (the Design column on the real reducer, including the profile-card preset and a non-curated palette), **Studio/Step navigation** and **Studio/Preview modes**.

The a11y addon runs axe with the WCAG 2.2 AA tags and `test: "error"`. `src/stories/stories.test.tsx` renders every story in Vitest, so a broken story fails `npm test`.

## Accessibility and responsiveness

**Target: WCAG 2.2 AA.** Accessibility and responsiveness are architectural requirements: every new component ships mobile-first, keyboard-operable, screen-reader-friendly, and with tests that assert those properties.

### Studio app

**Guided steps (Phase 4.1)**

- `StepNav` (`src/components/shell/StepNav.tsx`): an ordered list of real buttons inside `<nav aria-label="Progress">`. The current step has `aria-current="step"`; completed steps show a check and "(completed)" for screen readers; unreachable steps are `disabled` (Design until data or sample mode, Publish until live data).
- One step panel is visible at a time (`hidden` on the others). Connect and Design stay mounted so typed values and open sections survive; Publish mounts on demand.
- Step changes move focus to the new step's `<h2 tabIndex={-1}>`, whose accessible name includes "Step N of 3". The Design heading is described by the data-source line ("Showing contributions for …"), so arriving there announces what loaded.
- The step lives in the URL hash (`#connect`, `#design`, `#publish`): reloads keep it, browser Back/Forward move between steps, and a hash for an unreachable step is ignored.
- One primary action per step: _See my contributions_, _Continue to publish_, _Copy README Markdown_. Everything else is secondary or collapsed.
- Collapsed sections use `Disclosure` (native `<details>`/`<summary>`, uncontrolled), with a one-line summary of the current state ("Dark · Gradient", "6 of 9 shown").
- Step panels fade in over 200ms under `motion-safe:` only.

**Controls**

- Use native controls: radio groups for layout, palette, and mode; `input[type=checkbox][role=switch]` for features; `<form>` and `<input>` for Connect. You get keyboard support (Tab, arrow keys, Space, Enter) and screen-reader semantics without custom widgets.
- Every group has a `<fieldset>`/`<legend>`. Descriptions and hints are linked with `aria-describedby`. A control's accessible name is its label only, never its description.
- Focus is always visible (`focus-visible` outline with ≥ 3:1 contrast). Focused elements are never hidden behind sticky content (2.4.11 Focus Not Obscured), so the sticky preview applies only at `lg` and up, beside the controls.
- Interactive targets are at least 24 × 24 CSS px (2.5.8 Target Size), and 44px on touch-first controls such as primary buttons.

**Forms (Connect)**

- Each field has a visible label and a persistent hint with the expected format. Placeholders are examples only, never labels.
- Validate on submit, not on every keystroke. Invalid fields get `aria-invalid` and an inline error linked via `aria-describedby`, and focus moves to the first invalid field.
- Inputs use `autocomplete="off"`, `autocapitalize="none"`, and `spellcheck={false}` (usernames are not prose). Values entered once are not asked for again (3.3.7 Redundant Entry); the URL keeps them.
- Buttons are never disabled just to block submission. A busy form sets `aria-busy` and ignores duplicate submits instead.

**Loading, empty, and error states**

- One polite `aria-live` status region announces loading, success, and partial results. Errors that need action also appear inline next to their platform, with a Retry button for transient failures.
- While loading, the previous preview stays visible and marked `aria-busy`, so content isn't yanked away. Spinners animate only under `motion-safe:`.
- Empty data (connected but zero contributions) gets an explicit message, never an unexplained blank graphic.
- Status is never conveyed by color alone: icons and text accompany success, warning, and error colors.

**Motion and layout**

- Animation is limited to short color, opacity, and transform transitions under `motion-safe:`. Under `prefers-reduced-motion` nothing moves.
- Mobile-first: one column under `lg`. In Design, the preview comes before the controls in the DOM, so small screens see feedback first; it starts at a capped height (≤ 60vh) with an _Expand preview_ button (`aria-expanded`) and is never sticky on phones. At `lg` the grid places the controls left and the sticky preview right.
- The preview scales to fit (`width: 100%`, preserved aspect ratio) with no horizontal scroll at 320px (1.4.10 Reflow). Text stays usable at 200% zoom.

### Graphic and charts

- `role="img"`, a `<title>` (accessible name), and a data-summarizing `<desc>` (accessible description).
- Never rely on color alone. Platforms are labelled, and the heatmap has a legend and per-cell titles.
- Minimum text size is 10px at 840px width.
- **Planned (Phase 4): alternative data views.** A "View data" disclosure next to the preview with:
  - a written summary (totals, streaks, best and quietest months, platform shares);
  - real `<table>`s for monthly totals by platform and for weekly totals, with `<caption>`, `scope`d headers, and sortable columns operated as native buttons.
  - These come from the same `ContributionMetrics` as the graphic, so they can't drift from it.

### Preview modes

| Mode                                            | Purpose                                                                                                                                                                          | Status                                        |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Device: desktop 830 / tablet 700 / mobile 360px | Shows the image at approximate GitHub README column widths. Mobile shows the compact image when it's enabled. A readout gives the smallest label size and warns below 60% scale. | Shipped (3.1)                                 |
| README surface: GitHub light / dark             | Previews the graphic against both GitHub themes                                                                                                                                  | Planned                                       |
| Grayscale                                       | Checks that meaning survives without hue (CSS `filter: grayscale(1)` on the preview only)                                                                                        | Phase 4                                       |
| Accessible-data view                            | Shows the data view instead of the graphic                                                                                                                                       | Phase 4 (the data view itself shipped in 3.1) |

Preview modes change only the **preview container**. They are never part of `VisualizationConfig` or the exported graphic.

### Responsive graphics

Shrinking the 840px graphic into a ~360px phone column puts labels at about 4px. The **compact image** (400px) reflows instead:

- stat cards in two columns
- the last 20 weeks of heatmap, with cells close to GitHub's 10px on a phone
- trend charts stacked vertically
- wrapped footnote and inline stats
- platform labels on their own line

Published snippets serve it through `<picture>` with `(max-width: 600px)` (on by default). The studio's mobile preview shows exactly that image.

### Alternative data view

"View the data as text and a table" is a native `<details>` element under the preview. It contains:

- the same text summary as the SVG `<desc>`
- key stats in a `<dl>`
- a monthly `<table>` with a `<caption>`, `scope`d headers and row headers

The table scrolls inside its own focusable, labelled region, never the page. All of it comes from the same `ContributionMetrics` as the graphic.

### Verification

- **Now:** Vitest + Testing Library assertions on roles, names, descriptions, and keyboard paths for every interactive component; contrast tests for every palette. **Playwright + axe-core** (`npm run test:e2e`): WCAG 2.2 AA scans of every major state at 320/375/768/1280 (any violation fails), a keyboard-only Connect → Design → Publish run, 24px target sizes, ≥ 11px UI text, no horizontal scroll, and reduced motion.
- **Storybook** with the a11y addon (Phase 4), plus a Vitest smoke test over every story.
- **Planned:** visual regression across themes × palettes × viewports (Phase 5); manual VoiceOver and NVDA passes before launch.

## Original design

GitVis's visuals are original. The heatmap grid follows the common contribution-calendar convention (weeks × weekdays) because users recognize it, but the styling, layouts, and palettes are our own.
