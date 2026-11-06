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

### Preview modes (planned)

| Mode                                | Purpose                                                                                   | Phase |
| ----------------------------------- | ----------------------------------------------------------------------------------------- | ----- |
| Device: desktop / tablet / mobile   | Shows how the README image scales in GitHub's layout at common widths                     | 3     |
| README surface: GitHub light / dark | Previews the graphic against both GitHub themes                                           | 3     |
| Grayscale                           | Checks that meaning survives without hue (CSS `filter: grayscale(1)` on the preview only) | 4     |
| Accessible-data view                | Shows the summary and tables above instead of the graphic                                 | 4     |

Preview modes change only the **preview container**. They are never part of `VisualizationConfig` or the exported graphic.

### Verification

- **Now:** Vitest + Testing Library assertions on roles, names, descriptions, and keyboard paths for every interactive component; contrast tests for every palette.
- **Planned:** Storybook stories for production components with the a11y addon (Phase 4); Playwright end-to-end with `@axe-core/playwright` on every page state (Phase 3); visual regression across themes × palettes × viewports (Phase 5); manual VoiceOver and NVDA passes before launch.

## Original design

GitVis's visuals are original. The heatmap grid follows the common contribution-calendar convention (weeks × weekdays) because users recognize it, but the styling, layouts, and palettes are our own.
