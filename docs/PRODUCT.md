# GitVis — Product

> **Every contribution counts.**

## Problem

Developers split their work across GitHub, GitLab, and private repositories. A GitHub contribution calendar shows only one slice of that work, so a profile can look quiet even when the developer is busy elsewhere.

## Vision

GitVis combines public contribution calendars from several platforms into one visualization that the developer designs and embeds in a GitHub profile README. The embed updates itself, with no GitHub Actions setup required.

The differentiator is **the customization experience**. GitVis is a small design studio for developer activity, not a fixed stats card.

## Users

| User                                       | Need                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| Developer with work split across platforms | One honest picture of activity across GitHub and GitLab                |
| Developer who cares about their profile    | A graphic that matches their personal aesthetic                        |
| Developer with mostly private work         | A way to show _that_ they are active, as counts only and never content |
| Hiring managers and readers                | A clear, readable, accurate summary with obvious platform attribution  |

## Core flow

A guided, three-step studio. A step indicator shows where you are; completed steps can be revisited, and going back never loses a setting.

1. **Connect.** Two username fields (GitHub, GitLab; either can be blank, and they can differ) and one action: _See my contributions_. When every account loads, the studio moves on to Design. A partial failure stays on Connect with Retry and _Continue with available data_. Visitors can also _try it with sample data_ (never publishable).
2. **Design.** Start from a preset — **Contribution graphic** or **Developer profile card** — then pick a layout (Minimal, Dashboard, Data-rich) and one of six featured palettes (_View all 15_). Everything else is optional and collapsed: Identity, Colors & Background, Metrics & Charts, Display. The live preview sits beside the controls on desktop and above them, expandable, on phones.
3. **Publish.** The real published image, _Copy README Markdown_ as the main action, SVG/PNG downloads, the image URL and _Edit design_. Markdown details and embed options are tucked into one collapsed section, so README syntax only appears here.

Defaults produce a good graphic with no customization. The design and accounts live in the URL (the Edit link), and the current step in its hash, so reloads and shared links restore everything.

## Features

### Layout families

- **Minimal:** quiet typography, a heatmap, and an optional one-line stats summary.
- **Dashboard:** stat cards, heatmap, platform breakdown.
- **Data-rich:** detailed stat cards, heatmap, weekly trend, monthly platform comparison.

Switching layouts never discards the user's feature, palette, or mode choices. A layout that can't show an enabled feature says so in the UI and keeps the setting.

### Feature toggles

Combined contribution heatmap · Total contributions · Active days · Longest streak · Best day (off by default) · Current streak (off by default) · GitHub/GitLab breakdown · Activity trends · Platform labels and links.

Metrics can be **reordered** (Move up / Move down buttons, keyboard-accessible and announced). The **date range** is 1 year (default), 2 years or 3 years: one calendar per 12-month period, newest first, each with its yearly total. Earlier years come from GitHub; GitLab publishes only the last 12 months, so for combined accounts earlier periods are clearly labelled "GitHub only", stats cover the period both platforms report (and say so), and GitLab-only accounts can't choose 2 or 3 years. Old links with 30- or 90-day ranges keep working unchanged. **Density** (Spacious or Compact) tightens cards and panels without changing the layout.

Features live in a registry (`src/config/features.ts`). Adding one is a data change plus a renderer, not an edit to every layout's settings.

### Profile identity (all optional)

- **Header presets:** None (the original header), Compact identity (small avatars, name, handles) and Full profile (large avatars, name, professional title, handles).
- Each part is independent: show the GitHub handle, the GitLab handle, both or neither; show one avatar, both or none; add a display name (≤ 40 characters) and a professional title (≤ 60).
- **Avatars are embedded in the image** as data, never linked, so the graphic never depends on an external image loading inside GitHub's proxy. If an avatar can't be fetched, a monogram in the platform color takes its place.
- **Profile links** can be added under the image in the README snippet (SVG links don't work inside GitHub's `<img>`).

### Color studio

Fifteen curated palettes, each with light and dark variants: Aurora, Amethyst, Desert Sunset, Ocean Depths, Forest & Gold, Rose Quartz, Electric Cobalt, Ember, Monochrome, GitHub Classic, GitLab Inspired, Nordic Frost, Solarized, Midnight Neon, Paper & Ink. Palettes coordinate background, surface, border, text, accent, chart series, and a 5-step heatmap ramp. Automated tests enforce contrast.

- **Panels:** Filled, Outlined or Borderless cards and chart panels, independent of the background. Colors are re-checked for contrast against whatever is actually behind them.
- **Background:** Solid, Gradient (a subtle diagonal tint) or Transparent (blends into the README). Transparent images always use theme matching, so text stays readable on GitHub light and dark.
- **Custom platform colors:** pick any GitHub/GitLab series color. Colors too close to the panel are adjusted automatically to keep 3:1 contrast, and the UI says so. Platforms are always labelled too, so color never carries meaning alone.

### Publishing

The user's goal is to **paste one Markdown snippet into a GitHub README** and never touch it again.

- **Live image URL** (`/api/card?v=1&…`). The URL holds the whole design: usernames, layout, palette, mode, features, and every personalization setting. It renders current data, refreshed about every 12 hours, with no GitHub Actions, accounts, database, or manual updates.
- **Copy Markdown** in one click. It can match the reader's GitHub light or dark theme using a `<picture>` element.
- **Published-image preview**: the actual image GitHub will fetch, shown before copying.
- **Edit configuration link**: reopens the studio with every choice restored. The README image links there too.
- **Downloads**: SVG and PNG, both generated from the published image.
- **Stability promise**: a URL generated today renders the same design in future versions. Version bumps are only for breaking changes, and old versions keep working.

## Honesty principles

- GitHub and GitLab count **different activities** (see `ARCHITECTURE.md`, "Platform semantics"). GitVis calls them **contributions**, never "commits".
- Combined totals are the sum of what each platform reports. They are not deduplicated (mirrored repos may count twice), and the UI says so.
- Private activity appears only as counts, and only when the user has opted in on that platform.
- Production views never show invented data. Sample data used in development and demos carries a visible "Sample data" label inside the graphic.

## V1 scope

**In scope:** GitHub and GitLab.com public calendars, the three layouts, the feature registry, fifteen palettes with light and dark variants, optional profile identity, backgrounds, custom platform colors, panel styles, 1–3 years of history (GitHub; GitLab's 12 months), density, metric ordering, live preview, SVG/PNG/Markdown export, a stable embed URL with caching, accessibility (WCAG 2.2 AA for the app UI; text alternatives inside SVGs), and responsive design.

**Out of scope for V1:** accounts and authentication, a database, payments, self-hosted GitLab instances, Bitbucket (the schema allows for it), private-repository access via OAuth, and animated SVGs.

## Success criteria

- A user with only GitHub, only GitLab, or both can produce and embed a graphic in under two minutes.
- The embedded image updates without user action and stays within platform rate limits through caching.
- Every palette and mode passes the contrast checks.
