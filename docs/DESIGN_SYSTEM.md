# GitVis — Design System

There are two surfaces with different rules:

1. **The graphic.** A standalone SVG that is themed by the selected palette. It must look right inside GitHub READMEs (light and dark), as a download, and inline in the studio.
2. **The studio app.** Graphite + Mineral Teal: quiet graphite (dark) and cool off-white (light) surfaces with one restrained mineral-teal accent, so the palettes stand out. Its tokens never theme the graphic, and the graphic's palettes never theme the studio (see "Studio foundations").

## Layout families

Width is fixed at 840px, with 24px outer padding and 16px section gaps. Height comes from the enabled sections.

| Layout        | Sections (in order)                                                                                          | Supported features                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| **Minimal**   | Header (title, platform labels, range) · inline stats line · heatmap                                         | heatmap, total, active days, longest streak, best day, platform labels |
| **Dashboard** | Header · stat cards row · heatmap panel · platform breakdown bar                                             | all except activity trends                                             |
| **Data-rich** | Header · detailed stat cards (with sub-metrics) · heatmap panel · weekly trend + monthly platform comparison | all                                                                    |

When the current layout can't show a feature, its switch reads as **off** (the setting itself is kept for other layouts). Turning it on moves to the smallest layout that shows it (Minimal → Dashboard → Data-rich); turning off the last feature Minimal lacks (breakdown, trends) moves to Minimal. Statistics never change the layout. Each automatic switch is announced in a visible status line ("Layout switched to Dashboard to show GitHub / GitLab breakdown.").

## Visual components (`src/renderers`)

- **Heatmap:** weeks as columns, Sunday-first rows. Cells are 11px with a 3px gap and 2px radius. It has month labels, Mon/Wed/Fri labels, and a Less→More legend. Every cell has a `<title>` tooltip ("5 contributions on Tue, Mar 3, 2026").
- **Stat card:** a large value in the `text` color, a label in `textMuted`, and an optional sub-line (Data-rich only).
- **Inline stats** (Minimal): `1,234 contributions · 210 active days · 14-day longest streak`.
- **Platform breakdown:** one stacked horizontal bar. Each segment is labelled with the platform name, count, and percentage, so meaning never depends on color alone.
- **Weekly trend:** an area plus line chart of weekly totals, with a baseline and min/max labels.
- **Monthly comparison:** stacked bars per month, one segment per platform, with a legend.
- **Sample badge:** a pill in the header reading "Sample data". It is always shown when `provenance === "sample"`.
- **Error card** (published images only): same frame and palette as the graphic, with a title, a one-line user-safe message, and a hint on how to fix it. It has its own `<title>`/`<desc>`, so a broken README embed still explains itself.

## Typography (graphic)

SVG text uses a system stack, `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`. Web fonts don't load inside `<img>` embeds. Hierarchy: title 16/600 → stat value 22/700 → panel titles ("Platform breakdown", chart titles) 12/600 in `text` → stat labels 11/500 and date range 11/400 in `textMuted` → axis, legends, footnote 10/400 → the credit ("Made with GitVis · created by Jen Kruk") 10/400 `textMuted`, the quietest line. Text inside a panel is inset by the density's panel padding (16 spacious, 10 compact). Legend keys are SVG shapes (circles in the breakdown, rounded squares in the monthly chart); only the header's inline platform dots stay text glyphs, because they follow text whose width isn't measured. Numbers use `en-US` grouping for deterministic output.

## Studio foundations

The studio UI is built from semantic tokens and a few class recipes. No component uses raw Tailwind palette colors (`zinc-*`, `blue-*` …) or `dark:` pairs: dark mode redefines the tokens once.

- **Tokens:** `src/app/globals.css`. Each raw value (`--gv-*`) is written once as `light-dark(light, dark)`; the OS scheme picks one, and `data-theme="light" | "dark"` on any element forces it for that subtree (Storybook's Theme toolbar). They feed Tailwind utilities through `@theme`. `src/app/tokens.test.ts` checks contrast for every token pair in both schemes.
- **Recipes:** `src/components/ui/recipes.ts`: `button(variant, size)`, `iconButton`, `link`, `linkButton`, `field`, `panel`, `selectableCard(checked, disabled)`, `disclosureSummary`/`disclosureChevron`, `callout(tone)`, `focusRing`/`focusWithin`, `studioGrid` (+ columns), and text helpers (`hint`, `overline`, `mono`). Plain class strings: no component library and no build step.
- **Fonts:** `src/app/fonts.ts` (Geist Sans preloaded, Geist Mono on demand) is used by both the app layout and `.storybook/preview.tsx`, so stories render with the app's fonts.
- **Storybook:** **Studio/Foundations** shows the tokens, type scale, buttons, controls, selection and focus states, the single-open accordion, light and dark side by side, callouts and the app shell.

### Color tokens (Graphite + Mineral Teal)

| Token                                               | Light                             | Dark                              | Use                                                            |
| --------------------------------------------------- | --------------------------------- | --------------------------------- | -------------------------------------------------------------- |
| `canvas`                                            | `#f4f7f8`                         | `#10151b`                         | Page background                                                |
| `surface`                                           | `#ffffff`                         | `#161d24`                         | Controls, cards, closed disclosures                            |
| `surface-raised`                                    | `#ffffff`                         | `#1b232b`                         | Elevated panels, inputs, open disclosures                      |
| `surface-hover`                                     | `#ebf0f2`                         | `#212b34`                         | Hover fill, read-only copy fields                              |
| `selected`                                          | `#eef6f5`                         | `#1c2c30`                         | Selected cards (a whisper of teal)                             |
| `fg` / `fg-muted` / `fg-subtle`                     | `#13202a` / `#45545e` / `#5b6a74` | `#dce6e8` / `#9dabb3` / `#8796a0` | Text; all ≥ 4.5:1 on every surface                             |
| `line` / `line-strong`                              | `#dde4e8` / `#75848f`             | `#26313a` / `#66757f`             | Hairlines (decorative) / control boundaries (≥ 3:1 everywhere) |
| `accent` (+ `accent-fg`)                            | `#0d7470`                         | `#4baeaa`                         | Mineral teal: selection, progress, links (≥ 4.5:1)             |
| `focus`                                             | `#0b4f4c`                         | `#8adbd5`                         | The keyboard focus ring (≥ 3:1 on every surface)               |
| `ink` (+ `ink-hover`, `ink-fg`)                     | `#17242e`                         | `#dce6e8`                         | Primary buttons: neutral, never teal                           |
| `thumb` / `thumb-on`                                | `#ffffff` / `#ffffff`             | `#dce6e8` / `#0c1116`             | Switch thumb on the off (line-strong) and on (accent) track    |
| `success` / `warning` / `danger` (+ `-bg`, `-line`) |                                   |                                   | Status text, callout fill and border                           |

The logo mark (`LOGO_COLOR`, `#4baeaa`) is mineral teal in the header, `icon.svg`, `favicon.ico` and `apple-icon.png`. Teal is for small marks only (selection borders and checks, step progress, links, the switch track), never large fills, and primary actions stay neutral ink, so the studio's color never competes with the palette being chosen.

### Type scale

Geist Sans (preloaded) for the interface; Geist Mono (`preload: false`) only for handles, URLs, hex values and code. Hierarchy comes from size first, then weight. Use `tabular-nums` wherever numbers line up (step numbers, tables, counters).

| Utility         | Size/line height          | Weight     | Use                                                  |
| --------------- | ------------------------- | ---------- | ---------------------------------------------------- |
| `text-title`    | 26/32, −0.022em           | 600        | Page title (one per page)                            |
| `text-heading`  | 20/28, −0.016em           | 600        | Step headings                                        |
| `text-section`  | 15/22                     | 600        | Control-group legends, large button labels           |
| `text-label`    | 14/20                     | 500–600    | Control and field labels, buttons, disclosure titles |
| `text-body`     | 14/22                     | 400        | Running text, messages                               |
| `text-caption`  | 13/18                     | 400        | Hints, descriptions, captions (`hint` recipe)        |
| `text-overline` | 12/16, +0.06em, uppercase | 600        | Group headings such as "More options"                |
| `text-code`     | 13/20                     | Geist Mono | Handles, URLs, Markdown                              |

Nothing in the studio is smaller than 12px, and only the overline and step numbers use 12px. Descriptions are 13px. When copy feels too long, cut it rather than shrinking it.

### Radii, surfaces and states

- **Radii:** `rounded-control` 6px (buttons, inputs), `rounded-card` 10px (cards, disclosures, callouts), `rounded-stage` 14px (preview stage, Connect panel). The card and stage radii match the graphic's panel (10) and canvas (14).
- **Buttons:** `primary` (neutral ink), `secondary` (hairline, raised), `ghost` (text only); sizes `sm` 36px, `md` 44px, `lg` 48px. Each step has one `primary lg` action (_See my contributions_, _Continue to publish_, _Copy README Markdown_).
- **Selectable cards** (`selectableCard`): **default** surface + hairline; **hover** the hover fill; **selected** a 1px teal border on the `selected` tint, plus a small teal check (`SelectionMark`) on cards with a title and a semibold label on segmented options, so selection never rests on color alone; **disabled** dashed border and subtle text.
- **Focus:** one detached 2px `focus` ring, offset 2px, shown only for keyboard focus (`:focus-visible`; `focusWithin` on labels wrapping a hidden input). Selection is drawn inside the control and focus outside it, so **selected + focused** shows both without competing borders. A step heading that receives focus after a pointer click (for screen readers) draws no ring.
- **Non-text contrast:** text inputs, the color input, switch tracks and checkboxes use `line-strong` (≥ 3:1 on every surface); switch thumbs are ≥ 3:1 on their track; selection borders and focus rings are ≥ 3:1. Card hairlines are decorative (the label identifies the control).
- **Disclosures:** one header style (`disclosureSummary` + a right-hand chevron that turns when open) for every `<details>`. The four Design "More options" sections share `name="more-options"`: a native single-open accordion (opening one closes the other; each can be closed; content stays mounted so no setting is lost; collapsed headers keep their summary). A small toggle handler keeps the clicked header in place where browsers lack scroll anchoring.
- **Callouts:** `callout("warning" | "danger" | "success" | "neutral")`, always with an icon or words that carry the meaning.

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

| Palette         | Character                                |
| --------------- | ---------------------------------------- |
| Aurora          | Mint → blue                              |
| Amethyst        | Violet → pink                            |
| Desert Sunset   | Orange → rose                            |
| Ocean Depths    | Deep blue → cyan                         |
| Forest & Gold   | Forest green with gold                   |
| Rose Quartz     | Pink → lavender                          |
| Electric Cobalt | Cobalt → mint                            |
| Ember           | Coral → amber                            |
| Monochrome      | Neutral grays                            |
| GitHub Classic  | Familiar greens                          |
| GitLab Inspired | Orange → purple                          |
| Nordic Frost    | Frost blue → teal                        |
| Solarized       | Solarized-style tones                    |
| Midnight Neon   | Magenta → cyan glow                      |
| Paper & Ink     | Ink on warm paper                        |
| Obsidian & Gold | Warm black and gold (sophisticated dark) |
| Velvet Plum     | Plum and raspberry (sophisticated dark)  |
| Lagoon          | Aqua and coral (fresh)                   |
| Citrus          | Lime and sunshine (fresh, bold)          |
| Terracotta      | Clay and sage (warm, earthy)             |
| Mocha           | Espresso and caramel (warm, earthy)      |
| Porcelain       | Blue-gray and indigo (elegant light)     |
| Sage & Linen    | Linen and sage (elegant light)           |
| Volt            | Electric violet and lime (bold)          |

Contrast thresholds are **enforced by unit tests** (`src/theme/palettes.test.ts`) for every palette × mode. Any new palette must pass them.

Palette, layout, and mode are independent axes of `VisualizationConfig`, and changing one never resets the others (the one coupling: feature switches can move the layout, above). So are background, identity, platform colors, range, density and metric order.

### Panel styles

| Style      | Panels (stat cards, heatmap, breakdown, charts) | Content colors                          |
| ---------- | ----------------------------------------------- | --------------------------------------- |
| Filled     | `surface` fill + `border` stroke (default)      | Palette tokens as designed              |
| Outlined   | `border` stroke, no fill                        | Re-checked against the real backdrop(s) |
| Borderless | Invisible frame; same padding and gaps          | Re-checked against the real backdrop(s) |

Independent of the background: any panel style works with Solid, Gradient or Transparent. Geometry and spacing are identical across styles, so switching never reflows the graphic. The Sample badge always keeps its filled pill.

### Backgrounds

- **Solid:** the palette `background`.
- **Gradient:** `background` → `gradientEnd(theme)` (background mixed 10% toward the accent). Tests check `text`/`textMuted` ≥ 4.5:1 on the gradient end.
- **Transparent:** no canvas rect. Panels keep their `surface` fill. Tests check text, muted text (≥ 4.5:1) and heatmap level 4 (≥ 3:1) directly on GitHub's page colors (`GITHUB_SURFACES`: light `#ffffff`; dark `#0d1117` and `#212830`). The README snippet forces theme matching so the light variant never sits on a dark page.

### Custom platform colors

`resolveTheme(palette, mode, { series })` runs each custom color through `ensureContrast(color, surface, 3)`, mixing it toward black or white in 5% steps until it reaches 3:1. The studio shows "Adjusted to … for contrast." when that happens.

**Custom colors also color the heatmap by platform** (`withPlatformHeatmap`, applied after panel-style adjustment): each series color gets a 5-step ramp from `heatmapEmpty` to the series color (level 4 = the series color, ≥ 3:1). A day takes the ramp of the platform with the most contributions (a 50/50 blend on ties); its level still comes from the day's total. The legend labels each hue ("Less GitHub ■■■■ GitLab ■■■■ More") and tooltips always name the platform. Without custom colors, the palette's single ramp is used (unchanged).

## Profile headers (`src/renderers/IdentityHeader.tsx`)

| Preset           | Avatar                  | Content                                    | Height |
| ---------------- | ----------------------- | ------------------------------------------ | ------ |
| None             | —                       | Original title row, date range, handles    | —      |
| Compact identity | 36px                    | Name (or "Contribution activity"), handles | 40–58  |
| Full profile     | 64px (48 compact image) | Name 20px (17), title, date range, handles | ~88    |

- Avatars are circles clipped with a per-graphic `clipPath` id (`{idPrefix}-avatar-{platform}`) and ringed in the platform color. `<image href>` is always a `data:` URI.
- **Monogram fallback:** a circle in the series color with the initial in `bestTextOn(color)`.
- Name and title are single lines with an ellipsis, and leave room for the Sample badge. They are also in `<title>`/`<desc>`.
- **Arrangement (Identity section):** the Centered profile can swap which account sits on the left ("Account sides", URL `left`; GitHub left by default); Compact and Full profiles with avatars can put the avatar stack on the right ("Avatar position", URL `avs`). With avatars on the right, the text starts at the left padding and the status badge sits 12px left of the stack. Each control appears only for the headers it affects; the setting is kept when hidden. Neither changes the height or the description.

## History calendars (`src/renderers/HistoryCalendars.tsx`)

- **Full image — year cards:** one card per 12-month period, newest first, stacked with the section gap. Card header: dates (13px semibold, `text`) left and **that year's total** (13px semibold) right on the same row, then the coverage label (11px `textMuted`): "GitHub + GitLab", "GitHub", or "GitHub only · GitLab unavailable". Inner padding = the density's panel padding. One legend in the last card; one colour scale (quartiles over all shown days) across every year.
- **Panel style:** Filled and Outlined frame each card like every other panel. **Borderless** keeps the same frame, padding and gaps but draws it invisibly — the spacing and the bold header row separate the years.
- **Stats belong to the newest year:** multi-year graphics draw the summary stats (stat cards, or Minimal's one-line stats) inside the newest year's card, between its header and calendar — the border makes clear they describe that year only. Breakdown and chart titles add the period ("Platform breakdown · Last 12 months"). Phones and heatmap-less designs put a "Last 12 months · GitHub + GitLab" heading above the stats instead. Single-year graphics are unchanged.
- **No hatching.** Missing coverage is explained in words (coverage labels, tooltips, description, data table), never by patterns.
- **Phones (`size=compact`):** a "yearly summary" list — dates, total, coverage label per year, separated by hairlines — above the usual last-20-weeks heatmap.

## Source attribution

Every published graphic names the accounts behind its data: "● GitHub @jenkruk ● GitLab @contactkruk" on the header's date line (all layouts and both header presets; compact images on their own line). Labels move to their own line when they wouldn't fit beside the dates, and only then are over-long usernames shortened with "…" — the full usernames are always in `<desc>`. Avatars, names and titles stay optional; attribution doesn't (see ARCHITECTURE, URL contract).

## Density

`SPACING` in `src/renderers/layouts.tsx`: Spacious (section gap 16, panel padding 16, stat card 70/84, breakdown 74, trends 170) and Compact (10, 10, 58/70, 60, 140). Font sizes don't change with density; only whitespace does.

## Storybook

`npm run storybook` (dev, port 6006) and `npm run build-storybook`. Stories import production components only (`src/**/*.stories.tsx`, shared data in `src/stories/fixtures.ts`):

- **Graphic/Visualization:** every layout, the 24 × 2 palette gallery, year cards in every panel style, long-username attribution, backgrounds over GitHub light/dark, ranges, densities, profile headers (avatar and monogram), custom colors, the compact phone image.
- **Graphic/Heatmap** and **Graphic/Metric cards:** the section components with palette, mode, width, density and count controls.
- **Studio/Guided studio:** each step (Connect, Design with data or sample data, Publish) at desktop and phone viewports. Publish stories render the real published URL offline via `renderSampleCard` (production decoder + renderer), so they show a meaningful image instead of a failed request.
- **Studio/Foundations:** tokens, type scale, buttons, controls, callouts and the app shell (desktop and phone).
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
- Collapsed sections use `Disclosure` (native `<details>`/`<summary>`, uncontrolled), with a one-line summary of the current state ("Gradient · Outlined panels", "6 of 9 shown"). The Design "More options" sections form a single-open accordion (shared `name`).
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
- Mobile-first: one column under `lg`. In Design, the preview comes before the controls in the DOM, so small screens see feedback first; it starts at a capped height (≤ 60vh) with an _Expand preview_ button (`aria-expanded`) and is never sticky on phones. At `lg` the grid places the controls left and the sticky preview right, fitted to the viewport height (so no part of it is out of reach) and released while the data view is open. Publish uses the same grid: actions left, the published image right. Each step has one visible title (the step heading); the page's `<h1>` is visually hidden so the step navigation and title don't repeat each other.
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

| Mode                          | Purpose                                                                                                                                                                                                                                                                                                                                       | Status                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| README-width preview          | The full image in an ~830px README column that shrinks with the studio on small screens. No device switcher: published cards have no phone or tablet variants.                                                                                                                                                                                | Shipped (3.1; device modes removed Nov 2026)  |
| Backdrop: GitHub light / dark | One flat stage (Design and Publish) showing GitHub's light (`#ffffff`) or dark (`#0d1117`) README page; it starts on the page for the graphic's mode. At lg the sticky Design preview is fitted to the viewport height and "View full size" opens a modal dialog, so tall three-year graphics stay fully inspectable without nested scrolling | Shipped (Nov 2026)                            |
| Grayscale                     | Checks that meaning survives without hue (CSS `filter: grayscale(1)` on the preview only)                                                                                                                                                                                                                                                     | Phase 4                                       |
| Accessible-data view          | Shows the data view instead of the graphic                                                                                                                                                                                                                                                                                                    | Phase 4 (the data view itself shipped in 3.1) |

Preview modes change only the **preview container**. They are never part of `VisualizationConfig` or the exported graphic.

### Responsive graphics

Shrinking the 840px graphic into a ~360px phone column puts labels at about 4px. The **compact image** (400px) reflows instead:

- stat cards in two columns
- the last 20 weeks of heatmap, with cells close to GitHub's 10px on a phone
- trend charts stacked vertically
- wrapped footnote and inline stats
- platform labels on their own line

README snippets no longer serve it: GitHub's `<themed-picture>` drops width conditions from theme queries for signed-in readers, which served the phone image on desktops, and a README image doesn't need phone or tablet variants. Every snippet uses the full image, which GitHub scales to fit. `size=compact` URLs still render, so older embeds keep working.

### Alternative data view: "Detailed contribution data"

A native `<details>` under the preview (collapsed by default, visually secondary). Its content comes from `src/components/studio/data-view-model.ts` (pure, unit-tested), built only from the same `PreparedView` and `ContributionMetrics` as the graphic, so it can't drift. Each fact appears once:

1. **Summary**: one or two sentences: the total, the accounts it covers, active days (only when that statistic is selected), the period ("in the last 12 months", or a legacy link's "last 90 days"), and what's missing ("Earlier GitLab history is unavailable.", the history note). Sample and stale data say so first.
2. **Contribution history**: a `<table>` whose `<caption>` holds the section heading (`<h4>`) and its scope. One row per 12-month period, newest first (a single row for one-year designs); row headers name the period ("Last 12 months" + dates), columns are each platform and, for combined accounts, Total. A platform that doesn't provide a period reads **Not available** and that row's total **Incomplete**: missing data is never shown or announced as zero. Notes below the table explain this, and the differing GitHub/GitLab start dates, only when they apply.
3. **Summary statistics**: a `<dl>` with its scope ("Last 12 months · GitHub + GitLab") that mirrors the graphic's stat cards: only the enabled statistics, in the user's order, minus the total (already in the summary and the table), plus the platform split when the graphic shows the breakdown. Omitted when the graphic shows only the total; the history and monthly tables are always available.
4. **Monthly contributions**: a nested disclosure holding the monthly `<table>` (caption, column and row headers). Coverage is measured day by day per platform: a month the reporting period cuts says so ("Oct 2025 (from Oct 26)"); a platform covering part of a month shows its known count with the dates ("4 from Mar 10"), one covering none of it reads **Not available**, and that month's total is marked **incomplete**. Genuine zero activity stays 0.

Tables wrap rather than scroll, so they need no extra tab stops at 320px or 200% zoom; numbers are right-aligned with tabular numerals. The SVG keeps its own `<title>`/`<desc>`, because a README embed has none of this panel.

### Verification

- **Now:** Vitest + Testing Library assertions on roles, names, descriptions, and keyboard paths for every interactive component; contrast tests for every palette. **Playwright + axe-core** (`npm run test:e2e`): WCAG 2.2 AA scans of every major state at 320/375/768/1280 (any violation fails), a keyboard-only Connect → Design → Publish run, 24px target sizes, ≥ 11px UI text, no horizontal scroll, and reduced motion.
- **Storybook** with the a11y addon (Phase 4), plus a Vitest smoke test over every story.
- **Planned:** visual regression across themes × palettes × viewports (Phase 5); manual VoiceOver and NVDA passes before launch.

## Original design

GitVis's visuals are original. The heatmap grid follows the common contribution-calendar convention (weeks × weekdays) because users recognize it, but the styling, layouts, and palettes are our own.
