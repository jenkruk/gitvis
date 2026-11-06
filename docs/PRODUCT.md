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

1. **Connect.** Enter a GitHub username and/or a GitLab username, independently. Either can be blank, and they can differ.
2. **Customize.** Choose a layout family, toggle features, and pick a palette and light/dark mode. The preview updates immediately.
3. **Publish.** Copy README Markdown, download SVG or PNG, or copy a stable URL that always renders current data.

## Features

### Layout families

- **Minimal:** quiet typography, a heatmap, and an optional one-line stats summary.
- **Dashboard:** stat cards, heatmap, platform breakdown.
- **Data-rich:** detailed stat cards, heatmap, weekly trend, monthly platform comparison.

Switching layouts never discards the user's feature, palette, or mode choices. A layout that can't show an enabled feature says so in the UI and keeps the setting.

### Feature toggles

Combined contribution heatmap · Total contributions · Active days · Longest streak · Best day (off by default) · GitHub/GitLab breakdown · Activity trends · Platform labels and links.

Features live in a registry (`src/config/features.ts`). Adding one is a data change plus a renderer, not an edit to every layout's settings.

### Color studio

Nine curated palettes, each with light and dark variants: Aurora, Amethyst, Desert Sunset, Ocean Depths, Forest & Gold, Rose Quartz, Electric Cobalt, Ember, Monochrome. Palettes coordinate background, surface, border, text, accent, chart series, and a 5-step heatmap ramp. Automated tests enforce contrast. Advanced color overrides come after V1's first release (see the roadmap).

### Publishing

README Markdown, SVG download, PNG download, a stable shareable URL, and a live embed endpoint.

## Honesty principles

- GitHub and GitLab count **different activities** (see `ARCHITECTURE.md`, "Platform semantics"). GitVis calls them **contributions**, never "commits".
- Combined totals are the sum of what each platform reports. They are not deduplicated (mirrored repos may count twice), and the UI says so.
- Private activity appears only as counts, and only when the user has opted in on that platform.
- Production views never show invented data. Sample data used in development and demos carries a visible "Sample data" label inside the graphic.

## V1 scope

**In scope:** GitHub and GitLab.com public calendars, the three layouts, the feature registry, nine palettes with light and dark variants, live preview, SVG/PNG/Markdown export, a stable embed URL with caching, accessibility (WCAG 2.2 AA for the app UI; text alternatives inside SVGs), and responsive design.

**Out of scope for V1:** accounts and authentication, a database, payments, self-hosted GitLab instances, Bitbucket (the schema allows for it), private-repository access via OAuth, and animated SVGs.

## Success criteria

- A user with only GitHub, only GitLab, or both can produce and embed a graphic in under two minutes.
- The embedded image updates without user action and stays within platform rate limits through caching.
- Every palette and mode passes the contrast checks.
