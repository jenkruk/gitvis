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

Contrast thresholds are **enforced by unit tests** (`src/theme/palettes.test.ts`) for every palette × mode. Any new palette must pass them.

Palette, layout, and mode are independent axes of `VisualizationConfig`, and changing one never resets the others.

## Accessibility and responsiveness

**Target: WCAG 2.2 AA.** Accessibility and responsiveness are architectural requirements: every new component ships mobile-first, keyboard-operable, screen-reader-friendly, and with tests that assert those properties.

### Studio app

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
- Mobile-first: one column under `lg`. The DOM order is Connect, then preview, then controls, so small screens see feedback above the controls. At `lg` the grid places the controls left and the preview right.
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

- **Now:** Vitest + Testing Library assertions on roles, names, descriptions, and keyboard paths for every interactive component; contrast tests for every palette. **Playwright + axe-core** (`npm run test:e2e`): WCAG 2.2 AA scans of every major state at 320/375/768/1280 (any violation fails), a keyboard-only Connect → Customize → Publish run, 24px target sizes, ≥ 11px UI text, no horizontal scroll, and reduced motion.
- **Planned:** Storybook stories with the a11y addon (Phase 4); visual regression across themes × palettes × viewports (Phase 5); manual VoiceOver and NVDA passes before launch.

## Original design

GitVis's visuals are original. The heatmap grid follows the common contribution-calendar convention (weeks × weekdays) because users recognize it, but the styling, layouts, and palettes are our own.
